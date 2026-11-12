import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createDatabase } from "../../src/lib/db";
import argon2 from "argon2";
import { Secret, TOTP } from "otpauth";
import { encryptSecret } from "../../src/lib/cryptography";
const db = createDatabase();
const run = randomUUID().slice(0, 8);
const password = `Only-Test-${randomUUID()}`;
const secret = new Secret({ size: 20 });
const totp = new TOTP({ secret });
let staffId: string;
test.beforeAll(async () => {
  await db.loginEvent.deleteMany({});
  process.env.MFA_ENCRYPTION_KEY = "d7".repeat(32);
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  await db.adminAccount.create({
    data: {
      username: `owner_${run}`,
      passwordHash,
      role: "SUPER_ADMIN",
      totpEncrypted: encryptSecret(secret.base32),
    },
  });
  staffId = (
    await db.adminAccount.create({
      data: {
        username: `staff_${run}`,
        passwordHash,
        role: "STAFF",
        permissions: { create: { resource: "products", action: "read" } },
      },
    })
  ).id;
});
test.afterAll(async () => {
  const accounts = await db.adminAccount.findMany({
    where: { username: { in: [`owner_${run}`, `staff_${run}`] } },
    select: { id: true },
  });
  const ids = accounts.map((x) => x.id);
  await db.auditLog.deleteMany({ where: { adminId: { in: ids } } });
  await db.adminSession.deleteMany({ where: { accountId: { in: ids } } });
  await db.adminAccount.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});
test("registro, verificación, sesiones y reset de un solo uso", async ({
  request,
}) => {
  const email = `customer-${run}@example.test`;
  const username = `customer_${run}`;
  const register = await request.post("/api/auth/register", {
    data: {
      firstName: "Cliente",
      lastName: "Pruebas",
      email,
      username,
      password,
    },
  });
  expect(register.status()).toBe(201);
  const customer = await db.customer.findUniqueOrThrow({
    where: { email },
    include: { credential: true },
  });
  expect(customer.credential!.hash).toMatch(/^\$argon2id\$/);
  expect(
    (
      await request.post("/api/auth/login", {
        data: { identity: username, password },
      })
    ).status(),
  ).toBe(401);
  const job = await db.emailJob.findUniqueOrThrow({
    where: { key: `verify:${customer.id}` },
  });
  const token = new URL((job.payload as { url: string }).url).searchParams.get(
    "token",
  );
  expect(
    (await request.post("/api/auth/verify", { data: { token } })).status(),
  ).toBe(200);
  expect(
    (await request.post("/api/auth/verify", { data: { token } })).status(),
  ).toBe(400);
  const login = await request.post("/api/auth/login", {
    data: { identity: email, password },
  });
  expect(login.status()).toBe(200);
  expect(login.headers()["set-cookie"]).toContain("HttpOnly");
  expect(login.headers()["set-cookie"]).toContain("SameSite=lax");
  expect(
    (await (await request.get("/api/auth/me")).json()).customer.email,
  ).toBe(email);
  expect((await request.get("/api/admin/customers")).status()).toBe(401);
  const forgot = await request.post("/api/auth/forgot", { data: { email } });
  expect(forgot.status()).toBe(200);
  const resetJob = await db.emailJob.findFirstOrThrow({
    where: { to: email, template: "reset" },
    orderBy: { createdAt: "desc" },
  });
  const resetToken = new URL(
    (resetJob.payload as { url: string }).url,
  ).searchParams.get("token");
  expect(
    (
      await request.post("/api/auth/reset", {
        data: { token: resetToken, password: `${password}-new` },
      })
    ).status(),
  ).toBe(200);
  expect(
    (await (await request.get("/api/auth/me")).json()).customer,
  ).toBeNull();
  expect(
    (
      await request.post("/api/auth/reset", {
        data: { token: resetToken, password: `${password}-again` },
      })
    ).status(),
  ).toBe(400);
});
test("MFA obligatorio, replay rechazado y operaciones de SUPER_ADMIN auditadas", async ({
  request,
}) => {
  expect(
    (
      await request.post("/api/auth/admin-login", {
        data: { identity: `owner_${run}`, password },
      })
    ).status(),
  ).toBe(401);
  const code = totp.generate();
  expect(
    (
      await request.post("/api/auth/admin-login", {
        data: { identity: `owner_${run}`, password, code },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.post("/api/auth/admin-login", {
        data: { identity: `owner_${run}`, password, code },
      })
    ).status(),
  ).toBe(401);
  const category = await request.post("/api/admin/categories", {
    data: { data: { name: "Categoría API", slug: `api-${run}` } },
  });
  expect(category.status()).toBe(200);
  const id = (await category.json()).id;
  expect(
    await db.auditLog.count({
      where: { targetId: id, resource: "categories" },
    }),
  ).toBe(1);
  const productPayload = {
    name: "Prenda API fixture",
    slug: `api-product-${run}`,
    description: "Prenda exclusiva de la base de pruebas",
    price: 14500,
    cost: 9876541,
    categoryId: id,
    published: true,
    featured: true,
    tags: [],
    images: [],
    variants: [{ sku: `API-${run}`, size: "M", color: "Marfil", stock: 1 }],
  };
  const createdProduct = await request.post("/api/admin/products", {
    data: { data: productPayload },
  });
  expect(createdProduct.status()).toBe(200);
  const productId = (await createdProduct.json()).id;
  expect(
    (
      await request.post("/api/admin/products", {
        data: { id: productId, data: { ...productPayload, price: -1 } },
      })
    ).status(),
  ).toBe(400);
  const publicProduct = await request.get(`/producto/${productPayload.slug}`);
  expect(publicProduct.status()).toBe(200);
  expect(await publicProduct.text()).not.toContain("9876541");
  expect(
    (
      await request.delete("/api/admin/products", { data: { id: productId } })
    ).status(),
  ).toBe(409);
  expect(
    (await request.delete("/api/admin/categories", { data: { id } })).status(),
  ).toBe(409);
  const security = await (await request.get("/api/admin/security")).json();
  expect(JSON.stringify(security)).not.toContain("tokenHash");
  expect(JSON.stringify(security)).not.toContain("totpEncrypted");
  expect(
    (await request.post("/api/auth/admin-logout", { data: {} })).status(),
  ).toBe(200);
  expect((await request.get("/api/admin/categories")).status()).toBe(401);
});
test("STAFF no puede crear productos ni elevar privilegios", async ({
  request,
}) => {
  expect(
    (
      await request.post("/api/auth/admin-login", {
        data: { identity: `staff_${run}`, password },
      })
    ).status(),
  ).toBe(200);
  expect((await request.get("/api/admin/products")).status()).toBe(200);
  expect(
    (
      await request.post("/api/admin/products", { data: { data: {} } })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/admin/admins", {
        data: { id: staffId, data: { role: "SUPER_ADMIN" } },
      })
    ).status(),
  ).toBe(403);
  expect((await request.get("/api/admin/settings")).status()).toBe(403);
});
test("CSRF y límite persistente de intentos", async ({ request }) => {
  expect(
    (
      await request.post("/api/auth/login", {
        headers: { origin: "https://evil.test" },
        data: { identity: "x", password: "x" },
      })
    ).status(),
  ).toBe(403);
  for (let i = 0; i < 6; i++)
    expect(
      (
        await request.post("/api/auth/login", {
          data: { identity: `unknown_${run}`, password },
        })
      ).status(),
    ).toBe(401);
  expect(
    (
      await request.post("/api/auth/login", {
        data: { identity: `unknown_${run}`, password },
      })
    ).status(),
  ).toBe(429);
});
test("el límite no se evade con solicitudes concurrentes", async ({
  request,
}) => {
  const results = await Promise.all(
    Array.from({ length: 12 }, () =>
      request.post("/api/auth/login", {
        data: { identity: `parallel_${run}`, password },
      }),
    ),
  );
  expect(results.filter((r) => r.status() === 401)).toHaveLength(6);
  expect(results.filter((r) => r.status() === 429)).toHaveLength(6);
});
