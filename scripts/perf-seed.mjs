import "dotenv/config";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const id = () => `c${randomBytes(12).toString("hex")}`;

const SKU = "PERF-HIST";
const TOTAL_HISTORY = 24719;
const BATCH = 1000;

async function main() {
  console.log("Seeding performance data...");
  const product = (await pool.query(`INSERT INTO "Product" (id,sku,name,location,quantity,min_stock,updated_at) VALUES ($1,$2,$3,$4,1,0,NOW()) ON CONFLICT (sku) DO UPDATE SET name=EXCLUDED.name,location=EXCLUDED.location,quantity=EXCLUDED.quantity,updated_at=NOW() RETURNING id`, [id(), SKU, "Producto de rendimiento", "Bodega"])).rows[0];

  await pool.query('DELETE FROM "LocationHistory" WHERE product_id=$1', [product.id]);

  const now = Date.now();
  let inserted = 0;
  for (let start = 0; start < TOTAL_HISTORY; start += BATCH) {
    const size = Math.min(BATCH, TOTAL_HISTORY - start);
    const rows = Array.from({ length: size }, (_, index) => {
      const i = start + index;
      const target = i % 3 === 0 ? "Archivo" : i % 3 === 1 ? "Bodega" : "admin";
      return [id(), product.id,
        i % 3 === 0 ? "Bodega" : i % 3 === 1 ? "admin" : "Archivo",
        target, `perf${(i % 10) + 1}`, new Date(now - i * 60_000)];
    });
    const values = rows.map((_, i) => `($${i * 6 + 1},$${i * 6 + 2},$${i * 6 + 3},$${i * 6 + 4},$${i * 6 + 5},$${i * 6 + 6})`).join(",");
    await pool.query(`INSERT INTO "LocationHistory" (id,product_id,from_location,to_location,changed_by,created_at) VALUES ${values}`, rows.flat());
    inserted += size;
    if (inserted % 5000 === 0 || inserted === TOTAL_HISTORY) {
      console.log(`  history ${inserted}/${TOTAL_HISTORY}`);
    }
  }

  for (let i = 1; i <= 10; i++) {
    const username = `perf${String(i).padStart(2, "0")}`;
    const password = `perfpass${String(i).padStart(2, "0")}`;
    const existing = await pool.query('SELECT 1 FROM "User" WHERE username=$1', [username]);
    if (!existing.rowCount) {
      await pool.query('INSERT INTO "User" (id,username,password,role) VALUES ($1,$2,$3,$4)', [id(), username, await bcrypt.hash(password, 10), "user"]);
    }
    const employeeName = `PERF Empleado ${String(i).padStart(2, "0")}`;
    const employee = await pool.query('SELECT 1 FROM "Employee" WHERE name=$1 LIMIT 1', [employeeName]);
    if (!employee.rowCount) await pool.query('INSERT INTO "Employee" (id,name,position,email) VALUES ($1,$2,$3,$4)', [id(), employeeName, "Operador", `${username}@perf.local`]);
  }

  const [history, employees, users] = await Promise.all([
    pool.query('SELECT count(*)::int AS count FROM "LocationHistory" WHERE product_id=$1', [product.id]),
    pool.query('SELECT count(*)::int AS count FROM "Employee"'),
    pool.query('SELECT count(*)::int AS count FROM "User"'),
  ]);

  console.log(`Done. history=${history.rows[0].count}, employees=${employees.rows[0].count}, users=${users.rows[0].count}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => { await pool.end(); });
