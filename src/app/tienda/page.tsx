import Link from "next/link";
import { catalog } from "@/modules/catalog/service";
import { ProductGrid } from "@/components/products";
export const dynamic = "force-dynamic";
export const metadata = { title: "La colección" };
export default async function Shop({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; q?: string }>;
}) {
  const { categoria = "", q = "" } = await searchParams;
  return (
    <section className="section catalog">
      <p className="eyebrow">JOSWEAR / LA COLECCIÓN</p>
      <h1>
        {categoria
          ? categoria[0].toUpperCase() + categoria.slice(1)
          : "Vestí a tu manera."}
      </h1>
      <nav className="category-tabs" aria-label="Categorías">
        {[
          ["", "Todo"],
          ["hombre", "Hombre"],
          ["mujer", "Mujer"],
          ["accesorios", "Accesorios"],
        ].map(([slug, name]) => (
          <Link
            key={slug}
            className={slug === categoria ? "selected" : ""}
            href={`/tienda${slug ? `?categoria=${slug}` : ""}`}
          >
            {name}
          </Link>
        ))}
      </nav>
      <ProductGrid products={await catalog()} category={categoria} query={q} />
    </section>
  );
}
