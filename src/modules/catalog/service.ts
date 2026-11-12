import { db, isDemo } from "@/lib/db";
import { demoProducts, type CatalogProduct } from "./demo";
export async function catalog(): Promise<CatalogProduct[]> {
  if (isDemo()) return demoProducts;
  return db.product.findMany({
    where: { published: true, demo: false },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      price: true,
      salePrice: true,
      demo: true,
      featured: true,
      category: { select: { name: true, slug: true } },
      variants: {
        select: { id: true, size: true, color: true, stock: true, sku: true },
      },
      images: {
        select: { url: true, alt: true },
        orderBy: { position: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}
export async function storefrontContent() {
  if (isDemo()) return null;
  return db.banner.findFirst({ where: { active: true } });
}
