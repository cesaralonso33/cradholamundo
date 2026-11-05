import { expect, test } from "@playwright/test";
import { generateSync } from "otplib";

const password = process.env.E2E_ADMIN_PASSWORD;

test("main screens require a real admin session and remain navigable", async ({ page }) => {
  test.skip(!password, "Set E2E_ADMIN_PASSWORD for the isolated test database.");
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
  await expect(page.getByText("Backend y base de datos conectados")).toBeVisible();
  await page.locator('input[type="password"]').fill(password!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);

  const sku = `E2E-MOV-${Date.now()}`;
  const created = await page.request.post("/api/products", { data: { sku, name: "E2E movement product", quantity: 1 } });
  expect(created.ok()).toBeTruthy();
  await page.reload();
  await page.getByLabel("Producto", { exact: true }).selectOption(sku);
  await page.getByLabel("Tipo de movimiento").selectOption("IN");
  await page.getByLabel("Cantidad", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Registrar movimiento" }).click();
  await expect(page.getByRole("status")).toContainText("Movimiento registrado");
  const moved = await page.request.get(`/api/products/${encodeURIComponent(sku)}`);
  expect((await moved.json()).quantity).toBe(3);

  // These routes exercise inventory/movement, stationery/order, employee/certificate,
  // and settings/backup pages against the running API and isolated PostgreSQL.
  for (const path of ["/", "/papeleria", "/employees", "/settings"]) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path.replace("/", "\\/")}$`));
    await expect(page.locator("body")).not.toContainText("Internal Server Error");
  }
  await expect(page.getByText(/respaldo|backup/i).first()).toBeVisible();
});

test("login rejects invalid input and does not persist a session", async ({ page }) => {
  await page.goto("/login");
  await page.locator('input[type="password"]').fill("invalid-password-for-e2e");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText(/invalid credentials|credenciales|error/i).first()).toBeVisible();
  await expect(page).toHaveURL(/login/);
});

test("protected routes redirect anonymous users to login", async ({ page }) => {
  for (const path of ["/", "/papeleria", "/employees", "/settings"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/login/);
  }
});

test("papeleria order, employee certificate, and secure/sensitive backup restore flows", async ({ page }) => {
  test.skip(!password, "Set E2E_ADMIN_PASSWORD for the isolated test database.");
  await page.goto("/login");
  await page.locator('input[type="password"]').fill(password!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/papeleria");
  await page.getByRole("button", { name: "Catálogo" }).click();
  const itemName = `Artículo E2E ${Date.now()}`;
  const itemForm = page.locator("form").first();
  await itemForm.locator("input").nth(0).fill(itemName);
  await itemForm.getByRole("button", { name: "Agregar" }).click();
  await expect(page.getByText("Artículo agregado.")).toBeVisible();
  await page.getByRole("button", { name: "Pedidos" }).click();
  await page.getByRole("button", { name: "Abrir pedido" }).click();
  const orderDialog = page.getByRole("heading", { name: "Nuevo pedido" }).locator("xpath=../..");
  const quantity = orderDialog.locator('input[type="number"]').first();
  await quantity.fill("1");
  await orderDialog.getByRole("button", { name: "Enviar pedido" }).click();
  await expect(page.getByText(/Pedido enviado con folio/)).toBeVisible();
  const row = page.locator("tbody tr").filter({ hasText: "Pendiente" }).first();
  await page.once("dialog", dialog => dialog.accept());
  await row.getByRole("button", { name: "Cerrar" }).click();
  await expect(page.getByText("Pedido cerrado y entregado.")).toBeVisible();
  await expect(page.locator("tbody tr").filter({ hasText: "Cerrado" }).first()).toBeVisible();

  await page.goto("/employees");
  const employeeName = `E2E empleado ${Date.now()}`;
  const form = page.locator("form").first();
  await form.locator("input").nth(0).fill(employeeName);
  await form.getByRole("button", { name: "Crear" }).click();
  await expect(page.getByText("Empleado creado.")).toBeVisible();
  const employeeRow = page.locator("tbody tr").filter({ hasText: employeeName });
  await employeeRow.getByRole("button", { name: "Constancias" }).click();
  const certificateForm = page.locator("form").last();
  await certificateForm.locator("input").nth(0).fill("Constancia E2E");
  await page.locator('input[type="file"]').last().setInputFiles({ name: "constancia-e2e.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\nE2E") });
  await page.getByRole("button", { name: "Subir constancia" }).click();
  await expect(page.getByText("Constancia subida.")).toBeVisible();
  await expect(page.getByText("constancia-e2e.pdf")).toBeVisible();

  await page.goto("/settings");
  const safeDownload = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Descargar respaldo seguro" }).click(),
  ]).then(([download]) => download);
  const safePath = await safeDownload.path();
  const safeText = await (await import("node:fs/promises")).readFile(safePath!, "utf8");
  expect(safeText).not.toMatch(/password|totp_secret/i);

  const sensitiveButton = page.getByRole("button", { name: "Descargar respaldo completo sensible" });
  await expect(sensitiveButton).toBeDisabled();
  await page.getByRole("checkbox", { name: /Confirmo que entiendo/ }).check();
  const sensitiveDownload = await Promise.all([
    page.waitForEvent("download"), sensitiveButton.click(),
  ]).then(([download]) => download);
  const sensitivePath = await sensitiveDownload.path();
  const sensitiveText = await (await import("node:fs/promises")).readFile(sensitivePath!, "utf8");
  const sensitive = JSON.parse(sensitiveText);
  expect(sensitiveText).toMatch(/password/);
  expect(sensitiveText).toMatch(/totp_secret/);

  // Exercise server-side rejection and rollback through the actual settings upload control.
  const invalid = structuredClone(sensitive);
  const preservedSku = invalid.data.products[0].sku;
  invalid.data.products = [
    { id: "duplicate-restore-id", sku: "invalid-e2e-a", name: "Invalid A", quantity: 1, min_stock: 0 },
    { id: "duplicate-restore-id", sku: "invalid-e2e-b", name: "Invalid B", quantity: 1, min_stock: 0 },
  ];
  page.once("dialog", dialog => dialog.accept());
  await page.locator('input[type="file"]').first().setInputFiles({ name: "invalid-backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(invalid)) });
  await expect(page.getByRole("alert")).toBeVisible();
  // Duplicate primary keys fail during insertion, after restore has started deleting rows.
  // The old product must remain, proving the PostgreSQL transaction rolled back.
  expect((await page.request.get(`/api/products/${encodeURIComponent(preservedSku)}`)).status()).toBe(200);

  page.once("dialog", dialog => dialog.accept());
  await page.locator('input[type="file"]').first().setInputFiles({ name: "sensitive-backup.json", mimeType: "application/json", buffer: Buffer.from(sensitiveText) });
  await expect(page.getByRole("status")).toContainText("Respaldo restaurado correctamente.");
  const restored = await page.request.get("/api/backup?includeSensitive=true");
  expect(restored.ok()).toBeTruthy();
  expect(JSON.stringify(await restored.json())).toContain("admin");
});

test("limited account hides and redirects restricted pages and API denies access", async ({ page }) => {
  test.skip(!password, "Set E2E_ADMIN_PASSWORD for the isolated test database.");
  await page.goto("/login");
  await page.locator('input[type="password"]').fill(password!);
  const loginResponsePromise = page.waitForResponse((response) => response.url().endsWith("/api/auth/login"));
  await page.getByRole("button", { name: "Entrar" }).click();
  const loginResponse = await loginResponsePromise;
  const loginBody = await loginResponse.text();
  const loginCookies = await page.context().cookies();
  expect(loginResponse.ok(), `Admin login failed: status=${loginResponse.status()} body=${loginBody}; cookies=${JSON.stringify(loginCookies.map(({ name, httpOnly }) => ({ name, httpOnly })))}`).toBeTruthy();
  await expect(page).toHaveURL(/\/$/, { message: `Login did not leave /login: status=${loginResponse.status()} body=${loginBody}; cookies=${JSON.stringify(loginCookies.map(({ name, httpOnly }) => ({ name, httpOnly })))}` });
  const roleName = `e2e-limited-${Date.now()}`;
  const createRole = await page.evaluate(async (name) => {
    const response = await fetch("/api/roles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, description: "Isolated E2E limited role", permissions: ["products"] }) });
    return { status: response.status, body: await response.text() };
  }, roleName);
  expect(createRole.status >= 200 && createRole.status < 300, `POST /api/roles failed: status=${createRole.status} body=${createRole.body}; login=${loginResponse.status()} ${loginBody}; cookies=${JSON.stringify(loginCookies.map(({ name, httpOnly }) => ({ name, httpOnly })))}`).toBeTruthy();
  const register = await page.evaluate(async (name) => {
    const response = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: name, password: "E2eLimitedPass123!", role: name }) });
    return { status: response.status, body: await response.text() };
  }, roleName);
  expect(register.status >= 200 && register.status < 300, `POST /api/auth/register failed: status=${register.status} body=${register.body}`).toBeTruthy();
  await page.evaluate(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    localStorage.removeItem("inv_user");
    localStorage.removeItem("inv_token");
  });
  await page.goto("/login");
  await page.locator('input[type="password"]').fill("E2eLimitedPass123!");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/users");
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/$/);
  const usersStatus = await page.evaluate(async () => (await fetch("/api/users")).status);
  expect(usersStatus).toBe(403);
  expect((await page.request.get("/api/backup")).status()).toBe(403);
  expect((await page.request.post("/api/backup/restore", { data: {} })).status()).toBe(403);
});

test("real browser setup, 2FA login cookie, and disable flow", async ({ page }) => {
  test.skip(!password, "Set E2E_ADMIN_PASSWORD for the isolated test database.");
  await page.goto("/login");
  await page.locator('input[type="password"]').fill(password!);
  const loginResponsePromise = page.waitForResponse((response) => response.url().endsWith("/api/auth/login"));
  await page.getByRole("button", { name: "Entrar" }).click();
  const loginResponse = await loginResponsePromise;
  expect(loginResponse.ok(), `Admin login failed: status=${loginResponse.status()} body=${await loginResponse.text()}`).toBeTruthy();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/settings");
  await page.getByRole("button", { name: "Activar 2FA" }).click();
  const secret = (await page.locator("p").filter({ hasText: "Clave manual:" }).locator("code").textContent())!.trim();
  await page.locator('input[inputmode="numeric"]').fill(generateSync({ secret }));
  await page.getByRole("button", { name: "Verificar y activar" }).click();
  await expect(page.getByText("2FA activado correctamente.")).toBeVisible();

  await page.request.post("/api/auth/logout");
  await page.evaluate(() => { localStorage.removeItem("inv_user"); localStorage.removeItem("inv_token"); });
  await page.goto("/login");
  await expect(page).toHaveURL(/login/);
  await page.locator('input[type="password"]').fill(password!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText(/Ingresa el código de verificación/)).toBeVisible();
  await page.locator('input[inputmode="numeric"]').fill(generateSync({ secret }));
  await page.getByRole("button", { name: "Verificar" }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => document.cookie)).not.toMatch(/(?:^|; )token=/);
  expect((await page.request.get("/api/auth/me")).ok()).toBeTruthy();

  await page.goto("/settings");
  await page.locator('input[type="password"]').fill(password!);
  await page.locator('input[inputmode="numeric"]').fill(generateSync({ secret }));
  await page.getByRole("button", { name: "Desactivar 2FA" }).click();
  await expect(page.getByText("2FA desactivado.")).toBeVisible();
  await page.request.post("/api/auth/logout");
  await page.evaluate(() => { localStorage.removeItem("inv_user"); localStorage.removeItem("inv_token"); });
  await page.goto("/login");
  await expect(page).toHaveURL(/login/);
  await page.locator('input[type="password"]').fill(password!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
});
