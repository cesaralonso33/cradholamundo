import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { adminOnly, authenticate, requirePermission } from "../lib/auth.js";
import { getSetting } from "../lib/settings.js";
import { logAudit } from "../lib/audit.js";

export async function productRoutes(app: FastifyInstance) {
  app.post("/api/products", { preHandler: [authenticate, requirePermission("products")] }, async (req, reply) => {
    const { sku, name, category, quantity } = (req.body as any) || {};
    if (!sku || !name) return reply.code(400).send({ error: "sku and name are required" });

    const location = req.user.username;
    const qty = quantity != null ? Math.max(0, Math.floor(Number(quantity) || 0)) : 0;
    const [existing, preventDuplicates] = await Promise.all([
      prisma.product.findUnique({ where: { sku } }),
      getSetting("prevent_duplicates"),
    ]);

    if (preventDuplicates === "true" && existing) {
      return reply.code(409).send({ error: "SKU already captured (duplicate rule enabled)" });
    }

    const product = await prisma.product.upsert({
      where: { sku },
      update: { name, category: category ?? null, location, quantity: qty },
      create: { sku, name, category: category ?? null, location, quantity: qty, min_stock: 0 },
    });

    if (existing && existing.location !== location) {
      await prisma.locationHistory.create({
        data: { product_id: product.id, from_location: existing.location, to_location: location, changed_by: req.user.username },
      });
    } else if (!existing) {
      await prisma.locationHistory.create({
        data: { product_id: product.id, from_location: null, to_location: location, changed_by: req.user.username },
      });
    }

    await logAudit(req, existing ? "product.updated" : "product.created", "product", product.id, { sku, name, location });
    return product;
  });

  app.post("/api/products/:sku/archive", { preHandler: [authenticate, requirePermission("products")] }, async (req, reply) => {
    const { sku } = req.params as any;
    const product = await prisma.product.findUnique({ where: { sku } });
    if (!product) return reply.code(404).send({ error: "not found" });
    if (req.user.role !== "admin" && product.location !== req.user.username) {
      return reply.code(403).send({ error: "forbidden" });
    }
    const updated = await prisma.product.update({ where: { sku }, data: { location: "Archivo" } });
    await prisma.locationHistory.create({
      data: { product_id: product.id, from_location: product.location, to_location: "Archivo", changed_by: req.user.username },
    });
    await logAudit(req, "product.archived", "product", product.id, { sku, from: product.location, to: "Archivo" });
    return updated;
  });

  app.put("/api/products/:sku", { preHandler: [authenticate, requirePermission("products")] }, async (req: any, reply) => {
    const { sku } = req.params;
    const { name, category, quantity } = (req.body as any) || {};
    if (!name) return reply.code(400).send({ error: "name required" });

    const product = await prisma.product.findUnique({ where: { sku } });
    if (!product) return reply.code(404).send({ error: "not found" });
    if (req.user.role !== "admin" && product.location !== req.user.username) {
      return reply.code(403).send({ error: "forbidden" });
    }

    const updated = await prisma.product.update({
      where: { sku },
      data: {
        name: String(name).trim(),
        category: category ? String(category).trim() : null,
        quantity: quantity != null ? Math.max(0, Math.floor(Number(quantity) || 0)) : product.quantity,
      },
    });
    await logAudit(req, "product.edited", "product", updated.id, { sku, name: updated.name, quantity: updated.quantity });
    return updated;
  });

  app.get("/api/products", { preHandler: [authenticate, requirePermission("products")] }, async (req) => {
    const q = req.query as any;
    const search = (q.search || q.q || "").toString().trim();
    const page = Math.max(1, Number(q.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(q.pageSize) || 20));

    const where: any = {};
    if (req.user.role !== "admin") where.location = req.user.username;
    if (search) {
      where.OR = [
        { sku: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { category: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { updated_at: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.product.count({ where }),
    ]);
    return { items, total, page, pageSize };
  });

  app.get("/api/products/:sku/history", { preHandler: [authenticate, requirePermission("products")] }, async (req, reply) => {
    const { sku } = req.params as any;
    const query = req.query as any;
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));

    const product = await prisma.product.findUnique({ where: { sku }, select: { id: true } });
    if (!product) return reply.code(404).send({ error: "not found" });

    const where = { product_id: product.id };
    const [items, total] = await Promise.all([
      prisma.locationHistory.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.locationHistory.count({ where }),
    ]);

    return { items, total, page, pageSize };
  });

  app.get("/api/products/:sku", { preHandler: [authenticate, requirePermission("products")] }, async (req, reply) => {
    const { sku } = req.params as any;
    const product = await prisma.product.findUnique({ where: { sku } });
    if (!product) return reply.code(404).send({ error: "not found" });
    return product;
  });

  app.delete("/api/products/:sku", { preHandler: [authenticate, adminOnly] }, async (req, reply) => {
    const { sku } = req.params as any;
    const product = await prisma.product.findUnique({ where: { sku }, select: { id: true } });
    if (!product) return reply.code(404).send({ error: "not found" });
    await prisma.product.delete({ where: { sku } });
    await logAudit(req, "product.deleted", "product", product.id, { sku });
    return { ok: true };
  });

  app.post("/api/inventory/movement", { preHandler: [authenticate, requirePermission("products")] }, async (req, reply) => {
    const { sku, type, quantity, note } = (req.body as any) || {};
    if (!sku || !type || quantity == null) {
      return reply.code(400).send({ error: "sku, type, quantity required" });
    }
    const movementType = String(type).toUpperCase();
    if (movementType !== "IN" && movementType !== "OUT") {
      return reply.code(400).send({ error: "type must be IN or OUT" });
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      return reply.code(400).send({ error: "quantity must be positive" });
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const product = await tx.product.update({
          where: { sku },
          data: {
            quantity: movementType === "IN" ? { increment: qty } : { decrement: qty },
          },
        });
        const movement = await tx.inventoryMovement.create({
          data: { product_id: product.id, type: movementType, quantity: qty, note: note ?? null },
        });
        return { movement, product };
      });
      await logAudit(req, "inventory.movement", "product", result.product.id, { sku, type: movementType, quantity: qty });
      return result;
    } catch (error: any) {
      if (error?.code === "P2025") return reply.code(404).send({ error: "product not found" });
      throw error;
    }
  });
}
