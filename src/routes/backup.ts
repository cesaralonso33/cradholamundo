import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { adminOnly, authenticate } from "../lib/auth.js";
import { logAudit } from "../lib/audit.js";
import { invalidateSettingsCache } from "../lib/settings.js";

const toDate = (value: any) => (value ? new Date(value) : null);

export async function backupRoutes(app: FastifyInstance) {
  app.get("/api/backup", { preHandler: [authenticate, adminOnly] }, async () => {
    const [
      settings,
      users,
      products,
      movements,
      locationHistory,
      employees,
      constancias,
      papeleriaItems,
      orders,
      orderItems,
    ] = await Promise.all([
      prisma.setting.findMany(),
      prisma.user.findMany(),
      prisma.product.findMany(),
      prisma.inventoryMovement.findMany(),
      prisma.locationHistory.findMany(),
      prisma.employee.findMany(),
      prisma.constancia.findMany(),
      prisma.papeleriaItem.findMany(),
      prisma.papeleriaOrder.findMany(),
      prisma.papeleriaOrderItem.findMany(),
    ]);

    return {
      meta: {
        app: "inventario",
        version: 1,
        exported_at: new Date().toISOString(),
      },
      data: {
        settings,
        users,
        products,
        movements,
        locationHistory,
        employees,
        constancias,
        papeleriaItems,
        orders,
        orderItems,
      },
    };
  });

  app.post("/api/backup/restore", {
    preHandler: [authenticate, adminOnly],
    bodyLimit: 50 * 1024 * 1024,
  }, async (req, reply) => {
    const body = req.body as any;
    const data = body?.data;
    if (!data || typeof data !== "object") {
      return reply.code(400).send({ error: "invalid backup file" });
    }

    const {
      settings = [],
      users = [],
      products = [],
      movements = [],
      locationHistory = [],
      employees = [],
      constancias = [],
      papeleriaItems = [],
      orders = [],
      orderItems = [],
    } = data;

    try {
      await prisma.$transaction(async (tx) => {
        // Delete in dependency order
        await tx.papeleriaOrderItem.deleteMany();
        await tx.papeleriaOrder.deleteMany();
        await tx.constancia.deleteMany();
        await tx.employee.deleteMany();
        await tx.locationHistory.deleteMany();
        await tx.inventoryMovement.deleteMany();
        await tx.papeleriaItem.deleteMany();
        await tx.product.deleteMany();
        await tx.user.deleteMany();
        await tx.setting.deleteMany();

        // Insert in dependency order
        if (settings.length) {
          await tx.setting.createMany({ data: settings.map((s: any) => ({ key: s.key, value: s.value })) });
        }
        if (users.length) {
          await tx.user.createMany({
            data: users.map((u: any) => ({
              id: u.id,
              username: u.username,
              email: u.email ?? null,
              password: u.password,
              role: u.role,
              created_at: toDate(u.created_at) ?? new Date(),
              updated_at: toDate(u.updated_at) ?? new Date(),
            })),
          });
        }
        if (products.length) {
          await tx.product.createMany({
            data: products.map((p: any) => ({
              id: p.id,
              sku: p.sku,
              name: p.name,
              category: p.category ?? null,
              location: p.location ?? null,
              quantity: p.quantity,
              min_stock: p.min_stock,
              created_at: toDate(p.created_at) ?? new Date(),
              updated_at: toDate(p.updated_at) ?? new Date(),
            })),
          });
        }
        if (movements.length) {
          await tx.inventoryMovement.createMany({
            data: movements.map((m: any) => ({
              id: m.id,
              product_id: m.product_id,
              type: m.type,
              quantity: m.quantity,
              note: m.note ?? null,
              created_at: toDate(m.created_at) ?? new Date(),
            })),
          });
        }
        if (locationHistory.length) {
          await tx.locationHistory.createMany({
            data: locationHistory.map((h: any) => ({
              id: h.id,
              product_id: h.product_id,
              from_location: h.from_location ?? null,
              to_location: h.to_location,
              changed_by: h.changed_by,
              created_at: toDate(h.created_at) ?? new Date(),
            })),
          });
        }
        if (employees.length) {
          await tx.employee.createMany({
            data: employees.map((e: any) => ({
              id: e.id,
              name: e.name,
              position: e.position ?? null,
              email: e.email ?? null,
              created_at: toDate(e.created_at) ?? new Date(),
              updated_at: toDate(e.updated_at) ?? new Date(),
            })),
          });
        }
        if (constancias.length) {
          await tx.constancia.createMany({
            data: constancias.map((c: any) => ({
              id: c.id,
              employee_id: c.employee_id,
              title: c.title,
              description: c.description ?? null,
              file_path: c.file_path ?? null,
              file_name: c.file_name ?? null,
              created_at: toDate(c.created_at) ?? new Date(),
            })),
          });
        }
        if (papeleriaItems.length) {
          await tx.papeleriaItem.createMany({
            data: papeleriaItems.map((p: any) => ({
              id: p.id,
              name: p.name,
              unit: p.unit ?? null,
              quantity: p.quantity,
              created_at: toDate(p.created_at) ?? new Date(),
              updated_at: toDate(p.updated_at) ?? new Date(),
            })),
          });
        }
        if (orders.length) {
          await tx.papeleriaOrder.createMany({
            data: orders.map((o: any) => ({
              id: o.id,
              folio: o.folio,
              user_id: o.user_id,
              status: o.status,
              created_at: toDate(o.created_at) ?? new Date(),
              updated_at: toDate(o.updated_at) ?? new Date(),
              closed_at: toDate(o.closed_at),
              closed_by: o.closed_by ?? null,
            })),
          });
        }
        if (orderItems.length) {
          await tx.papeleriaOrderItem.createMany({
            data: orderItems.map((i: any) => ({
              id: i.id,
              order_id: i.order_id,
              papeleria_item_id: i.papeleria_item_id,
              quantity: i.quantity,
              note: i.note ?? null,
            })),
          });
        }
      });

      invalidateSettingsCache();
      await logAudit(req, "backup.restored", "backup");
      return { ok: true, restored_at: new Date().toISOString() };
    } catch (error: any) {
      app.log.error(error);
      return reply.code(400).send({ error: error.message || "restore failed" });
    }
  });
}
