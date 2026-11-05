import type { FastifyInstance } from 'fastify';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { z } from 'zod';
import { db } from '../db/client.js';
import { constanciaRepository, employeeRepository } from '../db/repositories/index.js';
import { adminOnly, authenticate, requirePermission } from '../lib/auth.js';
import { toHttpError } from '../lib/errors.js';
import { readExcelRows } from '../lib/excel.js';
import { uploadsDir } from '../lib/paths.js';
import { isAllowedUpload } from '../lib/security.js';
import { logAudit } from '../lib/audit.js';

const idParams = z.object({ id: z.string().min(1) });
const employeeBody = z.object({ name: z.string().min(1), position: z.string().nullable().optional(), email: z.string().nullable().optional() });
const parseId = (value: unknown) => idParams.parse(value).id;

export async function employeeRoutes(app: FastifyInstance) {
  const guarded = [authenticate, requirePermission('employees')];
  app.get('/api/employees', { preHandler: guarded }, async () => {
    const items = await employeeRepository.list(db);
    return { items: await Promise.all(items.map(async item => ({ ...item, _count: { constancias: (await employeeRepository.constancias(db, item.id)).length } }))) };
  });
  app.post('/api/employees', { preHandler: guarded }, async (req, reply) => {
    try {
      if (!(req.body as any)?.name) return reply.code(400).send({ error: 'name required' });
      const input = employeeBody.parse(req.body);
      const employee = await employeeRepository.create(db, { name: input.name, position: input.position || null, email: input.email || null });
      await logAudit(req, 'employee.created', 'employee', employee.id, { name: input.name }); return employee;
    } catch (error) { const e = toHttpError(error); return reply.code(e.statusCode).send(e.body); }
  });
  app.get('/api/employees/:id', { preHandler: guarded }, async (req, reply) => {
    try { const id = parseId(req.params); const employee = await employeeRepository.findById(db, id); if (!employee) return reply.code(404).send({ error: 'not found' }); return { ...employee, constancias: await employeeRepository.constancias(db, id) }; }
    catch (error) { const e = toHttpError(error); return reply.code(e.statusCode).send(e.body); }
  });
  app.delete('/api/employees/:id', { preHandler: [authenticate, adminOnly] }, async (req, reply) => {
    try { const id = parseId(req.params); if (!await employeeRepository.delete(db, id)) return reply.code(404).send({ error: 'not found' }); await logAudit(req, 'employee.deleted', 'employee', id); return { ok: true }; }
    catch (error) { const e = toHttpError(error); return reply.code(e.statusCode).send(e.body); }
  });
  app.post('/api/employees/import', { preHandler: [authenticate, adminOnly] }, async (req: any, reply) => {
    const file = await req.file(); if (!file) return reply.code(400).send({ error: 'file required' });
    let rows: any[]; try { rows = await readExcelRows(file); } catch { return reply.code(400).send({ error: 'invalid excel file' }); }
    let created = 0; const errors: string[] = [];
    for (let i = 0; i < rows.length; i++) { const row = rows[i]; const name = String(row.Nombre || row.nombre || row.Name || row.name || '').trim(); const position = String(row.Puesto || row.puesto || row.Position || row.position || '').trim(); const email = String(row.Email || row.email || row.Correo || row.correo || '').trim(); if (!name) { errors.push(`Fila ${i + 2}: nombre vacío`); continue; } try { await employeeRepository.create(db, { name, position: position || null, email: email || null }); created++; } catch (e: any) { errors.push(`Fila ${i + 2}: ${e.message || 'error'}`); } }
    await logAudit(req, 'employee.imported', 'employee', undefined, { created, total: rows.length, errors: errors.length }); return { created, total: rows.length, errors };
  });
  app.get('/api/employees/:id/constancias', { preHandler: guarded }, async (req, reply) => {
    try { const id = parseId(req.params); if (!await employeeRepository.findById(db, id)) return reply.code(404).send({ error: 'employee not found' }); return { items: await employeeRepository.constancias(db, id) }; }
    catch (error) { const e = toHttpError(error); return reply.code(e.statusCode).send(e.body); }
  });
  app.post('/api/employees/:id/constancias', { preHandler: guarded }, async (req: any, reply) => {
    let id: string; try { id = parseId(req.params); } catch (error) { const e = toHttpError(error); return reply.code(e.statusCode).send(e.body); }
    if (!await employeeRepository.findById(db, id)) return reply.code(404).send({ error: 'employee not found' });
    let title = ''; let description = ''; let filePath: string | null = null; let fileName: string | null = null;
    try {
      for await (const part of req.parts()) {
        if (part.type === 'file') { if (!isAllowedUpload(part.filename)) return reply.code(400).send({ error: 'file type not allowed' }); const ext = path.extname(part.filename || '').toLowerCase(); const stored = randomUUID() + ext; await pipeline(part.file, fs.createWriteStream(path.join(uploadsDir, stored))); filePath = stored; fileName = part.filename || stored; }
        else if (part.fieldname === 'title') title = String(part.value || ''); else if (part.fieldname === 'description') description = String(part.value || '');
      }
    } catch { if (filePath) try { fs.unlinkSync(path.join(uploadsDir, filePath)); } catch {} return reply.code(400).send({ error: 'invalid input' }); }
    if (!title) { if (filePath) try { fs.unlinkSync(path.join(uploadsDir, filePath)); } catch {} return reply.code(400).send({ error: 'title required' }); }
    try { const created = await constanciaRepository.create(db, { employee_id: id, title, description: description || null, file_path: filePath, file_name: fileName }); await logAudit(req, 'constancia.created', 'constancia', created.id, { employee_id: id, title }); return created; }
    catch (error) { if (filePath) try { fs.unlinkSync(path.join(uploadsDir, filePath)); } catch {} const e = toHttpError(error); return reply.code(e.statusCode).send(e.body); }
  });
  app.delete('/api/constancias/:id', { preHandler: [authenticate, adminOnly] }, async (req, reply) => {
    try { const id = parseId(req.params); const item = await constanciaRepository.findById(db, id); if (!item) return reply.code(404).send({ error: 'not found' }); if (item.file_path) { const fullPath = path.join(uploadsDir, item.file_path); if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath); } await constanciaRepository.delete(db, id); await logAudit(req, 'constancia.deleted', 'constancia', id); return { ok: true }; }
    catch (error) { const e = toHttpError(error); return reply.code(e.statusCode).send(e.body); }
  });
}
