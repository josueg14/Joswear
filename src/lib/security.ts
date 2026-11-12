import { hashToken } from "./cryptography";
export {
  hashToken,
  newToken,
  encryptSecret,
  decryptSecret,
} from "./cryptography";
import { cookies } from "next/headers.js";
import { NextRequest } from "next/server";
import { db } from "./db";
import { HttpError } from "./http";
export const sessionCookie = (admin: boolean) =>
  admin ? "jw_admin" : "jw_customer";
export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
export async function customerSession() {
  const token = (await cookies()).get(sessionCookie(false))?.value;
  if (!token) return null;
  const session = await db.customerSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { customer: true },
  });
  return session && session.expiresAt > new Date() ? session : null;
}
export async function adminSession(resource?: string, action = "read") {
  const token = (await cookies()).get(sessionCookie(true))?.value;
  if (!token) throw new HttpError(401, "Iniciá sesión como administrador");
  const session = await db.adminSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { account: { include: { permissions: true } } },
  });
  if (
    !session ||
    session.revokedAt ||
    session.expiresAt <= new Date() ||
    !session.account.active ||
    (session.account.role === "SUPER_ADMIN" && !session.account.totpEncrypted)
  )
    throw new HttpError(401, "Sesión inválida");
  if (
    resource &&
    session.account.role !== "SUPER_ADMIN" &&
    !session.account.permissions.some(
      (p) => p.resource === resource && p.action === action,
    )
  )
    throw new HttpError(403, "No tenés permiso para esta operación");
  if (session.lastActivity.getTime() < Date.now() - 60_000)
    await db.adminSession.update({
      where: { id: session.id },
      data: { lastActivity: new Date() },
    });
  return session;
}
export function clientIp(req: NextRequest) {
  // Render appends the trusted connecting address. Never use the first arbitrary forwarded value.
  if (process.env.RENDER === "true")
    return (
      req.headers
        .get("x-forwarded-for")
        ?.split(",")
        .at(-1)
        ?.trim()
        .slice(0, 80) || "unknown"
    );
  return "local";
}
export async function loginLimit(
  identity: string,
  req: NextRequest,
  admin = false,
) {
  const since = new Date(Date.now() - 15 * 60_000);
  const identityHash = hashToken(identity);
  const ipHash = hashToken(clientIp(req));
  const lockKey = BigInt.asIntN(64, BigInt("0x" + ipHash.slice(0, 16)));
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`;
    const [byIdentity, byIp] = await Promise.all([
      tx.loginEvent.count({
        where: { identityHash, success: false, createdAt: { gte: since } },
      }),
      tx.loginEvent.count({
        where: { ipHash, success: false, createdAt: { gte: since } },
      }),
    ]);
    if (byIdentity >= 6 || byIp >= 35)
      throw new HttpError(429, "Demasiados intentos. Esperá 15 minutos.");
    return tx.loginEvent.create({
      data: { identityHash, ipHash, admin, success: false },
    });
  });
}
