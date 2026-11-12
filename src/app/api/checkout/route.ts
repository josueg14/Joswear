import { NextRequest } from "next/server";
import { isDemo } from "@/lib/db";
import { customerSession } from "@/lib/security";
import { fail, HttpError, jsonBody, ok, sameOrigin } from "@/lib/http";
import { checkoutSchema } from "@/modules/orders/domain";
import { checkout } from "@/modules/orders/service";
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    if (isDemo())
      throw new HttpError(503, "Modo demostración: no se crean pedidos reales");
    const input = checkoutSchema.parse(await jsonBody(req));
    const session = await customerSession();
    return ok(await checkout(input, session?.customerId), 201);
  } catch (error) {
    return fail(error);
  }
}
