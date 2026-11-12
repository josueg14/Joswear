import "dotenv/config";
import { createDatabase } from "../src/lib/db";
import { demoProducts } from "../src/modules/catalog/demo";
const db = createDatabase();
async function main() {
  if (process.env.NODE_ENV === "production")
    throw new Error("No ejecutar seed demo en producción");
  for (const p of demoProducts) {
    const category = await db.category.upsert({
      where: { slug: p.category.slug },
      create: p.category,
      update: {},
    });
    await db.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        name: p.name,
        slug: p.slug,
        description: p.description,
        price: p.price,
        demo: true,
        published: false,
        featured: p.featured,
        tags: ["DEMO"],
        categoryId: category.id,
        variants: {
          create: p.variants.map((v) => ({
            sku: v.sku,
            size: v.size,
            color: v.color,
            stock: v.stock,
          })),
        },
        images: {
          create: p.images.map((im, position) => ({ ...im, position })),
        },
      },
    });
  }
  console.log(
    "Seed DEMO completado: productos sin publicar y sin administradores.",
  );
}
main()
  .catch(() => {
    console.error("No se pudo ejecutar el seed.");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
