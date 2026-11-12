import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUpRight, MoveUpRight } from "lucide-react";
import { catalog, storefrontContent } from "@/modules/catalog/service";
import { ProductCard } from "@/components/products";
import { Reveal } from "@/components/reveal";
export const dynamic = "force-dynamic";
export default async function Home() {
  const [products, banner] = await Promise.all([
    catalog(),
    storefrontContent(),
  ]);
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="dot" /> EL ESTILO NO PIDE PERMISO
          </p>
          <h1>
            {banner?.title || (
              <>
                TU RITMO.
                <br />
                <span>TU ESTILO.</span>
              </>
            )}
          </h1>
          <p className="hero-description">
            {banner?.subtitle ||
              "Esenciales urbanos. Actitud propia. Prendas que se mueven con vos, de la calle a donde querás."}
          </p>
          <Link href={banner?.href || "/tienda"} className="button">
            EXPLORAR LA COLECCIÓN <ArrowUpRight size={19} />
          </Link>
          <div className="hero-caption">
            <span>01 — EL ARTE DE SER VOS</span>
            <a href="#novedades" aria-label="Ver novedades">
              <ArrowDown size={20} />
            </a>
          </div>
        </div>
        <div className="hero-art">
          {banner?.imageUrl ? (
            <Image
              src={banner.imageUrl}
              alt={banner.title}
              width="900"
              height="1100"
              fetchPriority="high"
            />
          ) : (
            <>
              <div className="art-orbit" />
              <span className="art-type">
                J<span>W</span>
              </span>
              <div className="art-garment">
                <Image
                  src="/demo/hoodie.svg"
                  alt="Estudio ilustrado de una hoodie. Imagen de demostración."
                  width="440"
                  height="560"
                  fetchPriority="high"
                />
              </div>
              <span className="art-note">
                ESTUDIO DE SILUETA
                <br />
                VOLUMEN / TEXTURA / MOVIMIENTO
              </span>
              <span className="art-number">001</span>
              <span className="art-label">
                JOSWEAR STUDIO — ILUSTRACIÓN DEMO
              </span>
            </>
          )}
        </div>
      </section>
      <div className="brand-strip">
        <span>MENOS REGLAS. MÁS VOS.</span>
        <span>✳</span>
        <span>ESENCIA URBANA</span>
        <span>✳</span>
        <span>HECHO PARA MOVERTE</span>
        <span>✳</span>
        <span>COSTA RICA</span>
      </div>
      <section className="section" id="novedades">
        <div className="section-heading">
          <div>
            <p className="eyebrow">EN ROTACIÓN</p>
            <Reveal>
              <h2>Tus próximos esenciales.</h2>
            </Reveal>
          </div>
          <Link href="/tienda" className="underlined-link">
            VER TODO <ArrowUpRight size={17} />
          </Link>
        </div>
        {products.some((p) => p.demo) && (
          <p className="demo-notice">
            VISTA DE DEMOSTRACIÓN · Ilustraciones, prendas y precios de ejemplo.
            Las compras reales aún no están habilitadas.
          </p>
        )}
        <div className="product-grid">
          {products
            .filter((p) => p.featured)
            .slice(0, 4)
            .map((p) => (
              <ProductCard product={p} key={p.id} />
            ))}
        </div>
        {!products.length && (
          <p className="empty-state">
            Estamos preparando la próxima colección.
          </p>
        )}
      </section>
      <section className="category-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">SIN ETIQUETAS. CON ACTITUD.</p>
            <h2>Encontrá tu expresión.</h2>
          </div>
        </div>
        <div className="category-grid">
          {[
            ["01", "Hombre", "hombre", "hoodie"],
            ["02", "Mujer", "mujer", "tee"],
            ["03", "Accesorios", "accesorios", "cap"],
          ].map(([n, title, slug, art]) => (
            <Link
              key={slug}
              href={`/tienda?categoria=${slug}`}
              className={`category-card category-${slug}`}
            >
              <span className="category-number">/{n}</span>
              <Image
                src={`/demo/${art}.svg`}
                alt={`Ilustración de la categoría ${title}`}
                width="440"
                height="560"
                loading="lazy"
              />
              <div>
                <h3>{title}</h3>
                <MoveUpRight size={26} />
              </div>
            </Link>
          ))}
        </div>
      </section>
      <section className="manifesto">
        <p className="eyebrow">ESTO ES JOSWEAR</p>
        <h2>
          La calle es el punto de partida.
          <br />
          Lo que sigue, <em>lo ponés vos.</em>
        </h2>
        <p>
          Creemos en vestir con intención. En los esenciales que repetís.
          <br />
          En hacer tuyo cada día, sin seguir el ritmo de nadie más.
        </p>
        <Link className="underlined-link" href="/tienda">
          ENCONTRÁ LO TUYO <ArrowUpRight size={18} />
        </Link>
      </section>
    </>
  );
}
