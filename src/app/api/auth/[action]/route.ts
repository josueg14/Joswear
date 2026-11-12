import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import argon2 from "argon2";
import { TOTP } from "otpauth";
import { db, isDemo } from "@/lib/db";
import { fail, HttpError, jsonBody, ok, sameOrigin } from "@/lib/http";
import {
  adminSession,
  clientIp,
  cookieOptions,
  customerSession,
  decryptSecret,
  hashToken,
  loginLimit,
  newToken,
  sessionCookie,
} from "@/lib/security";
import { enqueue } from "@/modules/email/service";
const password = z.string().min(12, "Usá al menos 12 caracteres").max(128);
const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,32}$/, "Usuario: 3–32 letras, números o guion bajo");
const email = z
  .email()
  .max(180)
  .transform((v) => v.toLowerCase());
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ action: string }> },
) {
  try {
    const { action } = await ctx.params;
    if (isDemo()) return ok({ customer: null, demo: true });
    if (action === "admin-me") {
      const s = await adminSession();
      return ok({
        admin: {
          id: s.account.id,
          username: s.account.username,
          role: s.account.role,
        },
      });
    }
    if (action === "me") {
      const s = await customerSession();
      if (!s) return ok({ customer: null });
      const {
        id,
        firstName,
        lastName,
        email: address,
        username: user,
        verifiedAt,
      } = s.customer;
      const [orders, addresses, sessions] = await Promise.all([
        db.order.findMany({
          where: { customerId: id },
          include: { items: true, history: true },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
        db.address.findMany({ where: { customerId: id } }),
        db.customerSession.findMany({
          where: { customerId: id, expiresAt: { gt: new Date() } },
          select: { id: true, createdAt: true, expiresAt: true },
        }),
      ]);
      return ok({
        customer: {
          id,
          firstName,
          lastName,
          email: address,
          username: user,
          verifiedAt,
        },
        orders,
        addresses,
        sessions,
      });
    }
    throw new HttpError(404, "Ruta no encontrada");
  } catch (error) {
    return fail(error);
  }
}
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ action: string }> },
) {
  try {
    sameOrigin(req);
    if (isDemo())
      throw new HttpError(
        503,
        "Las cuentas requieren PostgreSQL y correo configurados. El catálogo demo no crea cuentas reales.",
      );
    const { action } = await ctx.params;
    const body = await jsonBody(req);
    const jar = await cookies();
    if (action === "logout" || action === "admin-logout") {
      const admin = action === "admin-logout";
      const token = jar.get(sessionCookie(admin))?.value;
      if (token) {
        if (admin)
          await db.adminSession.updateMany({
            where: { tokenHash: hashToken(token) },
            data: { revokedAt: new Date() },
          });
        else
          await db.customerSession.deleteMany({
            where: { tokenHash: hashToken(token) },
          });
      }
      jar.set(sessionCookie(admin), "", { ...cookieOptions, maxAge: 0 });
      return ok({ success: true });
    }
    if (action === "register") {
      const input = z
        .object({
          firstName: z.string().trim().min(2).max(60),
          lastName: z.string().trim().min(2).max(80),
          email,
          username,
          password,
        })
        .parse(body);
      await loginLimit(`register:${clientIp(req)}`, req);
      const hash = await argon2.hash(input.password, { type: argon2.argon2id });
      const token = newToken();
      await db.$transaction(async (tx) => {
        if (
          await tx.customer.findFirst({
            where: {
              OR: [{ email: input.email }, { username: input.username }],
            },
          })
        )
          throw new HttpError(409, "No se pudo registrar con esos datos");
        const customer = await tx.customer.create({
          data: {
            firstName: input.firstName,
            lastName: input.lastName,
            email: input.email,
            username: input.username,
            credential: { create: { hash } },
          },
        });
        await tx.emailVerificationToken.create({
          data: {
            customerId: customer.id,
            tokenHash: hashToken(token),
            expiresAt: new Date(Date.now() + 24 * 3600_000),
          },
        });
        await enqueue(
          tx,
          `verify:${customer.id}`,
          input.email,
          "verification",
          { url: `${process.env.APP_URL}/cuenta/verificar?token=${token}` },
        );
      });
      return ok(
        {
          message: "Cuenta creada. Verificá tu correo antes de iniciar sesión.",
        },
        201,
      );
    }
    if (action === "login" || action === "admin-login") {
      const input = z
        .object({
          identity: z.string().trim().toLowerCase().min(1).max(180),
          password: z.string().min(1).max(128),
          code: z
            .string()
            .regex(/^\d{6}$/)
            .optional(),
        })
        .parse(body);
      const admin = action === "admin-login";
      const event = await loginLimit(
        `${admin ? "admin" : "customer"}:${input.identity}`,
        req,
        admin,
      );
      const invalid = () =>
        new HttpError(401, "Credenciales incorrectas o cuenta no disponible");
      const token = newToken();
      if (admin) {
        if (input.identity.includes("@")) throw invalid();
        const account = await db.adminAccount.findUnique({
          where: { username: input.identity },
        });
        if (
          !account ||
          !account.active ||
          !(await argon2.verify(account.passwordHash, input.password))
        )
          throw invalid();
        if (account.role === "SUPER_ADMIN" || account.totpEncrypted) {
          if (!account.totpEncrypted || !input.code) throw invalid();
          const totp = new TOTP({
            secret: decryptSecret(account.totpEncrypted),
            digits: 6,
            period: 30,
          });
          const delta = totp.validate({ token: input.code, window: 1 });
          const step = BigInt(Math.floor(Date.now() / 30_000) + (delta ?? 0));
          if (delta === null) throw invalid();
          const consumed = await db.adminAccount.updateMany({
            where: { id: account.id, lastTotpStep: { lt: step } },
            data: { lastTotpStep: step },
          });
          if (!consumed.count) throw invalid();
        }
        const previous = jar.get(sessionCookie(true))?.value;
        await db.$transaction(async (tx) => {
          if (previous)
            await tx.adminSession.updateMany({
              where: { tokenHash: hashToken(previous) },
              data: { revokedAt: new Date() },
            });
          await tx.adminSession.create({
            data: {
              accountId: account.id,
              tokenHash: hashToken(token),
              expiresAt: new Date(Date.now() + 8 * 3600_000),
              ip: clientIp(req),
              userAgent: req.headers.get("user-agent")?.slice(0, 400),
            },
          });
          await tx.auditLog.create({
            data: {
              adminId: account.id,
              resource: "security",
              action: "login",
              targetId: account.id,
              detail: { result: "success" },
            },
          });
          const alert = await tx.siteSetting.findUnique({
            where: { key: "adminAlertEmail" },
          });
          if (typeof alert?.value === "string")
            await enqueue(
              tx,
              `admin-login:${event.id}`,
              alert.value,
              "admin",
              {},
            );
        });
      } else {
        const customer = await db.customer.findFirst({
          where: {
            OR: [{ email: input.identity }, { username: input.identity }],
          },
          include: { credential: true },
        });
        if (
          !customer?.credential ||
          !(await argon2.verify(customer.credential.hash, input.password)) ||
          !customer.verifiedAt
        )
          throw invalid();
        const previous = jar.get(sessionCookie(false))?.value;
        await db.$transaction(async (tx) => {
          if (previous)
            await tx.customerSession.deleteMany({
              where: { tokenHash: hashToken(previous) },
            });
          await tx.customerSession.create({
            data: {
              customerId: customer.id,
              tokenHash: hashToken(token),
              expiresAt: new Date(Date.now() + 7 * 86400_000),
            },
          });
        });
      }
      await db.loginEvent.update({
        where: { id: event.id },
        data: { success: true },
      });
      jar.set(sessionCookie(admin), token, {
        ...cookieOptions,
        maxAge: admin ? 8 * 3600 : 7 * 86400,
      });
      return ok({ success: true });
    }
    if (action === "forgot") {
      const input = z.object({ email }).parse(body);
      await loginLimit(`reset:${input.email}`, req);
      const customer = await db.customer.findUnique({
        where: { email: input.email },
      });
      if (customer) {
        const token = newToken();
        await db.$transaction(async (tx) => {
          await tx.passwordResetToken.deleteMany({
            where: { customerId: customer.id },
          });
          await tx.passwordResetToken.create({
            data: {
              customerId: customer.id,
              tokenHash: hashToken(token),
              expiresAt: new Date(Date.now() + 3600_000),
            },
          });
          await enqueue(
            tx,
            `reset:${hashToken(token)}`,
            customer.email,
            "reset",
            { url: `${process.env.APP_URL}/cuenta/restablecer?token=${token}` },
          );
        });
      }
      return ok({
        message:
          "Si existe una cuenta, recibirás las instrucciones en tu correo.",
      });
    }
    if (action === "reset" || action === "verify") {
      const input = z
        .object({
          token: z.string().regex(/^[a-f0-9]{64}$/),
          password: password.optional(),
        })
        .parse(body);
      const tokenHash = hashToken(input.token);
      if (action === "reset") {
        const newPassword = password.parse(input.password);
        const hash = await argon2.hash(newPassword, { type: argon2.argon2id });
        await db.$transaction(async (tx) => {
          const reset = await tx.passwordResetToken.findUnique({
            where: { tokenHash },
          });
          if (!reset || reset.expiresAt < new Date())
            throw new HttpError(400, "Enlace inválido o vencido");
          const deleted = await tx.passwordResetToken.deleteMany({
            where: { id: reset.id },
          });
          if (!deleted.count) throw new HttpError(400, "Enlace utilizado");
          await tx.userCredential.update({
            where: { customerId: reset.customerId },
            data: { hash },
          });
          await tx.customerSession.deleteMany({
            where: { customerId: reset.customerId },
          });
        });
      } else
        await db.$transaction(async (tx) => {
          const verification = await tx.emailVerificationToken.findUnique({
            where: { tokenHash },
          });
          if (!verification || verification.expiresAt < new Date())
            throw new HttpError(400, "Enlace inválido o vencido");
          const deleted = await tx.emailVerificationToken.deleteMany({
            where: { id: verification.id },
          });
          if (!deleted.count) throw new HttpError(400, "Enlace utilizado");
          const customer = await tx.customer.update({
            where: { id: verification.customerId },
            data: { verifiedAt: new Date() },
          });
          await enqueue(
            tx,
            `welcome:${customer.id}`,
            customer.email,
            "welcome",
            {},
          );
        });
      return ok({
        message:
          action === "reset"
            ? "Contraseña actualizada. Iniciá sesión nuevamente."
            : "Correo verificado. Ya podés iniciar sesión.",
      });
    }
    if (action === "address") {
      const session = await customerSession();
      if (!session) throw new HttpError(401, "Iniciá sesión");
      const input = z
        .object({
          province: z.string().min(2).max(60),
          canton: z.string().min(2).max(80),
          district: z.string().min(2).max(80),
          detail: z.string().min(10).max(600),
          reference: z.string().max(250).optional(),
          phone: z.string().regex(/^(?:\+506)?[2-8]\d{7}$/),
        })
        .parse(body);
      if (
        (await db.address.count({
          where: { customerId: session.customerId },
        })) >= 10
      )
        throw new HttpError(400, "Máximo 10 direcciones");
      return ok(
        await db.address.create({
          data: { ...input, customerId: session.customerId },
        }),
      );
    }
    if (action === "revoke-session") {
      const session = await customerSession();
      if (!session) throw new HttpError(401, "Iniciá sesión");
      const { id } = z.object({ id: z.string() }).parse(body);
      await db.customerSession.deleteMany({
        where: { id, customerId: session.customerId },
      });
      return ok({ success: true });
    }
    throw new HttpError(404, "Ruta no encontrada");
  } catch (error) {
    return fail(error);
  }
}
