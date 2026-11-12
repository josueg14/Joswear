import { NextRequest } from "next/server";
import { z } from "zod";
import { db, isDemo } from "@/lib/db";
import { customerSession } from "@/lib/security";
import { fail, HttpError, jsonBody, ok, sameOrigin } from "@/lib/http";
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    if (isDemo())
      throw new HttpError(
        503,
        "Las alertas requieren una cuenta real y correo configurado",
      );
    const s = await customerSession();
    if (!s?.customer.verifiedAt)
      throw new HttpError(401, "Iniciá sesión con una cuenta verificada");
    const { variantId } = z
      .object({ variantId: z.string() })
      .parse(await jsonBody(req));
    const v = await db.productVariant.findFirst({
      where: {
        id: variantId,
        stock: 0,
        product: { published: true, demo: false },
      },
    });
    if (!v) throw new HttpError(400, "Esta variante no está agotada");
    await db.restockAlert.upsert({
      where: { customerId_variantId: { customerId: s.customerId, variantId } },
      create: { customerId: s.customerId, variantId },
      update: { notifiedAt: null, createdAt: new Date() },
    });
    return ok({
      message: "Te avisaremos por correo cuando vuelva esta variante.",
    });
  } catch (error) {
    return fail(error);
  }
}
