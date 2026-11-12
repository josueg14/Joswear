import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import argon2 from "argon2";
import { db } from "@/lib/db";
import { adminSession } from "@/lib/security";
import { fail, HttpError, jsonBody, ok, sameOrigin } from "@/lib/http";
import { statuses } from "@/modules/orders/domain";
import { transitionOrder } from "@/modules/orders/service";
import { enqueue } from "@/modules/email/service";
const crc = z.number().int().min(0).max(100_000_000);
const text = z.string().trim().min(1).max(180);
const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(120);
const optionalText = z.string().max(300).nullish();
const externalImage = z.url().refine((url) => {
  const origin = process.env.STORAGE_PUBLIC_ORIGIN;
  return (
    !!origin &&
    new URL(url).origin === new URL(origin).origin &&
    url.startsWith("https://")
  );
}, "La imagen debe pertenecer al almacenamiento externo configurado");
const variant = z.object({
  sku: text,
  size: z.string().min(1).max(30),
  color: z.string().min(1).max(60),
  stock: z.number().int().min(0).max(1_000_000),
});
const productSchema = z
  .object({
    name: text,
    slug,
    description: z.string().min(5).max(5000),
    price: crc,
    salePrice: crc.nullish(),
    cost: crc.nullish(),
    categoryId: text,
    collectionId: optionalText,
    tags: z.array(z.string().max(40)).max(30).default([]),
    featured: z.boolean().default(false),
    published: z.boolean().default(false),
    variants: z.array(variant).min(1).max(100).optional(),
    images: z
      .array(z.object({ url: externalImage, alt: z.string().min(3).max(200) }))
      .max(12)
      .default([]),
  })
  .refine(
    (p) => p.salePrice == null || p.salePrice <= p.price,
    "Precio promocional mayor al precio regular",
  );
const schemas = {
  categories: z.object({ name: text, slug }),
  collections: z.object({ name: text, slug, description: optionalText }),
  banners: z.object({
    title: text,
    subtitle: z.string().min(3).max(400),
    imageUrl: externalImage.nullish(),
    href: z.string().regex(/^\/(?!\/)[a-zA-Z0-9/?=&_-]*$/),
    active: z.boolean(),
  }),
  pickups: z.object({
    name: text,
    address: z.string().min(10).max(600),
    hours: text,
    active: z.boolean(),
  }),
  shipping: z.object({
    name: text,
    province: z.enum([
      "San José",
      "Alajuela",
      "Cartago",
      "Heredia",
      "Guanacaste",
      "Puntarenas",
      "Limón",
    ]),
    canton: optionalText,
    district: optionalText,
    price: crc,
    freeFrom: crc.nullish(),
    active: z.boolean(),
  }),
  coupons: z.object({
    code: z.string().regex(/^[A-Z0-9_-]{3,40}$/),
    percent: z.number().int().min(1).max(100),
    minimum: crc,
    maxUses: z.number().int().min(1).max(1_000_000),
    expiresAt: z.coerce.date(),
    active: z.boolean(),
  }),
};
function range(req: NextRequest) {
  const fromRaw = req.nextUrl.searchParams.get("from");
  const toRaw = req.nextUrl.searchParams.get("to");
  const from = fromRaw
    ? new Date(`${fromRaw}T00:00:00-06:00`)
    : new Date(Date.now() - 30 * 86400_000);
  const to = toRaw ? new Date(`${toRaw}T23:59:59.999-06:00`) : new Date();
  if (!Number.isFinite(+from) || !Number.isFinite(+to) || from > to)
    throw new HttpError(400, "Rango de fechas inválido");
  return { gte: from, lte: to };
}
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ resource: string }> },
) {
  try {
    const { resource } = await ctx.params;
    const session = await adminSession(resource);
    if (
      ["admins", "settings"].includes(resource) &&
      session.account.role !== "SUPER_ADMIN"
    )
      throw new HttpError(403, "Solo SUPER_ADMIN");
    switch (resource) {
      case "dashboard": {
        const createdAt = range(req);
        const [sales, pending, customers, products, outOfStock, orders] =
          await Promise.all([
            db.payment.aggregate({
              where: { status: "CONFIRMED", confirmedAt: createdAt },
              _sum: { amount: true },
              _count: true,
            }),
            db.order.count({
              where: {
                status: {
                  in: ["PENDING", "AWAITING_PAYMENT", "PAYMENT_REVIEW"],
                },
                createdAt,
              },
            }),
            db.customer.count(),
            db.product.count({ where: { published: true, demo: false } }),
            db.productVariant.count({
              where: { stock: 0, product: { published: true, demo: false } },
            }),
            db.payment.findMany({
              where: { status: "CONFIRMED", confirmedAt: createdAt },
              select: { amount: true, confirmedAt: true },
            }),
          ]);
        const grouped: Record<string, number> = {};
        for (const p of orders) {
          const day = new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Costa_Rica",
          }).format(p.confirmedAt!);
          grouped[day] = (grouped[day] || 0) + p.amount;
        }
        return ok({
          revenue: sales._sum.amount || 0,
          confirmed: sales._count,
          pending,
          customers,
          products,
          outOfStock,
          average: sales._count
            ? Math.round((sales._sum.amount || 0) / sales._count)
            : 0,
          daily: grouped,
        });
      }
      case "products":
        return ok(
          await db.product.findMany({
            include: { variants: true, images: true, category: true },
            orderBy: { createdAt: "desc" },
            take: 100,
          }),
        );
      case "variants":
        return ok(
          await db.productVariant.findMany({
            take: 200,
            orderBy: { sku: "asc" },
          }),
        );
      case "categories":
        return ok(await db.category.findMany());
      case "collections":
        return ok(await db.collection.findMany());
      case "banners":
        return ok(await db.banner.findMany());
      case "pickups":
        return ok(await db.pickupLocation.findMany());
      case "shipping":
        return ok(
          (await db.shippingZone.findMany({ include: { rates: true } })).map(
            (z) => ({
              ...z,
              price: z.rates[0]?.price,
              freeFrom: z.rates[0]?.freeFrom,
            }),
          ),
        );
      case "coupons":
        return ok(await db.coupon.findMany());
      case "settings":
        return ok(await db.siteSetting.findMany());
      case "orders":
        return ok(
          await db.order.findMany({
            include: {
              items: true,
              payments: true,
              history: true,
              shipment: true,
            },
            orderBy: { createdAt: "desc" },
            take: 100,
          }),
        );
      case "customers":
        return ok(
          await db.customer.findMany({
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              username: true,
              verifiedAt: true,
              createdAt: true,
              _count: { select: { orders: true } },
            },
            take: 100,
            orderBy: { createdAt: "desc" },
          }),
        );
      case "inventory":
        return ok(
          await db.productVariant.findMany({
            include: {
              product: { select: { name: true } },
              movements: { take: 10, orderBy: { createdAt: "desc" } },
            },
            take: 200,
          }),
        );
      case "payments":
        return ok(
          await db.payment.findMany({
            include: { events: true, order: { select: { reference: true } } },
            take: 100,
          }),
        );
      case "security": {
        const [sessions, logins, audit, emails] = await Promise.all([
          db.adminSession.findMany({
            select: {
              id: true,
              account: { select: { username: true } },
              ip: true,
              userAgent: true,
              lastActivity: true,
              expiresAt: true,
              revokedAt: true,
            },
            orderBy: { lastActivity: "desc" },
            take: 100,
          }),
          db.loginEvent.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
          db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
          db.emailJob.findMany({
            select: {
              id: true,
              template: true,
              status: true,
              attempts: true,
              createdAt: true,
              error: true,
            },
            orderBy: { createdAt: "desc" },
            take: 100,
          }),
        ]);
        return ok({ sessions, logins, audit, emails });
      }
      case "admins":
        return ok(
          await db.adminAccount.findMany({
            select: {
              id: true,
              username: true,
              role: true,
              active: true,
              permissions: { select: { resource: true, action: true } },
            },
          }),
        );
      case "reports": {
        const rows = await db.order.findMany({
          where: { createdAt: range(req) },
          select: {
            reference: true,
            status: true,
            total: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10000,
        });
        if (req.nextUrl.searchParams.get("format") === "csv") {
          const csv = [
            "referencia,estado,total_CRC,fecha",
            ...rows.map((r) =>
              [r.reference, r.status, r.total, r.createdAt.toISOString()].join(
                ",",
              ),
            ),
          ].join("\r\n");
          return new NextResponse(csv, {
            headers: {
              "content-type": "text/csv; charset=utf-8",
              "content-disposition":
                'attachment; filename="joswear-pedidos.csv"',
              "Cache-Control": "no-store",
            },
          });
        }
        return ok(rows);
      }
      default:
        throw new HttpError(404, "Módulo no encontrado");
    }
  } catch (error) {
    return fail(error);
  }
}
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ resource: string }> },
) {
  try {
    sameOrigin(req);
    const { resource } = await ctx.params;
    const session = await adminSession(resource, "write");
    const adminId = session.account.id;
    const raw = await jsonBody(req);
    const envelope = z
      .object({
        id: z.string().optional(),
        data: z.record(z.string(), z.unknown()),
      })
      .parse(raw);
    const { id, data } = envelope;
    if (
      ["admins", "settings"].includes(resource) &&
      session.account.role !== "SUPER_ADMIN"
    )
      throw new HttpError(
        403,
        "Solo SUPER_ADMIN puede gestionar administradores y configuración crítica",
      );
    if (resource === "orders") {
      const input = z
        .object({
          status: z.enum(statuses),
          paymentVerified: z.boolean().default(false),
          note: z.string().min(3).max(500),
          pickupCode: z.string().max(20).optional(),
          tracking: z.string().max(120).optional(),
          carrier: z.string().max(80).optional(),
        })
        .parse(data);
      if (!id) throw new HttpError(400, "Pedido requerido");
      if (
        ["PAID", "REFUNDED"].includes(input.status) &&
        session.account.role !== "SUPER_ADMIN" &&
        !session.account.permissions.some(
          (p) => p.resource === "payments" && p.action === "write",
        )
      )
        throw new HttpError(403, "Se requiere permiso para conciliar pagos");
      return ok(
        await transitionOrder(
          id,
          input.status,
          adminId,
          input.paymentVerified,
          input.note,
          input,
        ),
      );
    }
    return ok(
      await db.$transaction(
        async (tx) => {
          let target: { id?: string; key?: string };
          let detail: Prisma.InputJsonObject = {
            fields: Object.keys(data).filter(
              (k) => !/password|secret|token/i.test(k),
            ),
          };
          if (resource === "products") {
            const input = productSchema.parse(data);
            const { variants, images, ...product } = input;
            if (!id && !variants?.length)
              throw new HttpError(400, "Añadí al menos una variante");
            if (id) {
              const previous = await tx.product.findUniqueOrThrow({
                where: { id },
              });
              detail = {
                before: {
                  price: previous.price,
                  salePrice: previous.salePrice,
                  published: previous.published,
                },
                after: {
                  price: product.price,
                  salePrice: product.salePrice ?? null,
                  published: product.published,
                },
              };
              await tx.productImage.deleteMany({ where: { productId: id } });
              target = await tx.product.update({
                where: { id },
                data: {
                  ...product,
                  collectionId: product.collectionId || null,
                  demo: false,
                  images: {
                    create: images.map((im, position) => ({ ...im, position })),
                  },
                },
              });
            } else {
              target = await tx.product.create({
                data: {
                  ...product,
                  collectionId: product.collectionId || null,
                  variants: { create: variants! },
                  images: {
                    create: images.map((im, position) => ({ ...im, position })),
                  },
                },
              });
              for (const v of await tx.productVariant.findMany({
                where: { productId: target.id },
              }))
                if (v.stock)
                  await tx.inventoryMovement.create({
                    data: {
                      variantId: v.id,
                      quantity: v.stock,
                      reason: "INITIAL_STOCK",
                    },
                  });
            }
          } else if (resource === "variants") {
            const input = z
              .object({ productId: text, sku: text, size: text, color: text })
              .parse(data);
            if (id) {
              const prior = await tx.productVariant.findUniqueOrThrow({
                where: { id },
              });
              if (prior.productId !== input.productId)
                throw new HttpError(
                  400,
                  "No se puede reasignar una variante a otro producto",
                );
              target = await tx.productVariant.update({
                where: { id },
                data: input,
              });
            } else
              target = await tx.productVariant.create({
                data: { ...input, stock: 0 },
              });
          } else if (resource === "categories") {
            const input = schemas.categories.parse(data);
            target = id
              ? await tx.category.update({ where: { id }, data: input })
              : await tx.category.create({ data: input });
          } else if (resource === "collections") {
            const input = schemas.collections.parse(data);
            target = id
              ? await tx.collection.update({ where: { id }, data: input })
              : await tx.collection.create({ data: input });
          } else if (resource === "banners") {
            const input = schemas.banners.parse(data);
            if (input.active)
              await tx.banner.updateMany({ data: { active: false } });
            target = id
              ? await tx.banner.update({ where: { id }, data: input })
              : await tx.banner.create({ data: input });
          } else if (resource === "pickups") {
            const input = schemas.pickups.parse(data);
            target = id
              ? await tx.pickupLocation.update({ where: { id }, data: input })
              : await tx.pickupLocation.create({ data: input });
          } else if (resource === "shipping") {
            const { price, freeFrom, ...input } = schemas.shipping.parse(data);
            if (id) {
              await tx.shippingRate.deleteMany({ where: { zoneId: id } });
              target = await tx.shippingZone.update({
                where: { id },
                data: { ...input, rates: { create: { price, freeFrom } } },
              });
            } else
              target = await tx.shippingZone.create({
                data: { ...input, rates: { create: { price, freeFrom } } },
              });
          } else if (resource === "coupons") {
            const input = schemas.coupons.parse(data);
            target = id
              ? await tx.coupon.update({ where: { id }, data: input })
              : await tx.coupon.create({ data: input });
          } else if (resource === "settings") {
            const input = z
              .discriminatedUnion("key", [
                z.object({
                  key: z.enum(["privacyPolicy", "returnsPolicy"]),
                  value: z.string().min(100).max(20000),
                }),
                z.object({
                  key: z.literal("merchantName"),
                  value: z.string().min(3).max(180),
                }),
                z.object({ key: z.literal("merchantEmail"), value: z.email() }),
                z.object({
                  key: z.literal("whatsapp"),
                  value: z.string().regex(/^506[2-8]\d{7}$/),
                }),
                z.object({
                  key: z.literal("sinpeInstructions"),
                  value: z.string().min(10).max(500),
                }),
                z.object({
                  key: z.literal("adminAlertEmail"),
                  value: z.email(),
                }),
                z.object({
                  key: z.enum([
                    "sinpeEnabled",
                    "commerceEnabled",
                    "policiesApproved",
                  ]),
                  value: z.boolean(),
                }),
              ])
              .parse(data);
            if (input.key === "commerceEnabled" && input.value === true) {
              const legal = await tx.siteSetting.findMany({
                where: {
                  key: {
                    in: [
                      "privacyPolicy",
                      "returnsPolicy",
                      "merchantName",
                      "merchantEmail",
                    ],
                  },
                },
              });
              if (
                legal.length !== 4 ||
                legal.some((x) => typeof x.value !== "string" || !x.value)
              )
                throw new HttpError(
                  400,
                  "Publicá políticas e identidad/contacto del comercio antes de habilitar compras",
                );
              const approved = await tx.siteSetting.findUnique({
                where: { key: "policiesApproved" },
              });
              if (
                approved?.value !== true ||
                process.env.EMAIL_MODE !== "live" ||
                !process.env.BREVO_API_KEY ||
                !process.env.BREVO_SENDER_EMAIL ||
                !process.env.APP_URL?.startsWith("https://")
              )
                throw new HttpError(
                  400,
                  "Antes de habilitar compras, aprobá políticas y configurá HTTPS y Brevo real",
                );
            }
            target = await tx.siteSetting.upsert({
              where: { key: input.key },
              create: input,
              update: { value: input.value },
            });
          } else if (resource === "inventory") {
            const input = z
              .object({
                variantId: text,
                delta: z
                  .number()
                  .int()
                  .min(-1_000_000)
                  .max(1_000_000)
                  .refine((n) => n !== 0),
                reason: z.string().min(5).max(300),
              })
              .parse(data);
            const changed = await tx.productVariant.updateMany({
              where: {
                id: input.variantId,
                ...(input.delta < 0 ? { stock: { gte: -input.delta } } : {}),
              },
              data: { stock: { increment: input.delta } },
            });
            if (!changed.count)
              throw new HttpError(
                409,
                "Variante inexistente o stock insuficiente",
              );
            target = await tx.inventoryMovement.create({
              data: {
                variantId: input.variantId,
                quantity: input.delta,
                reason: input.reason,
              },
            });
            if (input.delta > 0) {
              const alerts = await tx.restockAlert.findMany({
                where: { variantId: input.variantId, notifiedAt: null },
                include: {
                  customer: true,
                  variant: { include: { product: true } },
                },
              });
              for (const alert of alerts) {
                if (
                  !alert.customer.verifiedAt ||
                  !alert.variant.product.published ||
                  alert.variant.product.demo
                )
                  continue;
                await enqueue(
                  tx,
                  `restock:${alert.id}:${alert.createdAt.getTime()}`,
                  alert.customer.email,
                  "restock",
                  {
                    url: `${process.env.APP_URL}/producto/${alert.variant.product.slug}`,
                  },
                );
                await tx.restockAlert.update({
                  where: { id: alert.id },
                  data: { notifiedAt: new Date() },
                });
              }
            }
            detail = {
              variantId: input.variantId,
              delta: input.delta,
              reason: input.reason,
            };
          } else if (resource === "admins") {
            const input = z
              .object({
                username: z.string().regex(/^[a-z0-9_]{3,32}$/),
                password: z.string().min(16).max(128).optional(),
                role: z.enum(["ADMIN", "MANAGER", "STAFF", "SUPPORT"]),
                active: z.boolean(),
                permissions: z
                  .array(
                    z.object({
                      resource: z.enum([
                        "dashboard",
                        "products",
                        "variants",
                        "categories",
                        "collections",
                        "orders",
                        "customers",
                        "inventory",
                        "coupons",
                        "banners",
                        "shipping",
                        "pickups",
                        "payments",
                        "reports",
                        "security",
                      ]),
                      action: z.enum(["read", "write"]),
                    }),
                  )
                  .max(40),
              })
              .parse(data);
            if (id === adminId)
              throw new HttpError(
                403,
                "No podés modificar tus propios privilegios",
              );
            if (id) {
              const account = await tx.adminAccount.findUniqueOrThrow({
                where: { id },
              });
              if (account.role === "SUPER_ADMIN")
                throw new HttpError(
                  403,
                  "SUPER_ADMIN no puede modificarse desde este formulario",
                );
              await tx.permission.deleteMany({ where: { accountId: id } });
              target = await tx.adminAccount.update({
                where: { id },
                data: {
                  username: input.username,
                  role: input.role,
                  active: input.active,
                  ...(input.password
                    ? {
                        passwordHash: await argon2.hash(input.password, {
                          type: argon2.argon2id,
                        }),
                      }
                    : {}),
                  permissions: { create: input.permissions },
                },
              });
              await tx.adminSession.updateMany({
                where: { accountId: id },
                data: { revokedAt: new Date() },
              });
            } else {
              if (!input.password)
                throw new HttpError(400, "Contraseña inicial requerida");
              target = await tx.adminAccount.create({
                data: {
                  username: input.username,
                  role: input.role,
                  active: input.active,
                  passwordHash: await argon2.hash(input.password, {
                    type: argon2.argon2id,
                  }),
                  permissions: { create: input.permissions },
                },
              });
            }
          } else if (resource === "security") {
            const input = z.object({ sessionId: text }).parse(data);
            if (session.account.role !== "SUPER_ADMIN") {
              const owned = await tx.adminSession.findUnique({
                where: { id: input.sessionId },
              });
              if (owned?.accountId !== adminId)
                throw new HttpError(
                  403,
                  "Solo podés revocar tus propias sesiones",
                );
            }
            target = await tx.adminSession.update({
              where: { id: input.sessionId },
              data: { revokedAt: new Date() },
            });
            detail = { sessionId: input.sessionId };
          } else throw new HttpError(404, "Operación no disponible");
          await tx.auditLog.create({
            data: {
              adminId,
              resource,
              action: id ? "update" : "create",
              targetId: target.id ?? target.key ?? "",
              detail,
            },
          });
          return { success: true, id: target.id ?? target.key };
        },
        { timeout: 15_000 },
      ),
    );
  } catch (error) {
    return fail(error);
  }
}
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ resource: string }> },
) {
  try {
    sameOrigin(req);
    const { resource } = await ctx.params;
    const session = await adminSession(resource, "write");
    const { id } = z
      .object({ id: z.string().min(1) })
      .parse(await jsonBody(req));
    await db.$transaction(async (tx) => {
      if (resource === "products") {
        const product = await tx.product.findUniqueOrThrow({ where: { id } });
        if (product.published)
          throw new HttpError(
            409,
            "Despublicá el producto antes de eliminarlo",
          );
        if (await tx.orderItem.count({ where: { variant: { productId: id } } }))
          throw new HttpError(
            409,
            "El producto tiene pedidos y debe conservarse despublicado",
          );
        if (
          await tx.inventoryMovement.count({
            where: { variant: { productId: id } },
          })
        )
          throw new HttpError(
            409,
            "El producto tiene movimientos de inventario y debe conservarse despublicado",
          );
        await tx.product.delete({ where: { id } });
      } else if (resource === "variants") {
        const v = await tx.productVariant.findUniqueOrThrow({ where: { id } });
        if (v.stock !== 0)
          throw new HttpError(
            409,
            "Solo se eliminan variantes sin stock ni historial",
          );
        await tx.productVariant.delete({ where: { id } });
      } else if (resource === "categories")
        await tx.category.delete({ where: { id } });
      else if (resource === "collections")
        await tx.collection.delete({ where: { id } });
      else if (resource === "banners")
        await tx.banner.delete({ where: { id } });
      else if (resource === "coupons")
        await tx.coupon.delete({ where: { id } });
      else if (resource === "shipping")
        await tx.shippingZone.delete({ where: { id } });
      else if (resource === "pickups")
        await tx.pickupLocation.delete({ where: { id } });
      else
        throw new HttpError(
          400,
          "Este módulo conserva historial; deshabilitá el registro cuando corresponda",
        );
      await tx.auditLog.create({
        data: {
          adminId: session.account.id,
          resource,
          action: "delete",
          targetId: id,
          detail: {},
        },
      });
    });
    return ok({ success: true });
  } catch (error) {
    return fail(error);
  }
}
