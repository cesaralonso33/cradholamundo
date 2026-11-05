const BASE = process.env.API_BASE || "http://localhost:3000";
const USERS = 10;
const REQUESTS_PER_USER = 60;
const SKU = "PERF-HIST";
const DEEP_PAGE = Math.ceil(24719 / 20);

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index];
}

async function login(password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error(`login ${password} -> ${res.status}`);
  return (await res.json()).token;
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

async function timed(name, url, token) {
  const start = performance.now();
  const res = await fetch(url, { headers: auth(token) });
  const elapsed = performance.now() - start;
  if (!res.ok) throw new Error(`${name} -> HTTP ${res.status}`);
  await res.arrayBuffer();
  return elapsed;
}

async function main() {
  console.log("Logging in 10 performance users...");
  const tokens = [];
  for (let i = 1; i <= USERS; i++) {
    tokens.push(await login(`perfpass${String(i).padStart(2, "0")}`));
  }
  const admin = await login("admin123");

  // Warmup
  await timed("warmup", `${BASE}/api/products?page=1&pageSize=20`, tokens[0]);
  await timed("warmup-history", `${BASE}/api/products/${SKU}/history?page=1&pageSize=20`, tokens[0]);

  const all = [];
  const byName = new Map();
  const errors = [];
  const started = performance.now();

  await Promise.all(
    tokens.map(async (token) => {
      for (let i = 0; i < REQUESTS_PER_USER; i++) {
        const kind = i % 5;
        let name;
        let url;
        if (kind === 0) {
          name = "products:list";
          url = `${BASE}/api/products?page=1&pageSize=20`;
        } else if (kind === 1) {
          name = "history:page1";
          url = `${BASE}/api/products/${SKU}/history?page=1&pageSize=20`;
        } else if (kind === 2) {
          name = "history:deep";
          const page = 1 + Math.floor(Math.random() * DEEP_PAGE);
          url = `${BASE}/api/products/${SKU}/history?page=${page}&pageSize=20`;
        } else if (kind === 3) {
          name = "papeleria:items";
          url = `${BASE}/api/papeleria`;
        } else {
          name = "papeleria:orders";
          url = `${BASE}/api/papeleria/orders`;
        }
        try {
          const elapsed = await timed(name, url, token);
          all.push(elapsed);
          if (!byName.has(name)) byName.set(name, []);
          byName.get(name).push(elapsed);
        } catch (error) {
          errors.push(error.message);
        }
      }
      // Simulate admin reviewing dashboard every cycle.
      try {
        const elapsed = await timed("employees:list", `${BASE}/api/employees`, admin);
        all.push(elapsed);
        if (!byName.has("employees:list")) byName.set("employees:list", []);
        byName.get("employees:list").push(elapsed);
      } catch (error) {
        errors.push(error.message);
      }
    })
  );

  const duration = performance.now() - started;
  const avg = all.reduce((a, b) => a + b, 0) / all.length;
  const totalRequests = all.length + errors.length;

  console.log("\n=== Resultados de la prueba de rendimiento ===");
  console.log(`Usuarios concurrentes: ${USERS}`);
  console.log(`Solicitudes medidas:    ${totalRequests}`);
  console.log(`Duración:               ${(duration / 1000).toFixed(2)} s`);
  console.log(`Throughput:             ${(totalRequests / (duration / 1000)).toFixed(1)} req/s`);
  console.log(`Errores:                ${errors.length}`);
  console.log(`Latencia promedio:      ${avg.toFixed(2)} ms`);
  console.log(`P50:                    ${percentile(all, 50).toFixed(2)} ms`);
  console.log(`P95:                    ${percentile(all, 95).toFixed(2)} ms`);
  console.log(`P99:                    ${percentile(all, 99).toFixed(2)} ms`);
  console.log(`Máxima:                 ${Math.max(...all).toFixed(2)} ms`);

  console.log("\n=== Por endpoint ===");
  for (const [name, values] of byName) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    console.log(
      `${name.padEnd(20)} n=${String(values.length).padStart(4)}  avg=${mean.toFixed(2).padStart(8)} ms  p95=${percentile(values, 95)
        .toFixed(2)
        .padStart(8)} ms  max=${Math.max(...values).toFixed(2).padStart(8)} ms`
    );
  }

  if (errors.length) {
    console.log("\nPrimeros errores:");
    errors.slice(0, 5).forEach((e) => console.log(" -", e));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
