import { z } from "zod";
export const money = (value: number) =>
  new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    maximumFractionDigits: 0,
  }).format(value);
export const statuses = [
  "PENDING",
  "AWAITING_PAYMENT",
  "PAYMENT_REVIEW",
  "PAID",
  "PREPARING",
  "READY_FOR_PICKUP",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
] as const;
export const statusLabels: Record<string, string> = {
  PENDING: "Pendiente",
  AWAITING_PAYMENT: "Pendiente de pago",
  PAYMENT_REVIEW: "Pago en verificación",
  PAID: "Pagado",
  PREPARING: "Preparando",
  READY_FOR_PICKUP: "Listo para retiro",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
  REFUNDED: "Reembolsado",
};
const transitions: Record<string, readonly string[]> = {
  PENDING: ["AWAITING_PAYMENT", "PAYMENT_REVIEW", "CANCELLED"],
  AWAITING_PAYMENT: ["PAYMENT_REVIEW", "PAID", "CANCELLED"],
  PAYMENT_REVIEW: ["PAID", "AWAITING_PAYMENT", "CANCELLED"],
  PAID: ["PREPARING", "REFUNDED"],
  PREPARING: ["READY_FOR_PICKUP", "SHIPPED", "REFUNDED"],
  READY_FOR_PICKUP: ["DELIVERED", "REFUNDED"],
  SHIPPED: ["DELIVERED", "REFUNDED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};
export function canTransition(from: string, to: string, delivery: string) {
  return (
    !!transitions[from]?.includes(to) &&
    !(to === "READY_FOR_PICKUP" && delivery !== "pickup") &&
    !(to === "SHIPPED" && delivery !== "shipping")
  );
}
export function totalCRC(
  lines: { price: number; quantity: number }[],
  shipping = 0,
  discount = 0,
) {
  if (
    !lines.length ||
    lines.some(
      (x) =>
        !Number.isSafeInteger(x.price) ||
        x.price < 0 ||
        !Number.isSafeInteger(x.quantity) ||
        x.quantity < 1 ||
        x.quantity > 20,
    ) ||
    !Number.isSafeInteger(shipping) ||
    shipping < 0 ||
    !Number.isSafeInteger(discount) ||
    discount < 0
  )
    throw new Error("Importe inválido");
  const subtotal = lines.reduce((sum, x) => sum + x.price * x.quantity, 0);
  const total = subtotal + shipping - discount;
  if (!Number.isSafeInteger(total) || total < 0)
    throw new Error("Total inválido");
  return { subtotal, shipping, discount, total };
}
export const checkoutSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    name: z.string().trim().min(3).max(100),
    email: z.email().max(180),
    phone: z
      .string()
      .regex(/^(?:\+506)?[2-8]\d{7}$/, "Usa un teléfono válido de Costa Rica"),
    method: z.enum(["whatsapp", "sinpe", "online"]),
    delivery: z.enum(["shipping", "pickup"]),
    pickupLocationId: z.string().optional(),
    zoneId: z.string().optional(),
    coupon: z.string().max(40).optional(),
    address: z
      .object({
        province: z.string().min(2).max(60),
        canton: z.string().min(2).max(80),
        district: z.string().min(2).max(80),
        detail: z.string().min(10).max(600),
        reference: z.string().max(250).optional(),
      })
      .optional(),
    items: z
      .array(
        z.object({
          variantId: z.string().min(1).max(100),
          quantity: z.number().int().min(1).max(20),
        }),
      )
      .min(1)
      .max(50),
  })
  .superRefine((data, ctx) => {
    if (data.delivery === "shipping" && (!data.address || !data.zoneId))
      ctx.addIssue({
        code: "custom",
        message: "Selecciona zona y dirección de envío",
        path: ["address"],
      });
    if (data.delivery === "pickup" && !data.pickupLocationId)
      ctx.addIssue({
        code: "custom",
        message: "Selecciona un punto de retiro",
        path: ["pickupLocationId"],
      });
    if (new Set(data.items.map((i) => i.variantId)).size !== data.items.length)
      ctx.addIssue({
        code: "custom",
        message: "Variantes duplicadas",
        path: ["items"],
      });
  });
export function whatsappLink(
  phone: string,
  reference: string,
  lines: { name: string; size: string; color: string; quantity: number }[],
  total: number,
) {
  if (!/^506[2-8]\d{7}$/.test(phone))
    throw new Error("WhatsApp comercial sin configurar");
  const message = `Hola JOSWEAR, solicitud ${reference}\n${lines.map((x) => `${x.quantity} × ${x.name} / ${x.size} / ${x.color}`).join("\n")}\nTotal: ${money(total)}\nPendiente de confirmación y pago.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
