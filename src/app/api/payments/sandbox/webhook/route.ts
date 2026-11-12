import { NextRequest } from "next/server";
import { SandboxProvider } from "@/modules/payments/provider";
import { db } from "@/lib/db";
import { fail, HttpError, ok } from "@/lib/http";
export async function POST(req: NextRequest) {
  try {
    if (
      process.env.NODE_ENV === "production" ||
      process.env.PAYMENT_PROVIDER !== "sandbox"
    )
      throw new HttpError(404, "No disponible");
    const raw = await req.text();
    if (raw.length > 30_000)
      throw new HttpError(413, "Evento demasiado grande");
    let event;
    try {
      event = new SandboxProvider().verifyWebhook(
        raw,
        req.headers.get("x-signature") || "",
      );
    } catch {
      throw new HttpError(401, "Firma o evento inválido");
    }
    await db.$transaction(
      async (tx) => {
        const payment = await tx.payment.findUnique({
          where: { id: event.paymentId },
        });
        if (
          !payment ||
          payment.provider !== "sandbox" ||
          payment.amount !== event.amount
        )
          throw new HttpError(400, "El pago no coincide");
        const prior = await tx.paymentEvent.findUnique({
          where: { externalId: event.eventId },
        });
        if (prior) {
          if (prior.paymentId !== payment.id || prior.status !== event.status)
            throw new HttpError(409, "Evento inconsistente");
          return;
        }
        if (
          payment.status !== "PENDING" &&
          !(payment.status === "CONFIRMED" && event.status === "REFUNDED")
        )
          throw new HttpError(409, "Estado de pago incompatible");
        await tx.paymentEvent.create({
          data: {
            paymentId: payment.id,
            externalId: event.eventId,
            status: event.status,
          },
        });
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: event.status,
            ...(event.status === "CONFIRMED"
              ? { confirmedAt: new Date() }
              : event.status === "REFUNDED"
                ? { refundedAt: new Date() }
                : {}),
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
    return ok({ received: true, sandbox: true });
  } catch (error) {
    return fail(error);
  }
}
