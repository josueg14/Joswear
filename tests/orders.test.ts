import { describe, expect, it } from "vitest";
import {
  canTransition,
  checkoutSchema,
  money,
  totalCRC,
  whatsappLink,
} from "../src/modules/orders/domain";
describe("CRC y precios", () => {
  it("calcula dinero entero incluyendo envío y descuento", () => {
    expect(
      totalCRC(
        [
          { price: 14500, quantity: 2 },
          { price: 28000, quantity: 1 },
        ],
        2500,
        1000,
      ),
    ).toEqual({
      subtotal: 57000,
      shipping: 2500,
      discount: 1000,
      total: 58500,
    });
    expect(money(14500)).toContain("14");
  });
  it.each([1.5, -1, NaN, Infinity, Number.MAX_SAFE_INTEGER])(
    "rechaza precio o total inválido %s",
    (price) => {
      expect(() => totalCRC([{ price, quantity: 2 }])).toThrow();
    },
  );
  it.each([0, -1, 1.1, 21])("rechaza cantidad inválida %s", (quantity) => {
    expect(() => totalCRC([{ price: 100, quantity }])).toThrow();
  });
  it("no permite descuento mayor al importe", () =>
    expect(() => totalCRC([{ price: 1, quantity: 1 }], 0, 2)).toThrow());
});
describe("máquina de pedidos", () => {
  it("no permite saltar de solicitud a entrega", () =>
    expect(canTransition("PENDING", "DELIVERED", "shipping")).toBe(false));
  it("solo permite retiro en pedidos de retiro", () => {
    expect(canTransition("PREPARING", "READY_FOR_PICKUP", "shipping")).toBe(
      false,
    );
    expect(canTransition("PREPARING", "READY_FOR_PICKUP", "pickup")).toBe(true);
  });
  it("solo permite envío a domicilio", () =>
    expect(canTransition("PREPARING", "SHIPPED", "pickup")).toBe(false));
  it("no puede cancelar dos veces ni deshacer reembolso", () => {
    expect(canTransition("CANCELLED", "CANCELLED", "shipping")).toBe(false);
    expect(canTransition("REFUNDED", "PAID", "shipping")).toBe(false);
  });
  it("no cancela un pago ya confirmado, requiere reembolso", () => {
    expect(canTransition("PAID", "CANCELLED", "shipping")).toBe(false);
    expect(canTransition("PAID", "REFUNDED", "shipping")).toBe(true);
  });
});
describe("validación de checkout", () => {
  const base = {
    idempotencyKey: "fb46168b-592c-40db-bd8f-d7c94de8454c",
    name: "Cliente Prueba",
    email: "prueba@example.test",
    phone: "88888888",
    method: "whatsapp",
    delivery: "pickup",
    pickupLocationId: "pickup",
    items: [{ variantId: "variant", quantity: 1 }],
  };
  it("acepta solicitud sin precios del cliente", () =>
    expect(checkoutSchema.parse({ ...base, total: 1 }).items).toEqual(
      base.items,
    ));
  it("rechaza duplicar variantes para evadir límites", () =>
    expect(
      checkoutSchema.safeParse({
        ...base,
        items: [...base.items, ...base.items],
      }).success,
    ).toBe(false));
  it("exige zona y dirección para envío", () =>
    expect(
      checkoutSchema.safeParse({ ...base, delivery: "shipping" }).success,
    ).toBe(false));
  it("exige punto de retiro", () =>
    expect(
      checkoutSchema.safeParse({ ...base, pickupLocationId: undefined })
        .success,
    ).toBe(false));
  it("no permite teléfono comercial sin configurar", () =>
    expect(() => whatsappLink("", "JW-TEST", [], 1000)).toThrow());
  it("codifica el enlace oficial y declara pago pendiente", () => {
    const url = whatsappLink(
      "50688888888",
      "JW-TEST",
      [{ name: "Prenda & Más", size: "M", color: "Marfil", quantity: 2 }],
      29000,
    );
    expect(url).toMatch(/^https:\/\/wa.me\/50688888888\?text=/);
    expect(decodeURIComponent(url)).toContain(
      "Pendiente de confirmación y pago",
    );
  });
});
