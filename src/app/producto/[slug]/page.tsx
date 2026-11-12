import { notFound } from "next/navigation";
import Link from "next/link";
import { catalog } from "@/modules/catalog/service";
import { ProductDetail, ProductCard } from "@/components/products";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = (await catalog()).find((p) => p.slug === slug);
  return {
    title: product?.name ?? "Prenda no encontrada",
    description: product?.description,
  };
}
export default async function Product({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const products = await catalog();
  const product = products.find((p) => p.slug === slug);
  if (!product) notFound();
  return (
    <section className="section">
      <p className="breadcrumb">
        <Link href="/tienda">La colección</Link> / {product.name}
      </p>
      <ProductDetail product={product} />
      <div className="section-heading related-heading">
        <h2>Seguí explorando.</h2>
      </div>
      <div className="product-grid">
        {products
          .filter((p) => p.id !== product.id)
          .slice(0, 4)
          .map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
      </div>
    </section>
  );
}
