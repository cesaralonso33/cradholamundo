import jwt from "jsonwebtoken";
import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "./prisma.js";
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
    const admin = await prisma.user.findFirst({
      where: { role: "admin" },
      select: { id: true, username: true, role: true },
    });
    if (!admin) return reply.code(401).send({ error: "no admin user" });
    req.user = admin;
    return;
  }

  const token = req.cookies?.token || (req.headers.authorization || "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return reply.code(401).send({ error: "missing token" });
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, username: true, role: true },
    });
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
