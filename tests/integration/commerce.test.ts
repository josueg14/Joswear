import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { db } from "../../src/lib/db";
import {
  checkout,
  transitionOrder,
  type CheckoutInput,
} from "../../src/modules/orders/service";
const testUrl = process.env.DATABASE_URL || "";
if (
  !/^postgresql:\/\/joswear_test@127\.0\.0\.1:55439\/joswear_test\?/.test(
    testUrl,
  )
)
  throw new Error(
    "Estas pruebas solo se ejecutan sobre la instancia local aislada joswear_test:55439",
  );
const run = randomUUID().slice(0, 8);
let variantId: string;
let pickupId: string;
let adminId: string;
let zoneId: string;
function input(patch: Partial<CheckoutInput> = {}): CheckoutInput {
  return {
    idempotencyKey: randomUUID(),
    name: "Cliente de Prueba",
    email: "cliente@example.test",
    phone: "88888888",
    method: "whatsapp",
    delivery: "pickup",
    pickupLocationId: pickupId,
    items: [{ variantId, quantity: 1 }],
    ...patch,
  };
}
beforeAll(async () => {
  for (const [key, value] of Object.entries({
    commerceEnabled: true,
    policiesApproved: true,
    whatsapp: "50688888888",
    sinpeEnabled: true,
    sinpeInstructions: "Instrucciones ficticias SOLO para pruebas",
  }))
    await db.siteSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  const category = await db.category.create({
    data: { name: "Pruebas", slug: `pruebas-${run}` },
  });
  const product = await db.product.create({
    data: {
      name: "Prenda de prueba",
      slug: `test-${run}`,
      description: "Producto exclusivo de pruebas locales",
      price: 14500,
      tags: [],
      published: true,
      categoryId: category.id,
      variants: {
        create: { sku: `test-${run}`, size: "M", color: "Marfil", stock: 20 },
      },
    },
    include: { variants: true },
  });
  variantId = product.variants[0].id;
  pickupId = (
    await db.pickupLocation.create({
      data: {
        name: "Fixture local",
        address: "Dirección ficticia exclusiva para pruebas",
        hours: "Solo prueba",
        active: true,
      },
    })
  ).id;
  adminId = (
    await db.adminAccount.create({
      data: {
        username: `test_${run}`,
        passwordHash: "NO_LOGIN_FIXTURE",
        role: "STAFF",
      },
    })
  ).id;
  zoneId = (
    await db.shippingZone.create({
      data: {
        name: `Fixture-${run}`,
        province: "San José",
        canton: "Central",
        active: true,
        rates: { create: { price: 2500, freeFrom: 50000 } },
      },
    })
  ).id;
});
afterAll(() => db.$disconnect());
describe("checkout PostgreSQL transaccional", () => {
  it("calcula precio en servidor y guarda inventario, historial y correo juntos", async () => {
    const request = input();
    const result = await checkout(request);
    expect(result.total).toBe(14500);
    const order = await db.order.findUniqueOrThrow({
      where: { reference: result.reference },
      include: { items: true, history: true, payments: true },
    });
    expect(order.status).toBe("PENDING");
    expect(order.payments[0].status).toBe("PENDING");
    expect(order.items[0].unitPrice).toBe(14500);
    expect(order.history).toHaveLength(1);
    expect(
      await db.emailJob.findUnique({ where: { key: `order:${order.id}` } }),
    ).not.toBeNull();
  });
  it("la misma idempotencia no crea pedido ni reserva dos veces", async () => {
    const request = input();
    const first = await checkout(request);
    const before = (
      await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })
    ).stock;
    const second = await checkout(request);
    expect(first.reference).toBe(second.reference);
    expect(
      (await db.productVariant.findUniqueOrThrow({ where: { id: variantId } }))
        .stock,
    ).toBe(before);
    await expect(
      checkout({ ...request, name: "Otra persona" }),
    ).rejects.toThrow("ya se utilizó");
  });
  it("rechaza falta de stock sin dejar pedido ni correo", async () => {
    const request = input({ items: [{ variantId, quantity: 20 }] });
    await expect(checkout(request)).rejects.toThrow("Stock insuficiente");
    expect(
      await db.order.count({
        where: { idempotencyKey: request.idempotencyKey },
      }),
    ).toBe(0);
  });
  it("concurrencia por la última unidad nunca deja stock negativo", async () => {
    const isolated = await db.productVariant.create({
      data: {
        productId: (
          await db.productVariant.findUniqueOrThrow({
            where: { id: variantId },
          })
        ).productId,
        sku: `last-${run}`,
        size: "L",
        color: "Marfil",
        stock: 1,
      },
    });
    const results = await Promise.allSettled([
      checkout(input({ items: [{ variantId: isolated.id, quantity: 1 }] })),
      checkout(input({ items: [{ variantId: isolated.id, quantity: 1 }] })),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      (
        await db.productVariant.findUniqueOrThrow({
          where: { id: isolated.id },
        })
      ).stock,
    ).toBe(0);
  });
  it("cancelación repone una sola vez con auditoría", async () => {
    const result = await checkout(input());
    const order = await db.order.findUniqueOrThrow({
      where: { reference: result.reference },
    });
    const before = (
      await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })
    ).stock;
    await transitionOrder(
      order.id,
      "CANCELLED",
      adminId,
      false,
      "Cancelación de prueba",
    );
    expect(
      (await db.productVariant.findUniqueOrThrow({ where: { id: variantId } }))
        .stock,
    ).toBe(before + 1);
    await expect(
      transitionOrder(order.id, "CANCELLED", adminId, false),
    ).rejects.toThrow();
    expect(await db.auditLog.count({ where: { targetId: order.id } })).toBe(1);
  });
  it("verifica pago manual y no acepta confirmación implícita", async () => {
    const result = await checkout(input({ method: "sinpe" }));
    const order = await db.order.findUniqueOrThrow({
      where: { reference: result.reference },
    });
    expect(order.status).toBe("PAYMENT_REVIEW");
    await expect(
      transitionOrder(order.id, "PAID", adminId, false),
    ).rejects.toThrow("ingreso");
    await transitionOrder(
      order.id,
      "PAID",
      adminId,
      true,
      "Ingreso verificado en fixture",
    );
    expect(
      (await db.payment.findFirstOrThrow({ where: { orderId: order.id } }))
        .status,
    ).toBe("CONFIRMED");
  });
  it("tarifa real y coincidencia de dirección, sin inventar precios", async () => {
    const request = input({
      delivery: "shipping",
      zoneId,
      address: {
        province: "San José",
        canton: "Central",
        district: "Carmen",
        detail: "Dirección ficticia de pruebas",
      },
    });
    expect((await checkout(request)).total).toBe(17000);
    await expect(
      checkout({
        ...request,
        idempotencyKey: randomUUID(),
        address: { ...request.address!, province: "Limón" },
      }),
    ).rejects.toThrow("zona habilitada");
  });
  it("cupón aplica enteros y su límite no se supera", async () => {
    const code = `TEST-${run.toUpperCase()}`;
    await db.coupon.create({
      data: {
        code,
        percent: 10,
        maxUses: 1,
        expiresAt: new Date(Date.now() + 86400_000),
        active: true,
      },
    });
    expect((await checkout(input({ coupon: code }))).total).toBe(13050);
    await expect(checkout(input({ coupon: code }))).rejects.toThrow(
      "Cupón agotado",
    );
  });
  it("no confirma pago online sin una pasarela configurada", async () => {
    await expect(checkout(input({ method: "online" }))).rejects.toThrow(
      "pasarela",
    );
  });
  it("retiro exige código correcto y emite una sola notificación", async () => {
    const result = await checkout(input({ method: "sinpe" }));
    const order = await db.order.findUniqueOrThrow({
      where: { reference: result.reference },
    });
    await transitionOrder(order.id, "PAID", adminId, true, "Pago de prueba");
    await transitionOrder(order.id, "PREPARING", adminId, false);
    await transitionOrder(order.id, "READY_FOR_PICKUP", adminId, false);
    const email = await db.emailJob.findUniqueOrThrow({
      where: { key: `pickup:${order.id}` },
    });
    const code = (email.payload as { pickupCode: string }).pickupCode;
    expect(code).toMatch(/^[A-F0-9]{8}$/);
    await expect(
      transitionOrder(
        order.id,
        "DELIVERED",
        adminId,
        false,
        "Retiro incorrecto",
        { pickupCode: "INVALIDO" },
      ),
    ).rejects.toThrow("Código");
    await transitionOrder(
      order.id,
      "DELIVERED",
      adminId,
      false,
      "Retiro verificado",
      { pickupCode: code },
    );
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: order.id } })).status,
    ).toBe("DELIVERED");
  });
});
