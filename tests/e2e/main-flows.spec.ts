import { expect, test } from "@playwright/test";

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
