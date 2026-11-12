import { createHmac, timingSafeEqual } from "node:crypto";
export type PaymentIntent = { id: string; url: string; sandbox: boolean };
export type ProviderEvent = {
  eventId: string;
  paymentId: string;
  amount: number;
  currency: "CRC";
  status: "CONFIRMED" | "REJECTED" | "REFUNDED";
};
export interface PaymentProvider {
  createIntent(input: {
    paymentId: string;
    amount: number;
    returnUrl: string;
  }): Promise<PaymentIntent>;
  verifyWebhook(raw: string, signature: string): ProviderEvent;
}
export function validSignature(raw: string, signature: string, secret: string) {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(raw).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
export class SandboxProvider implements PaymentProvider {
  async createIntent(input: {
    paymentId: string;
    amount: number;
    returnUrl: string;
  }) {
    if (process.env.NODE_ENV === "production")
      throw new Error("Sandbox no permitido en producción");
    return {
      id: input.paymentId,
      url: `${new URL(input.returnUrl).origin}/checkout?sandbox=${encodeURIComponent(input.paymentId)}`,
      sandbox: true,
    };
  }
  verifyWebhook(raw: string, signature: string): ProviderEvent {
    const secret = process.env.SANDBOX_WEBHOOK_SECRET;
    if (!secret || !validSignature(raw, signature, secret))
      throw new Error("Firma inválida");
    const value = JSON.parse(raw);
    if (
      typeof value.eventId !== "string" ||
      !value.eventId ||
      typeof value.paymentId !== "string" ||
      !Number.isSafeInteger(value.amount) ||
      value.amount < 0 ||
      value.currency !== "CRC" ||
      !["CONFIRMED", "REJECTED", "REFUNDED"].includes(value.status)
    )
      throw new Error("Evento inválido");
    return value;
  }
}
