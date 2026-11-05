import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { adminOnly, authenticate, requirePermission } from "../lib/auth.js";
import { readExcelRows } from "../lib/excel.js";
import { logAudit } from "../lib/audit.js";

const orderInclude = {
  items: { include: { item: true } },
  user: { select: { id: true, username: true } },
} as const;

async function nextFolio() {
  const count = await prisma.papeleriaOrder.count();
  return `PAP-${String(count + 1).padStart(6, "0")}`;
}

export async function papeleriaRoutes(app: FastifyInstance) {
  // ---- Orders (registered before /api/papeleria/:id) ----
  app.get("/api/papeleria/orders", { preHandler: [authenticate, requirePermission("papeleria")] }, async (req) => {
    const query = req.query as any;
    const limit = Math.min(200, Math.max(1, Number(query.limit) || 100));
    const where: any = {};
    if (req.user.role !== "admin") where.user_id = req.user.id;

    const [items, total, pending] = await Promise.all([
      prisma.papeleriaOrder.findMany({
        where,
        orderBy: { created_at: "desc" },
        take: limit,
        select: {
          id: true,
          folio: true,
          status: true,
          created_at: true,
          user: { select: { id: true, username: true } },
          _count: { select: { items: true } },
        },
      }),
      prisma.papeleriaOrder.count({ where }),
      req.user.role === "admin"
        ? prisma.papeleriaOrder.count({ where: { status: "OPEN" } })
        : Promise.resolve(0),
    ]);

    return { items, total, pending };
  });

  app.post("/api/papeleria/orders", { preHandler: [authenticate, requirePermission("papeleria")] }, async (req, reply) => {
    const orderItems = Array.isArray((req.body as any)?.items) ? (req.body as any).items : [];
    if (!orderItems.length) return reply.code(400).send({ error: "items required" });

    const normalizedItems = orderItems
      .filter((it: any) => it && typeof it.itemId === "string")
      .map((it: any) => ({
        itemId: it.itemId,
        quantity: Math.max(1, Math.floor(Number(it.quantity) || 1)),
        note: it.note || null,
      }));
    if (!normalizedItems.length) return reply.code(400).send({ error: "invalid items" });

    const existingItems = await prisma.papeleriaItem.findMany({
      where: { id: { in: normalizedItems.map((it: any) => it.itemId) } },
      select: { id: true },
    });
    const existingIds = new Set(existingItems.map((item) => item.id));
    if (normalizedItems.some((it: any) => !existingIds.has(it.itemId))) {
      return reply.code(400).send({ error: "one or more items do not exist" });
    }

    const itemsData = normalizedItems.map((it: any) => ({
      papeleria_item_id: it.itemId,
      quantity: it.quantity,
      note: it.note,
    }));

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const order = await prisma.papeleriaOrder.create({
          data: {
            folio: await nextFolio(),
            user_id: req.user.id,
            items: { create: itemsData },
          },
          include: orderInclude,
        });
        await logAudit(req, "papeleria.order.created", "papeleria_order", order.id, { folio: order.folio, items: itemsData.length });
        return order;
      } catch (e: any) {
        if (e.code === "P2002" && attempt < 4) continue;
        throw e;
      }
    }
    return reply.code(500).send({ error: "could not generate folio" });
  });

  app.get("/api/papeleria/orders/:id", { preHandler: [authenticate, requirePermission("papeleria")] }, async (req, reply) => {
    const { id } = req.params as any;
    const order = await prisma.papeleriaOrder.findUnique({ where: { id }, include: orderInclude });
    if (!order) return reply.code(404).send({ error: "not found" });
    if (req.user.role !== "admin" && order.user_id !== req.user.id) {
      return reply.code(403).send({ error: "forbidden" });
    }
    return order;
  });

  app.put("/api/papeleria/orders/:id", { preHandler: [authenticate, adminOnly] }, async (req, reply) => {
    const { id } = req.params as any;
    const body = req.body as any;
    const order = await prisma.papeleriaOrder.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!order) return reply.code(404).send({ error: "not found" });
    if (order.status === "CLOSED") return reply.code(400).send({ error: "order closed" });

    if (Array.isArray(body?.items)) {
      const normalizedItems = body.items
        .filter((it: any) => it && typeof it.itemId === "string")
        .map((it: any) => ({
          itemId: it.itemId,
          quantity: Math.max(1, Math.floor(Number(it.quantity) || 1)),
          note: it.note || null,
        }));
      if (!normalizedItems.length) return reply.code(400).send({ error: "invalid items" });

      const existingItems = await prisma.papeleriaItem.findMany({
        where: { id: { in: normalizedItems.map((it: any) => it.itemId) } },
        select: { id: true },
      });
      const existingIds = new Set(existingItems.map((item) => item.id));
      if (normalizedItems.some((it: any) => !existingIds.has(it.itemId))) {
        return reply.code(400).send({ error: "one or more items do not exist" });
      }

      await prisma.$transaction([
        prisma.papeleriaOrderItem.deleteMany({ where: { order_id: id } }),
        prisma.papeleriaOrderItem.createMany({
          data: normalizedItems.map((it: any) => ({
            order_id: id,
            papeleria_item_id: it.itemId,
            quantity: it.quantity,
            note: it.note,
          })),
        }),
      ]);
    }

    const updated = await prisma.papeleriaOrder.findUnique({ where: { id }, include: orderInclude });
    await logAudit(req, "papeleria.order.updated", "papeleria_order", id);
    return updated;
  });

  app.post("/api/papeleria/orders/:id/close", { preHandler: [authenticate, adminOnly] }, async (req, reply) => {
    const { id } = req.params as any;
    const order = await prisma.papeleriaOrder.findUnique({ where: { id }, select: { status: true } });
    if (!order) return reply.code(404).send({ error: "not found" });
    if (order.status === "CLOSED") return reply.code(400).send({ error: "already closed" });

    const updated = await prisma.papeleriaOrder.update({
      where: { id },
      data: { status: "CLOSED", closed_at: new Date(), closed_by: req.user.username },
      include: orderInclude,
    });
    await logAudit(req, "papeleria.order.closed", "papeleria_order", id, { folio: updated.folio });
    return updated;
  });

  // ---- Items ----
  app.get("/api/papeleria", { preHandler: [authenticate, requirePermission("papeleria")] }, async () => {
    const items = await prisma.papeleriaItem.findMany({ orderBy: { created_at: "desc" } });
    return { items };
  });

  app.post("/api/papeleria", { preHandler: [authenticate, adminOnly] }, async (req, reply) => {
    const { name, unit, quantity } = (req.body as any) || {};
    if (!name) return reply.code(400).send({ error: "name required" });
    const item = await prisma.papeleriaItem.create({
      data: { name, unit: unit || null, quantity: quantity != null ? Number(quantity) : 0 },
    });
    await logAudit(req, "papeleria.item.created", "papeleria_item", item.id, { name: item.name });
    return item;
  });

  app.put("/api/papeleria/:id", { preHandler: [authenticate, adminOnly] }, async (req, reply) => {
    const { id } = req.params as any;
    const { name, unit, quantity } = (req.body as any) || {};
    try {
      const item = await prisma.papeleriaItem.update({
        where: { id },
        data: {
          name: name ?? undefined,
          unit: unit ?? undefined,
          quantity: quantity != null ? Number(quantity) : undefined,
        },
      });
      await logAudit(req, "papeleria.item.updated", "papeleria_item", item.id, { name: item.name });
      return item;
    } catch {
      return reply.code(404).send({ error: "not found" });
    }
  });

  app.delete("/api/papeleria/:id", { preHandler: [authenticate, adminOnly] }, async (req, reply) => {
    const { id } = req.params as any;
    try {
      await prisma.papeleriaItem.delete({ where: { id } });
      await logAudit(req, "papeleria.item.deleted", "papeleria_item", id);
      return { ok: true };
    } catch {
      return reply.code(404).send({ error: "not found" });
    }
  });

  app.post("/api/papeleria/import", { preHandler: [authenticate, adminOnly] }, async (req: any, reply) => {
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: "file required" });

    let rows: any[];
    try {
      rows = await readExcelRows(file);
    } catch {
      return reply.code(400).send({ error: "invalid excel file" });
    }

    let created = 0;
    const errors: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = String(row["Nombre"] || row["nombre"] || row["Articulo"] || row["Artículo"] || row["name"] || "").trim();
      const unit = String(row["Unidad"] || row["unidad"] || row["Unit"] || "").trim();
      const qtyRaw = row["Cantidad"] || row["cantidad"] || row["Qty"] || row["qty"] || 0;
      if (!name) {
        errors.push(`Fila ${i + 2}: nombre vacío`);
        continue;
      }
      try {
        await prisma.papeleriaItem.create({
          data: { name, unit: unit || null, quantity: Number(qtyRaw) || 0 },
        });
        created++;
      } catch (e: any) {
        errors.push(`Fila ${i + 2}: ${e.message || "error"}`);
      }
    }
    await logAudit(req, "papeleria.imported", "papeleria_item", undefined, { created, total: rows.length, errors: errors.length });
    return { created, total: rows.length, errors };
  });
}
