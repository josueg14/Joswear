import { NextRequest } from "next/server";
import { z } from "zod";
import { db, isDemo } from "@/lib/db";
import { customerSession } from "@/lib/security";
import { fail, HttpError, jsonBody, ok, sameOrigin } from "@/lib/http";
export async function GET() {
  try {
    if (isDemo()) return ok({ items: [] });
    const session = await customerSession();
    if (!session) throw new HttpError(401, "Iniciá sesión");
    return ok(
      (await db.cart.findUnique({
        where: { customerId: session.customerId },
        include: {
          items: {
            include: {
              variant: { include: { product: { include: { images: true } } } },
            },
          },
        },
      })) ?? { items: [] },
    );
  } catch (error) {
    return fail(error);
  }
}
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const session = await customerSession();
    if (!session) throw new HttpError(401, "Iniciá sesión");
    const input = z
      .object({
        items: z
          .array(
            z.object({
              variantId: z.string(),
              quantity: z.number().int().min(1).max(20),
            }),
          )
          .max(50),
      })
      .parse(await jsonBody(req));
    const quantities = new Map<string, number>();
    input.items.forEach((i) =>
      quantities.set(
        i.variantId,
        Math.min(20, (quantities.get(i.variantId) ?? 0) + i.quantity),
      ),
    );
    await db.$transaction(async (tx) => {
      const cart = await tx.cart.upsert({
        where: { customerId: session.customerId },
        create: { customerId: session.customerId },
        update: {},
      });
      const variants = await tx.productVariant.findMany({
        where: {
          id: { in: [...quantities.keys()] },
          product: { published: true, demo: false },
        },
      });
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      for (const v of variants) {
        const quantity = Math.min(v.stock, quantities.get(v.id)!);
        if (quantity)
          await tx.cartItem.create({
            data: { cartId: cart.id, variantId: v.id, quantity },
          });
      }
    });
    return ok({ success: true });
  } catch (error) {
    return fail(error);
  }
}
