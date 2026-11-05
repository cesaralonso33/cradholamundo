import type { FastifyInstance } from "fastify";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { pipeline as pump } from "node:stream/promises";
import { prisma } from "../lib/prisma.js";
import { adminOnly, authenticate, requirePermission } from "../lib/auth.js";
import { readExcelRows } from "../lib/excel.js";
import { uploadsDir } from "../lib/paths.js";
import { isAllowedUpload } from "../lib/security.js";
import { logAudit } from "../lib/audit.js";

export async function employeeRoutes(app: FastifyInstance) {
  app.get("/api/employees", { preHandler: [authenticate, requirePermission("employees")] }, async () => {
    const items = await prisma.employee.findMany({
      orderBy: { created_at: "desc" },
      include: { _count: { select: { constancias: true } } },
    });
    return { items };
  });

  app.post("/api/employees", { preHandler: [authenticate, requirePermission("employees")] }, async (req, reply) => {
    const { name, position, email } = (req.body as any) || {};
    if (!name) return reply.code(400).send({ error: "name required" });
    const employee = await prisma.employee.create({
      data: { name, position: position || null, email: email || null },
    });
    await logAudit(req, "employee.created", "employee", employee.id, { name });
    return employee;
  });

  app.get("/api/employees/:id", { preHandler: [authenticate, requirePermission("employees")] }, async (req, reply) => {
    const { id } = req.params as any;
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { constancias: { orderBy: { created_at: "desc" } } },
    });
    if (!employee) return reply.code(404).send({ error: "not found" });
    return employee;
  });

  app.delete("/api/employees/:id", { preHandler: [authenticate, adminOnly] }, async (req, reply) => {
    const { id } = req.params as any;
    try {
      await prisma.employee.delete({ where: { id } });
      await logAudit(req, "employee.deleted", "employee", id);
      return { ok: true };
    } catch {
      return reply.code(404).send({ error: "not found" });
    }
  });

  app.post("/api/employees/import", { preHandler: [authenticate, adminOnly] }, async (req: any, reply) => {
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
      const name = String(row["Nombre"] || row["nombre"] || row["Name"] || row["name"] || "").trim();
      const position = String(row["Puesto"] || row["puesto"] || row["Position"] || row["position"] || "").trim();
      const email = String(row["Email"] || row["email"] || row["Correo"] || row["correo"] || "").trim();
      if (!name) {
        errors.push(`Fila ${i + 2}: nombre vacío`);
        continue;
      }
      try {
        await prisma.employee.create({ data: { name, position: position || null, email: email || null } });
        created++;
      } catch (e: any) {
        errors.push(`Fila ${i + 2}: ${e.message || "error"}`);
      }
    }
    await logAudit(req, "employee.imported", "employee", undefined, { created, total: rows.length, errors: errors.length });
    return { created, total: rows.length, errors };
  });

  app.get("/api/employees/:id/constancias", { preHandler: [authenticate, requirePermission("employees")] }, async (req) => {
    const { id } = req.params as any;
    const items = await prisma.constancia.findMany({
      where: { employee_id: id },
      orderBy: { created_at: "desc" },
    });
    return { items };
  });

  app.post("/api/employees/:id/constancias", { preHandler: [authenticate, requirePermission("employees")] }, async (req: any, reply) => {
    const { id } = req.params;
    const employee = await prisma.employee.findUnique({ where: { id }, select: { id: true } });
    if (!employee) return reply.code(404).send({ error: "employee not found" });

    let title = "";
    let description = "";
    let filePath: string | null = null;
    let fileName: string | null = null;

    for await (const part of req.parts()) {
      if (part.type === "file") {
        if (!isAllowedUpload(part.filename)) {
          return reply.code(400).send({ error: "file type not allowed" });
        }
        const ext = path.extname(part.filename || "").toLowerCase();
        const stored = randomUUID() + ext;
        await pump(part.file, fs.createWriteStream(path.join(uploadsDir, stored)));
        filePath = stored;
        fileName = part.filename || stored;
      } else if (part.fieldname === "title") {
        title = String(part.value || "");
      } else if (part.fieldname === "description") {
        description = String(part.value || "");
      }
    }

    if (!title) return reply.code(400).send({ error: "title required" });

    const created = await prisma.constancia.create({
      data: { employee_id: id, title, description: description || null, file_path: filePath, file_name: fileName },
    });
    await logAudit(req, "constancia.created", "constancia", created.id, { employee_id: id, title });
    return created;
  });

  app.delete("/api/constancias/:id", { preHandler: [authenticate, adminOnly] }, async (req, reply) => {
    const { id } = req.params as any;
    const constancia = await prisma.constancia.findUnique({ where: { id } });
    if (!constancia) return reply.code(404).send({ error: "not found" });
    if (constancia.file_path) {
      const fullPath = path.join(uploadsDir, constancia.file_path);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }
    await prisma.constancia.delete({ where: { id } });
    await logAudit(req, "constancia.deleted", "constancia", id);
    return { ok: true };
  });
}
