import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";
import { db } from "../db/client.js";
import { roleRepository, userRepository } from "../db/repositories/index.js";
import { z } from 'zod';
import { toHttpError } from '../lib/errors.js';
import { authenticate, requirePermission, signToken } from "../lib/auth.js";
import { getRolePermissions } from "../lib/permissions.js";
import { validatePassword } from "../lib/security.js";
import { logAudit } from "../lib/audit.js";
import {
  BLOCK_MINUTES,
  clearLoginFailures,
  getActiveBlock,
  loginIdentifiers,
  registerLoginFailure,
} from "../lib/loginGuard.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const registerSchema = z.object({ username: z.string().min(1), password: z.string().min(1), email: z.string().optional().nullable(), role: z.string().optional() });
const loginSchema = z.object({ password: z.string().min(1), username: z.string().optional() });
const twoFactorCompleteSchema = z.object({ tempToken: z.string().min(1), code: z.string().min(1) });
const codeSchema = z.object({ code: z.union([z.string(), z.number()]).optional() });
const disableSchema = z.object({ password: z.union([z.string(), z.number()]).optional(), code: z.union([z.string(), z.number()]).optional() });

function cookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: (isProduction ? "strict" : "lax") as "strict" | "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  };
}

export async function authRoutes(app: FastifyInstance) {
  app.setErrorHandler((error, _request, reply) => { const mapped = toHttpError(error); return reply.code(mapped.statusCode).send(mapped.body); });
  app.post("/api/auth/register", {
    preHandler: [authenticate, requirePermission("users")],
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const parsed = registerSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "username and password required" });
    }
    const { username, password, email, role } = parsed.data;
    const passwordError = validatePassword(password);
    if (passwordError) return reply.code(400).send({ error: passwordError });

    const roleName = String(role || "user");
    const roleExists = await roleRepository.findByName(db, roleName);
    if (!roleExists) return reply.code(400).send({ error: "role does not exist" });
    if (roleName === "admin" && req.user.role !== "admin") {
      return reply.code(403).send({ error: "only admins can assign the admin role" });
    }

    const exists = await userRepository.findByUsername(db, username);
    if (exists) return reply.code(409).send({ error: "username already exists" });
    const hash = await bcrypt.hash(password, 10);
    let user;
    try {
      user = await userRepository.create(db, { username, email: email || null, password: hash, role: roleName });
    } catch (error: any) {
      if (error.code === '23505' || error.cause?.code === '23505') return reply.code(409).send({ error: 'username already exists' });
      throw error;
    }
    await logAudit(req, "user.created", "user", user.id, { username, role: roleName });
    const token = signToken(user);
    const permissions = await getRolePermissions(user.role);
    return {
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role, permissions, two_factor_enabled: user.two_factor_enabled },
    };
  });

  app.post("/api/auth/login", {
    config: { rateLimit: { max: 8, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body || {});
    if (!parsed.success) return reply.code(400).send({ error: "password required" });
    const { password, username } = parsed.data;

    const identifiers = loginIdentifiers(req.ip, username);
    const block = await getActiveBlock(identifiers);
    if (block) {
      return reply
        .code(429)
        .header("Retry-After", String(block.retryAfterSeconds))
        .send({
          error: `Demasiados intentos fallidos. Intenta de nuevo en ${Math.ceil(block.retryAfterSeconds / 60)} minuto(s).`,
          blocked_until: block.until.toISOString(),
          retry_after_seconds: block.retryAfterSeconds,
        });
    }

    const candidates = await userRepository.listForLogin(db, username);
    candidates.sort((a, b) => (a.role === "admin" ? -1 : b.role === "admin" ? 1 : 0));

    let matched: (typeof candidates)[number] | null = null;
    for (const user of candidates) {
      if (await bcrypt.compare(password, user.password)) {
        matched = user;
        break;
      }
    }
    if (!matched) {
      const blocked = await registerLoginFailure(identifiers);
      await logAudit(req, "login.failed", "user", undefined, { username: username || null });
      if (blocked) {
        return reply
          .code(429)
          .header("Retry-After", String(BLOCK_MINUTES * 60))
          .send({
            error: `Demasiados intentos fallidos. Acceso bloqueado por ${BLOCK_MINUTES} minuto(s).`,
            retry_after_seconds: BLOCK_MINUTES * 60,
          });
      }
      return reply.code(401).send({ error: "invalid credentials" });
    }

    await clearLoginFailures(identifiers);
    const permissions = await getRolePermissions(matched.role);
    await logAudit(req, "login.success", "user", matched.id, { username: matched.username });

    if (matched.two_factor_enabled) {
      const tempToken = jwt.sign(
        { sub: matched.id, username: matched.username, role: matched.role, purpose: "2fa" },
        JWT_SECRET,
        { expiresIn: "5m" }
      );
      return { requires2fa: true, tempToken, user: { id: matched.id, username: matched.username, role: matched.role } };
    }

    const token = signToken(matched);
    reply.setCookie("token", token, cookieOptions());
    return {
      token,
      user: { id: matched.id, username: matched.username, email: matched.email, role: matched.role, permissions, two_factor_enabled: matched.two_factor_enabled },
    };
  });

  app.post("/api/auth/2fa/complete", async (req, reply) => {
    const parsed = twoFactorCompleteSchema.safeParse(req.body || {});
    if (!parsed.success) return reply.code(400).send({ error: "tempToken and code required" });
    const { tempToken, code } = parsed.data;
    let payload: any;
    try {
      payload = jwt.verify(tempToken, JWT_SECRET) as any;
    } catch {
      return reply.code(401).send({ error: "invalid or expired temp token" });
    }
    const user = await userRepository.findById(db, payload.sub);
    if (!user || !user.two_factor_enabled || !user.totp_secret) {
      return reply.code(401).send({ error: "2fa not enabled" });
    }
    const valid = verifySync({ token: String(code), secret: user.totp_secret }).valid;
    if (!valid) return reply.code(401).send({ error: "invalid 2fa code" });

    const token = signToken(user);
    reply.setCookie("token", token, cookieOptions());
    const permissions = await getRolePermissions(user.role);
    await logAudit({ user: { id: user.id, username: user.username, role: user.role }, ip: req.ip }, "login.2fa.success", "user", user.id);
    return {
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role, permissions, two_factor_enabled: user.two_factor_enabled },
    };
  });

  app.post("/api/auth/logout", async (_req, reply) => {
    reply.clearCookie("token", { path: "/" });
    return { ok: true };
  });

  app.get("/api/auth/me", { preHandler: authenticate }, async (req) => {
    const dbUser = await userRepository.findById(db, req.user.id);
    const permissions = await getRolePermissions(req.user.role);
    return { ...req.user, email: dbUser?.email, two_factor_enabled: dbUser?.two_factor_enabled ?? false, permissions };
  });

  // ---- 2FA management ----
  app.post("/api/auth/2fa/setup", { preHandler: authenticate }, async (req) => {
    const secret = generateSecret();
    await userRepository.update(db, req.user.id, { totp_secret: secret, two_factor_enabled: false });
    await logAudit(req, "2fa.setup", "user", req.user.id);
    const otpauth = generateURI({ label: req.user.username, issuer: "Inventario", secret });
    const qr = await QRCode.toDataURL(otpauth);
    return { secret, otpauth, qr };
  });

  app.post("/api/auth/2fa/verify", { preHandler: authenticate }, async (req, reply) => {
    const parsed = codeSchema.safeParse(req.body || {});
    const { code } = parsed.success ? parsed.data : {};
    const user = await userRepository.findById(db, req.user.id);
    if (!user?.totp_secret) return reply.code(400).send({ error: "2fa not set up" });
    const valid = verifySync({ token: String(code), secret: user.totp_secret }).valid;
    if (!valid) return reply.code(400).send({ error: "invalid 2fa code" });
    await userRepository.update(db, req.user.id, { two_factor_enabled: true });
    await logAudit(req, "2fa.enabled", "user", req.user.id);
    return { ok: true };
  });

  app.post("/api/auth/2fa/disable", { preHandler: authenticate }, async (req, reply) => {
    const parsed = disableSchema.safeParse(req.body || {});
    const { password, code } = parsed.success ? parsed.data : {};
    const user = await userRepository.findById(db, req.user.id);
    if (!user) return reply.code(404).send({ error: "not found" });
    if (!password || !(await bcrypt.compare(String(password), user.password))) {
      return reply.code(401).send({ error: "invalid password" });
    }
    if (user.two_factor_enabled && user.totp_secret) {
      if (!code || !verifySync({ token: String(code), secret: user.totp_secret }).valid) {
        return reply.code(400).send({ error: "invalid 2fa code" });
      }
    }
    await userRepository.update(db, req.user.id, { totp_secret: null, two_factor_enabled: false });
    await logAudit(req, "2fa.disabled", "user", req.user.id);
    return { ok: true };
  });
}
