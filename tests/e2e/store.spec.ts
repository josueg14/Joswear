import { test, expect } from "@playwright/test";
test("catálogo, selección de talla, bolsa persistente y checkout de práctica", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "TU RITMO.",
  );
  await page
    .getByRole("link", { name: "EXPLORAR LA COLECCIÓN", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Vestí a tu manera.",
  );
  await page
    .getByRole("link", { name: "Ver Hoodie Essential", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "AÑADIR A LA BOLSA" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "M Carbón", exact: true }).click();
  await page.getByRole("button", { name: "AÑADIR A LA BOLSA" }).click();
  await expect(page.getByRole("status")).toContainText("añadido");
  await page.goto("/carrito");
  await expect(
    page.getByRole("heading", { name: "Hoodie Essential" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Hoodie Essential" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "CONTINUAR", exact: true }).click();
  await page.getByLabel("Nombre completo").fill("Cliente Demostración");
  await page.getByLabel("Correo electrónico").fill("demo@example.test");
  await page.getByLabel("Teléfono", { exact: true }).fill("88888888");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "PROBAR CHECKOUT" }).click();
  await expect(
    page.getByText("Simulación finalizada.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "ABRIR WHATSAPP" })).toHaveCount(
    0,
  );
});
test("favoritos, filtros y estado vacío", async ({ page }) => {
  await page.goto("/tienda");
  await page
    .getByRole("button", {
      name: "Añadir a favoritos: Hoodie Essential",
      exact: true,
    })
    .click();
  await page.goto("/favoritos");
  await expect(
    page.getByRole("heading", { name: "Hoodie Essential", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Quitar de favoritos: Hoodie Essential",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Tus próximos favoritos empiezan acá." }),
  ).toBeVisible();
  await page.goto("/tienda");
  await page.getByRole("button", { name: "Filtros", exact: true }).click();
  await page.getByLabel("Buscar prenda").fill("NoExiste");
  await expect(
    page.getByRole("heading", {
      name: "Todavía no hay prendas con esos filtros.",
    }),
  ).toBeVisible();
});
test("navegación móvil sin desbordamiento y menú accesible", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile");
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await expect(
    page.getByRole("navigation", { name: "Navegación móvil" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Abrir menú" })).toBeFocused();
});
test("API rechaza mutaciones de otro origen", async ({ request }) => {
  const r = await request.post("/api/checkout", {
    headers: { origin: "https://evil.test" },
    data: {},
  });
  expect(r.status()).toBe(403);
  const health = await request.get("/api/health");
  expect((await health.json()).status).toBe("preview");
});
