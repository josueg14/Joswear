import { Prisma, type OrderStatus } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { hashToken } from "@/lib/cryptography";
import {
  canTransition,
  checkoutSchema,
  totalCRC,
  whatsappLink,
} from "./domain";
import { enqueue } from "../email/service";
import { z } from "zod";
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export async function settings() {
  const rows = await db.siteSetting.findMany();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
export async function checkout(input: CheckoutInput, customerId?: string) {
  const config = await settings();
  if (!config.commerceEnabled || !config.policiesApproved)
    throw new HttpError(
      503,
      "La tienda aún no ha habilitado las compras reales",
    );
  if (input.method === "online")
    throw new HttpError(
      400,
      "Pago online pendiente de seleccionar e integrar una pasarela autorizada",
    );
  if (
    input.method === "whatsapp" &&
    (typeof config.whatsapp !== "string" ||
      !/^506[2-8]\d{7}$/.test(config.whatsapp))
  )
    throw new HttpError(400, "WhatsApp no está configurado");
  if (
    input.method === "sinpe" &&
    (!config.sinpeEnabled || !config.sinpeInstructions)
  )
    throw new HttpError(400, "SINPE no está habilitado");
  const requestHash = hashToken(
    JSON.stringify({ ...input, customerId: customerId ?? null }),
  );
  const response = (order: {
    reference: string;
    total: number;
    items: { name: string; size: string; color: string; quantity: number }[];
  }) => ({
    reference: order.reference,
    total: order.total,
    message: "Solicitud recibida. Pendiente de pago y confirmación.",
    whatsappUrl:
      input.method === "whatsapp"
        ? whatsappLink(
            config.whatsapp as string,
            order.reference,
            order.items,
            order.total,
          )
        : null,
    instructions: input.method === "sinpe" ? config.sinpeInstructions : null,
  });
  const previous = await db.order.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: { items: true },
  });
  if (previous) {
    if (previous.requestHash !== requestHash)
      throw new HttpError(409, "Esta referencia de solicitud ya se utilizó");
    return response(previous);
  }
  try {
    const order = await db.$transaction(
      async (tx) => {
        const variants = await tx.productVariant.findMany({
          where: { id: { in: input.items.map((x) => x.variantId) } },
          include: { product: true },
        });
        if (
          variants.length !== input.items.length ||
          variants.some((v) => !v.product.published || v.product.demo)
        )
          throw new HttpError(400, "Una prenda ya no está disponible");
        const lines = input.items.map((item) => {
          const v = variants.find((v) => v.id === item.variantId)!;
          return {
            ...item,
            price: v.product.salePrice ?? v.product.price,
            name: v.product.name,
            sku: v.sku,
            size: v.size,
            color: v.color,
          };
        });
        const subtotal = totalCRC(lines).subtotal;
        let shipping = 0;
        if (input.delivery === "shipping") {
          const zone = await tx.shippingZone.findUnique({
            where: { id: input.zoneId },
            include: { rates: true },
          });
          const address = input.address!;
          if (
            !zone?.active ||
            zone.province !== address.province ||
            (zone.canton && zone.canton !== address.canton) ||
            (zone.district && zone.district !== address.district) ||
            zone.rates.length !== 1
          )
            throw new HttpError(
              400,
              "La dirección no coincide con una zona habilitada",
            );
          const rate = zone.rates[0];
          shipping =
            rate.freeFrom !== null && subtotal >= rate.freeFrom
              ? 0
              : rate.price;
        } else {
          const pickup = await tx.pickupLocation.findFirst({
            where: { id: input.pickupLocationId, active: true },
          });
          if (!pickup)
            throw new HttpError(400, "Punto de retiro no disponible");
        }
        let discount = 0;
        let couponId: string | undefined;
        if (input.coupon) {
          const coupon = await tx.coupon.findUnique({
            where: { code: input.coupon.toUpperCase() },
          });
          if (
            !coupon?.active ||
            coupon.expiresAt < new Date() ||
            coupon.minimum > subtotal
          )
            throw new HttpError(400, "Cupón no disponible para este pedido");
          const consumed = await tx.coupon.updateMany({
            where: { id: coupon.id, uses: { lt: coupon.maxUses } },
            data: { uses: { increment: 1 } },
          });
          if (!consumed.count) throw new HttpError(400, "Cupón agotado");
          couponId = coupon.id;
          discount = Math.floor((subtotal * coupon.percent) / 100);
        }
        for (const line of [...lines].sort((a, b) =>
          a.variantId.localeCompare(b.variantId),
        )) {
          const reserved = await tx.productVariant.updateMany({
            where: { id: line.variantId, stock: { gte: line.quantity } },
            data: { stock: { decrement: line.quantity } },
          });
          if (!reserved.count)
            throw new HttpError(
              409,
              `Stock insuficiente: ${line.name}, talla ${line.size}`,
            );
        }
        const reference = `JW-${randomBytes(8).toString("hex").toUpperCase()}`;
        const created = await tx.order.create({
          data: {
            reference,
            idempotencyKey: input.idempotencyKey,
            requestHash,
            customerId,
            name: input.name,
            email: input.email.toLowerCase(),
            phone: input.phone,
            address: input.address ?? Prisma.JsonNull,
            delivery: input.delivery,
            method: input.method,
            ...totalCRC(lines, shipping, discount),
            couponId,
            pickupLocationId:
              input.delivery === "pickup" ? input.pickupLocationId : undefined,
            status: input.method === "sinpe" ? "PAYMENT_REVIEW" : "PENDING",
            items: {
              create: lines.map(({ price, ...line }) => ({
                ...line,
                unitPrice: price,
              })),
            },
            history: {
              create: {
                status: input.method === "sinpe" ? "PAYMENT_REVIEW" : "PENDING",
                note: "Solicitud creada; no implica pago.",
              },
            },
            payments: {
              create: {
                provider: input.method,
                amount: totalCRC(lines, shipping, discount).total,
              },
            },
          },
          include: { items: true },
        });
        await tx.inventoryMovement.createMany({
          data: lines.map((x) => ({
            variantId: x.variantId,
            quantity: -x.quantity,
            reason: "ORDER_RESERVED",
            orderId: created.id,
          })),
        });
        await enqueue(tx, `order:${created.id}`, created.email, "order", {
          reference,
        });
        return created;
      },
      { isolationLevel: "Serializable" },
    );
    return response(order);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await db.order.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { items: true },
      });
      if (existing?.requestHash === requestHash) return response(existing);
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    )
      throw new HttpError(409, "El inventario cambió. Reintentá tu solicitud.");
    throw error;
  }
}
export async function transitionOrder(
  id: string,
  next: OrderStatus,
  adminId: string,
  paymentVerified: boolean,
  note?: string,
  fulfillment?: { pickupCode?: string; tracking?: string; carrier?: string },
) {
  return db.$transaction(
    async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: { items: true, payments: true },
      });
      if (!order || !canTransition(order.status, next, order.delivery))
        throw new HttpError(409, "Transición de pedido inválida");
      if ((next === "PAID" || next === "REFUNDED") && !paymentVerified)
        throw new HttpError(
          400,
          "Confirmá la conciliación del ingreso o reembolso real",
        );
      if (next === "PAID" && !["sinpe", "whatsapp"].includes(order.method))
        throw new HttpError(
          400,
          "El pago online solo se confirma por el proveedor",
        );
      if (next === "DELIVERED" && order.delivery === "pickup") {
        const shipment = await tx.shipment.findUnique({
          where: { orderId: id },
        });
        if (
          !shipment?.pickupCodeHash ||
          !fulfillment?.pickupCode ||
          hashToken(fulfillment.pickupCode.toUpperCase()) !==
            shipment.pickupCodeHash
        )
          throw new HttpError(400, "Código de retiro inválido");
      }
      const changed = await tx.order.updateMany({
        where: { id, status: order.status },
        data: { status: next },
      });
      if (!changed.count)
        throw new HttpError(409, "Otro administrador actualizó el pedido");
      if (next === "CANCELLED") {
        for (const item of order.items) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { increment: item.quantity } },
          });
          await tx.inventoryMovement.create({
            data: {
              variantId: item.variantId,
              quantity: item.quantity,
              reason: "ORDER_CANCELLED",
              orderId: id,
            },
          });
        }
        if (order.couponId)
          await tx.coupon.update({
            where: { id: order.couponId },
            data: { uses: { decrement: 1 } },
          });
      }
      // Refunds do not imply a physical return; inventory must be inspected and adjusted separately.
      if (next === "PAID" || next === "REFUNDED")
        await tx.payment.updateMany({
          where: { orderId: id },
          data: {
            status: next === "PAID" ? "CONFIRMED" : "REFUNDED",
            ...(next === "PAID"
              ? { confirmedAt: new Date() }
              : { refundedAt: new Date() }),
          },
        });
      await tx.orderStatusHistory.create({
        data: { orderId: id, status: next, adminId, note },
      });
      await tx.auditLog.create({
        data: {
          adminId,
          resource: "orders",
          action: "transition",
          targetId: id,
          detail: { from: order.status, to: next, paymentVerified },
        },
      });
      const template = {
        PAID: "paid",
        SHIPPED: "shipped",
        READY_FOR_PICKUP: "pickup",
      }[next as "PAID" | "SHIPPED" | "READY_FOR_PICKUP"];
      let pickupCode: string | undefined;
      if (next === "READY_FOR_PICKUP") {
        pickupCode = randomBytes(4).toString("hex").toUpperCase();
        await tx.shipment.upsert({
          where: { orderId: id },
          create: { orderId: id, pickupCodeHash: hashToken(pickupCode) },
          update: { pickupCodeHash: hashToken(pickupCode) },
        });
      }
      if (next === "SHIPPED")
        await tx.shipment.upsert({
          where: { orderId: id },
          create: {
            orderId: id,
            tracking: fulfillment?.tracking,
            carrier: fulfillment?.carrier,
          },
          update: {
            tracking: fulfillment?.tracking,
            carrier: fulfillment?.carrier,
          },
        });
      if (template)
        await enqueue(tx, `${template}:${id}`, order.email, template, {
          reference: order.reference,
          ...(pickupCode ? { pickupCode } : {}),
          ...(fulfillment?.tracking ? { tracking: fulfillment.tracking } : {}),
        });
      return { success: true };
    },
    { isolationLevel: "Serializable" },
  );
}
