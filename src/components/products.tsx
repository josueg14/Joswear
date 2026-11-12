"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Heart, ArrowUpRight, SlidersHorizontal } from "lucide-react";
import { useStore } from "./store-provider";
import type { CatalogProduct } from "@/modules/catalog/demo";
import { money } from "@/modules/orders/domain";
export function ProductCard({ product: p }: { product: CatalogProduct }) {
  const store = useStore();
  return (
    <article className="product-card">
      <div className="product-media">
        <Link href={`/producto/${p.slug}`} aria-label={`Ver ${p.name}`}>
          <Image
            src={p.images[0]?.url ?? "/demo/tee.svg"}
            alt={p.images[0]?.alt ?? p.name}
            width="440"
            height="560"
            loading="lazy"
          />
          {p.images[1] && (
            <Image
              className="second-image"
              src={p.images[1].url}
              alt={p.images[1].alt}
              width="440"
              height="560"
              loading="lazy"
            />
          )}
        </Link>
        <span className="product-tag">
          {p.demo
            ? "DEMO"
            : p.variants.every((v) => v.stock === 0)
              ? "AGOTADO"
              : "ESTUDIO JOSWEAR"}
        </span>
        <button
          className="favorite-button"
          aria-label={`${store.favorites.includes(p.id) ? "Quitar de" : "Añadir a"} favoritos: ${p.name}`}
          aria-pressed={store.favorites.includes(p.id)}
          onClick={() => store.favorite(p.id)}
        >
          <Heart
            size={18}
            fill={store.favorites.includes(p.id) ? "currentColor" : "none"}
          />
        </button>
        <Link className="discover-product" href={`/producto/${p.slug}`}>
          DESCUBRIR PRENDA <ArrowUpRight size={17} />
        </Link>
      </div>
      <div className="product-meta">
        <Link href={`/producto/${p.slug}`}>
          <h3>{p.name}</h3>
        </Link>
        <span>{money(p.salePrice ?? p.price)}</span>
      </div>
      <p className="product-caption">
        {p.variants[0]?.color} <span>· {p.category.name}</span>
      </p>
    </article>
  );
}
export function ProductGrid({
  products,
  category = "",
  query = "",
  favoritesOnly = false,
}: {
  products: CatalogProduct[];
  category?: string;
  query?: string;
  favoritesOnly?: boolean;
}) {
  const store = useStore();
  const [sort, setSort] = useState("new");
  const [size, setSize] = useState("");
  const [filters, setFilters] = useState(false);
  const [term, setTerm] = useState(query);
  const selected = products
    .filter(
      (p) =>
        (!category || p.category.slug === category) &&
        (!favoritesOnly || store.favorites.includes(p.id)) &&
        (!size || p.variants.some((v) => v.size === size && v.stock > 0)) &&
        p.name.toLowerCase().includes(term.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "low"
        ? (a.salePrice ?? a.price) - (b.salePrice ?? b.price)
        : sort === "high"
          ? (b.salePrice ?? b.price) - (a.salePrice ?? a.price)
          : 0,
    );
  return (
    <>
      <div className="catalog-toolbar">
        <span>
          {selected.length} prendas
          {products.some((p) => p.demo) ? " de demostración" : ""}
        </span>
        <div>
          <button
            className="text-button"
            aria-expanded={filters}
            onClick={() => setFilters(!filters)}
          >
            <SlidersHorizontal size={15} /> Filtros
          </button>
          <label className="sr-only" htmlFor="sort">
            Ordenar
          </label>
          <select
            id="sort"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="new">Novedades</option>
            <option value="low">Menor precio</option>
            <option value="high">Mayor precio</option>
          </select>
        </div>
      </div>
      {filters && (
        <div className="filter-panel">
          <label>
            Buscar prenda
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              list="product-suggestions"
              placeholder="Nombre de la prenda"
            />
          </label>
          <datalist id="product-suggestions">
            {products.map((p) => (
              <option key={p.id} value={p.name} />
            ))}
          </datalist>
          <label>
            Talla disponible
            <select value={size} onChange={(e) => setSize(e.target.value)}>
              <option value="">Todas</option>
              {["S", "M", "L", "XL", "Única"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <button
            className="text-button"
            onClick={() => {
              setTerm("");
              setSize("");
            }}
          >
            Limpiar filtros
          </button>
        </div>
      )}
      <div className="product-grid">
        {selected.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
      {!selected.length && (
        <div className="empty-state">
          <h2>
            {favoritesOnly
              ? "Tus próximos favoritos empiezan acá."
              : "Todavía no hay prendas con esos filtros."}
          </h2>
          <Link className="button" href="/tienda">
            Explorar la tienda <ArrowUpRight size={18} />
          </Link>
        </div>
      )}
    </>
  );
}
export function ProductDetail({ product: p }: { product: CatalogProduct }) {
  const [alertMessage, setAlertMessage] = useState("");
  const [selected, setSelected] = useState("");
  const store = useStore();
  const variant = p.variants.find((v) => v.id === selected);
  return (
    <div className="product-detail">
      <div className="detail-gallery">
        {p.images.length ? (
          p.images.map((image, i) => (
            <Image
              key={image.url}
              src={image.url}
              alt={image.alt}
              width="660"
              height="840"
              loading={i ? "lazy" : "eager"}
            />
          ))
        ) : (
          <div className="empty-state">Fotografías pendientes</div>
        )}
      </div>
      <div className="detail-copy">
        <p className="eyebrow">
          {p.category.name} / {p.demo ? "DEMO" : "JOSWEAR"}
        </p>
        <h1>{p.name}</h1>
        <p className="detail-price">{money(p.salePrice ?? p.price)}</p>
        <p>{p.description}</p>
        <fieldset>
          <legend>Elegí tu talla y color</legend>
          <div className="sizes">
            {p.variants.map((v) => (
              <button
                key={v.id}
                disabled={!v.stock}
                className={selected === v.id ? "selected" : ""}
                aria-pressed={selected === v.id}
                onClick={() => setSelected(v.id)}
              >
                {v.size} <small>{v.color}</small>
                {!v.stock && <small>Agotado</small>}
              </button>
            ))}
          </div>
        </fieldset>
        {p.variants
          .filter((v) => !v.stock)
          .map((v) => (
            <button
              key={v.id}
              className="text-button"
              onClick={async () => {
                try {
                  const response = await fetch("/api/restock", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ variantId: v.id }),
                  });
                  const data = await response.json();
                  setAlertMessage(data.message || data.error);
                } catch {
                  setAlertMessage("No se pudo solicitar la alerta.");
                }
              }}
            >
              Avisarme cuando vuelva {v.size} / {v.color}
            </button>
          ))}
        {alertMessage && (
          <p className="form-message" role="status">
            {alertMessage}
          </p>
        )}
        <button
          className="button wide"
          disabled={!variant?.stock}
          onClick={() => store.add(p, selected)}
        >
          AÑADIR A LA BOLSA <ArrowUpRight size={18} />
        </button>
        <button className="text-button" onClick={() => store.favorite(p.id)}>
          <Heart size={17} />{" "}
          {store.favorites.includes(p.id)
            ? "Quitar de favoritos"
            : "Guardar en favoritos"}
        </button>
        <details>
          <summary>Envíos y retiro</summary>
          <p>
            Las opciones y tarifas disponibles se calculan al completar tu
            dirección. El retiro depende de los puntos habilitados por JOSWEAR.
          </p>
        </details>
        <details>
          <summary>Sobre esta prenda</summary>
          <p>
            {p.demo
              ? "Ilustración y precio de demostración. No representa inventario comercial."
              : p.description}
          </p>
        </details>
      </div>
    </div>
  );
}
