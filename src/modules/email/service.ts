import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
const escape = (x: unknown) =>
  String(x ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const templates: Record<string, [string, string]> = {
  restock: [
    "Volvió tu variante",
    "La variante que guardaste está disponible nuevamente. El stock se confirma al comprar.",
  ],
  welcome: ["Bienvenido a JOSWEAR", "Tu cuenta está lista. Vestí a tu manera."],
  verification: [
    "Verificá tu correo",
    "Confirmá tu dirección de correo para activar tu cuenta.",
  ],
  reset: [
    "Restablecé tu contraseña",
    "Recibimos una solicitud para cambiar tu contraseña. Si no fuiste vos, ignorá este mensaje.",
  ],
  order: [
    "Recibimos tu solicitud",
    "Tu pedido queda pendiente de confirmación y pago.",
  ],
  paid: ["Pago confirmado", "Verificamos el pago de tu pedido."],
  shipped: ["Tu pedido fue enviado", "Tu pedido ya está en camino."],
  pickup: [
    "Tu pedido está listo",
    "Podés retirar tu pedido en el punto seleccionado.",
  ],
  admin: [
    "Acceso administrativo",
    "Se registró un acceso a tu cuenta administrativa. Revisá tus sesiones si no lo reconocés.",
  ],
};
export function renderEmail(
  template: string,
  payload: Record<string, unknown>,
) {
  const [subject, body] = templates[template] ?? templates.order;
  const link =
    typeof payload.url === "string" &&
    payload.url.startsWith(`${process.env.APP_URL || "http://localhost:3000"}/`)
      ? `<p><a style="color:#171717" href="${escape(payload.url)}">Continuar de forma segura →</a></p>`
      : "";
  return {
    subject,
    htmlContent: `<html lang="es"><body style="margin:0;background:#f4f0e9;font-family:Arial,sans-serif;color:#171717"><div style="max-width:560px;padding:40px 24px;margin:auto"><h1 style="letter-spacing:-2px">JOSWEAR</h1><h2>${escape(subject)}</h2><p style="line-height:1.8">${escape(body)}</p>${payload.reference ? `<p>Referencia: ${escape(payload.reference)}</p>` : ""}${payload.pickupCode ? `<p>Código de retiro: <strong>${escape(payload.pickupCode)}</strong></p>` : ""}${payload.tracking ? `<p>Guía: ${escape(payload.tracking)}</p>` : ""}${link}<hr style="border:0;border-top:1px solid #b4a18b"/><small>Correo transaccional · JOSWEAR</small></div></body></html>`,
  };
}
export async function enqueue(
  tx: Prisma.TransactionClient,
  key: string,
  to: string,
  template: string,
  payload: Prisma.InputJsonObject,
) {
  return tx.emailJob.upsert({
    where: { key },
    create: { key, to, template, payload },
    update: {},
  });
}
export async function processEmails() {
  if (process.env.EMAIL_MODE !== "live") return { mode: "sandbox", sent: 0 };
  if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL)
    throw new Error("Brevo sin configurar");
  // Recover abandoned leases after worker failure; stable Brevo idempotency keys cover ambiguous delivery.
  await db.emailJob.updateMany({
    where: {
      status: "SENDING",
      claimedAt: { lt: new Date(Date.now() - 10 * 60_000) },
    },
    data: { status: "PENDING" },
  });
  const jobs = await db.emailJob.findMany({
    where: {
      status: "PENDING",
      availableAt: { lte: new Date() },
      attempts: { lt: 5 },
    },
    take: 20,
    orderBy: { createdAt: "asc" },
  });
  let sent = 0;
  for (const job of jobs) {
    const claim = await db.emailJob.updateMany({
      where: { id: job.id, status: "PENDING" },
      data: {
        status: "SENDING",
        claimedAt: new Date(),
        attempts: { increment: 1 },
      },
    });
    if (!claim.count) continue;
    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        signal: AbortSignal.timeout(15_000),
        headers: {
          "api-key": process.env.BREVO_API_KEY,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          headers: { idempotencyKey: job.id },
          sender: {
            name: process.env.BREVO_SENDER_NAME || "JOSWEAR",
            email: process.env.BREVO_SENDER_EMAIL,
          },
          to: [{ email: job.to }],
          ...renderEmail(job.template, job.payload as Record<string, unknown>),
        }),
      });
      if (!response.ok) throw new Error(`Brevo HTTP ${response.status}`);
      await db.emailJob.update({
        where: { id: job.id },
        data: { status: "SENT", sentAt: new Date(), error: null },
      });
      sent++;
    } catch {
      await db.emailJob.update({
        where: { id: job.id },
        data: {
          status: job.attempts + 1 >= 5 ? "FAILED" : "PENDING",
          availableAt: new Date(Date.now() + 60_000 * 2 ** job.attempts),
          error:
            "Fallo de entrega; revisar proveedor sin registrar el contenido.",
        },
      });
    }
  }
  return { mode: "live", sent };
}
