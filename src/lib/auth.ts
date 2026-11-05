import jwt from "jsonwebtoken";
import { eq } from 'drizzle-orm';
import { users } from '../db/schema.js';
import type { FastifyReply, FastifyRequest } from "fastify";
import { db } from "../db/client.js";
import { userRepository } from "../db/repositories/index.js";
import { validateApiKey } from "./apiKey.js";
import { getRolePermissions } from "./permissions.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export interface AuthUser {
  id: string;
  username: string;
  role: string;
}

declare module "fastify" {
  interface FastifyRequest {
    user: AuthUser;
  }
}

export function signToken(user: { id: string; username: string; role: string }) {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export async function authenticate(req: FastifyRequest, reply: FastifyReply) {
  const apiKey = req.headers["x-api-key"];
  if (typeof apiKey === "string" && apiKey) {
    if (!(await validateApiKey(apiKey))) {
      return reply.code(401).send({ error: "invalid api key" });
    }
    const admin = (await db.select({ id: users.id, username: users.username, role: users.role }).from(users).where(eq(users.role, 'admin')).limit(1))[0];
    if (!admin) return reply.code(401).send({ error: "no admin user" });
    req.user = admin;
    return;
  }

  const token = req.cookies?.token || (req.headers.authorization || "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return reply.code(401).send({ error: "missing token" });
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    const found = await userRepository.findById(db, payload.sub);
    const user = found && { id: found.id, username: found.username, role: found.role };
    if (!user) return reply.code(401).send({ error: "invalid user" });
    req.user = user;
  } catch {
    return reply.code(401).send({ error: "invalid token" });
  }
}

export async function adminOnly(req: FastifyRequest, reply: FastifyReply) {
  if (req.user?.role !== "admin") {
    return reply.code(403).send({ error: "forbidden" });
  }
}

export function requirePermission(permission: string) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.user?.role === "admin") return;
    const permissions = await getRolePermissions(req.user?.role || "user");
    if (!permissions.includes(permission)) {
      return reply.code(403).send({ error: "forbidden" });
    }
  };
}
