import type { MetadataRoute } from "next";
import { catalog } from "@/modules/catalog/service";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = process.env.APP_URL;
  if (!origin || process.env.DEMO_MODE === "true" || !process.env.DATABASE_URL)
    return [];
  const products = await catalog();
  return [
    { url: origin },
    { url: `${origin}/tienda` },
    ...products
      .filter((p) => !p.demo)
      .map((p) => ({ url: `${origin}/producto/${p.slug}` })),
  ];
}
