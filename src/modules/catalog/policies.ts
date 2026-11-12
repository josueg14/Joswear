import { db, isDemo } from "@/lib/db";
export async function policies() {
  if (isDemo()) return {};
  const rows = await db.siteSetting.findMany({
    where: {
      key: {
        in: ["privacyPolicy", "returnsPolicy", "merchantName", "merchantEmail"],
      },
    },
  });
  return Object.fromEntries(
    rows
      .filter((r) => typeof r.value === "string")
      .map((r) => [r.key, String(r.value)]),
  );
}
