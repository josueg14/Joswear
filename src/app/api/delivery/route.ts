import { db, isDemo } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { settings } from "@/modules/orders/service";
export async function GET() {
  try {
    if (isDemo())
      return ok({ demo: true, zones: [], pickups: [], methods: [] });
    const [zones, pickups, config] = await Promise.all([
      db.shippingZone.findMany({
        where: { active: true },
        include: { rates: true },
      }),
      db.pickupLocation.findMany({ where: { active: true } }),
      settings(),
    ]);
    return ok({
      demo: false,
      zones,
      pickups,
      methods: [
        typeof config.whatsapp === "string" &&
        /^506[2-8]\d{7}$/.test(config.whatsapp)
          ? "whatsapp"
          : null,
        config.sinpeEnabled ? "sinpe" : null,
      ].filter(Boolean),
      commerceEnabled:
        config.commerceEnabled === true && config.policiesApproved === true,
    });
  } catch (error) {
    return fail(error);
  }
}
