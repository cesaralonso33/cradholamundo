import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SKU = "PERF-HIST";
const TOTAL_HISTORY = 24719;
const BATCH = 1000;

async function main() {
  console.log("Seeding performance data...");
  const product = await prisma.product.upsert({
    where: { sku: SKU },
    update: { name: "Producto de rendimiento", location: "Bodega", quantity: 1 },
    create: { sku: SKU, name: "Producto de rendimiento", location: "Bodega", quantity: 1, min_stock: 0 },
  });

  await prisma.locationHistory.deleteMany({ where: { product_id: product.id } });

  const now = Date.now();
  let inserted = 0;
  for (let start = 0; start < TOTAL_HISTORY; start += BATCH) {
    const size = Math.min(BATCH, TOTAL_HISTORY - start);
    const rows = Array.from({ length: size }, (_, index) => {
      const i = start + index;
      const target = i % 3 === 0 ? "Archivo" : i % 3 === 1 ? "Bodega" : "admin";
      return {
        product_id: product.id,
        from_location: i % 3 === 0 ? "Bodega" : i % 3 === 1 ? "admin" : "Archivo",
        to_location: target,
        changed_by: `perf${(i % 10) + 1}`,
        created_at: new Date(now - i * 60_000),
      };
    });
    await prisma.locationHistory.createMany({ data: rows });
    inserted += size;
    if (inserted % 5000 === 0 || inserted === TOTAL_HISTORY) {
      console.log(`  history ${inserted}/${TOTAL_HISTORY}`);
    }
  }

  for (let i = 1; i <= 10; i++) {
    const username = `perf${String(i).padStart(2, "0")}`;
    const password = `perfpass${String(i).padStart(2, "0")}`;
    const existing = await prisma.user.findUnique({ where: { username } });
    if (!existing) {
      await prisma.user.create({
        data: {
          username,
          password: await bcrypt.hash(password, 10),
          role: "user",
        },
      });
    }
    const employeeName = `PERF Empleado ${String(i).padStart(2, "0")}`;
    const employee = await prisma.employee.findFirst({ where: { name: employeeName } });
    if (!employee) {
      await prisma.employee.create({
        data: { name: employeeName, position: "Operador", email: `${username}@perf.local` },
      });
    }
  }

  const [historyCount, employeeCount, userCount] = await Promise.all([
    prisma.locationHistory.count({ where: { product_id: product.id } }),
    prisma.employee.count(),
    prisma.user.count(),
  ]);

  console.log(`Done. history=${historyCount}, employees=${employeeCount}, users=${userCount}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
