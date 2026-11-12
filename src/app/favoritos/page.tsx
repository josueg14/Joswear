import { catalog } from "@/modules/catalog/service";
import { ProductGrid } from "@/components/products";
export const dynamic = "force-dynamic";
export default async function Favorites() {
  return (
    <section className="section catalog">
      <p className="eyebrow">TU SELECCIÓN</p>
      <h1>Guardá lo que te mueve.</h1>
      <ProductGrid products={await catalog()} favoritesOnly />
    </section>
  );
}
