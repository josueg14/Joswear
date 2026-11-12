import { randomUUID, createHmac } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "../../src/lib/db";
import { POST } from "../../src/app/api/payments/sandbox/webhook/route";
if (
  !process.env.DATABASE_URL?.startsWith(
    "postgresql://joswear_test@127.0.0.1:55439/joswear_test?",
  )
)
  throw new Error("Solo base de pruebas local aislada");
const run = randomUUID();
let paymentId: string;
beforeAll(async () => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("PAYMENT_PROVIDER", "sandbox");
  vi.stubEnv("SANDBOX_WEBHOOK_SECRET", "fixture-secret-only");
  const order = await db.order.create({
    data: {
      reference: `SANDBOX-${run}`,
      idempotencyKey: run,
      requestHash: run,
      name: "Webhook fixture",
      email: "sandbox@example.test",
      phone: "88888888",
      delivery: "pickup",
      method: "online",
      subtotal: 1000,
      shipping: 0,
      total: 1000,
      payments: { create: { provider: "sandbox", amount: 1000 } },
    },
    include: { payments: true },
  });
  paymentId = order.payments[0].id;
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await db.$disconnect();
});
function request(event: object, signature?: string) {
  const raw = JSON.stringify(event);
  return new NextRequest("http://localhost/api/payments/sandbox/webhook", {
    method: "POST",
    body: raw,
    headers: {
      "x-signature":
        signature ??
        createHmac("sha256", "fixture-secret-only").update(raw).digest("hex"),
    },
  });
}
it("firma, moneda, importe e idempotencia sobre PostgreSQL", async () => {
  const event = {
    eventId: `evt-${run}`,
    paymentId,
    amount: 1000,
    currency: "CRC",
    status: "CONFIRMED",
  };
  expect((await POST(request(event, "bad"))).status).toBe(401);
  expect((await POST(request({ ...event, currency: "USD" }))).status).toBe(401);
  expect((await POST(request({ ...event, amount: 1 }))).status).toBe(400);
  expect((await POST(request(event))).status).toBe(200);
  expect((await POST(request(event))).status).toBe(200);
  expect(
    await db.paymentEvent.count({ where: { externalId: event.eventId } }),
  ).toBe(1);
  expect(
    (await db.payment.findUniqueOrThrow({ where: { id: paymentId } })).status,
  ).toBe("CONFIRMED");
  expect((await POST(request({ ...event, status: "REFUNDED" }))).status).toBe(
    409,
  );
  vi.stubEnv("NODE_ENV", "production");
  expect((await POST(request(event))).status).toBe(404);
});
