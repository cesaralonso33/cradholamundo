import Fastify from "fastify";
import bcrypt from "bcryptjs";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import compress from "@fastify/compress";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import staticFiles from "@fastify/static";
import { prisma } from "./lib/prisma.js";
import { uploadsDir } from "./lib/paths.js";
import { ALL_PERMISSIONS, DEFAULT_USER_PERMISSIONS } from "./lib/permissions.js";
import { authRoutes } from "./routes/auth.js";
import { userRoutes } from "./routes/users.js";
import { productRoutes } from "./routes/products.js";
import { employeeRoutes } from "./routes/employees.js";
import { papeleriaRoutes } from "./routes/papeleria.js";
import { settingsRoutes } from "./routes/settings.js";
import { backupRoutes } from "./routes/backup.js";
import { roleRoutes } from "./routes/roles.js";
import { auditRoutes } from "./routes/audit.js";

const seedItems = [
  "PERFORADORA DE UN SOLO AGUJERO",
  "REGLA METALICA",
  "BOLSAS PARA BASURA",
  "ESCOBA",
  "MARCATEXTOS",
  "IMPRESORA",
  "CLORO",
  "GEL ANTIBACTERIAL",
  "JABON LIQUIDO PARA MANOS",
  "LIMPIADOR MULTIUSOS",
  "PAPEL HIGIENICO",
  "PAÑUELOS DESECHABLES",
  "TAPETE LIMPIAPIES",
];

async function seedAdmin() {
  const count = await prisma.user.count();
  if (count > 0) return;
  const password = process.env.ADMIN_PASSWORD;
  if (!password && process.env.NODE_ENV === "production") {
    throw new Error("ADMIN_PASSWORD is required to create the initial admin user in production.");
  }
  await prisma.user.create({
    data: {
      username: "admin",
      password: await bcrypt.hash(password || "admin123", 10),
      role: "admin",
    },
  });
}

async function seedRoles() {
  await prisma.role.upsert({
    where: { name: "admin" },
    update: { permissions: [...ALL_PERMISSIONS] },
    create: {
      name: "admin",
      description: "Administrador con acceso total",
      permissions: [...ALL_PERMISSIONS],
    },
  });
  await prisma.role.upsert({
    where: { name: "user" },
    update: {},
    create: {
      name: "user",
      description: "Usuario operativo",
      permissions: [...DEFAULT_USER_PERMISSIONS],
    },
  });
}

async function seedPapeleria() {
  const count = await prisma.papeleriaItem.count();
  if (count > 0) return;
  await prisma.papeleriaItem.createMany({
    data: seedItems.map((name) => ({ name, unit: "PIEZA", quantity: 0 })),
    skipDuplicates: true,
  });
}

export async function buildApp() {
  if (process.env.NODE_ENV === "production") {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32 || secret === "change-me-in-production") {
      throw new Error("JWT_SECRET must be set to a strong value (32+ characters) in production.");
    }
  }

  const app = Fastify({ logger: true, bodyLimit: 2 * 1024 * 1024, trustProxy: true });

  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
    : process.env.NODE_ENV === "production"
      ? false
      : true;

  await app.register(cors, {
    origin: corsOrigins,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  });
  await app.register(cookie, {
    secret: process.env.COOKIE_SECRET || process.env.JWT_SECRET || "dev-cookie-secret",
    parseOptions: { path: "/", httpOnly: true, sameSite: "lax", secure: false },
  });
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });
  await app.register(rateLimit, {
    global: true,
    max: 1000,
    timeWindow: "1 minute",
  });
  await app.register(compress, { global: true, encodings: ["br", "gzip", "deflate"] });
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
  await app.register(staticFiles, {
    root: uploadsDir,
    prefix: "/uploads/",
    maxAge: "1d",
    immutable: true,
  });

  const healthHandler = async (_req: any, reply: any) => {
    const timestamp = new Date().toISOString();
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { ok: true, backend: "up", database: "up", timestamp };
    } catch (error: any) {
      app.log.error(error);
      return reply.code(503).send({
        ok: false,
        backend: "up",
        database: "down",
        error: error?.message || "database connection failed",
        hint: "Revisa DATABASE_URL, que PostgreSQL esté corriendo y que las credenciales sean correctas.",
        timestamp,
      });
    }
  };

  app.get("/health", healthHandler);
  app.get("/api/health", healthHandler);

  await app.register(authRoutes);
  await app.register(userRoutes);
  await app.register(productRoutes);
  await app.register(employeeRoutes);
  await app.register(papeleriaRoutes);
  await app.register(settingsRoutes);
  await app.register(backupRoutes);
  await app.register(roleRoutes);
  await app.register(auditRoutes);

  await seedPapeleria();
  await seedRoles();
  await seedAdmin();
  return app;
}
