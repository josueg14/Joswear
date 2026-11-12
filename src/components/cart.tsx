"use client";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Minus, Plus, Trash2 } from "lucide-react";
import { useStore } from "./store-provider";
import { money } from "@/modules/orders/domain";
export function Cart() {
  const { lines, quantity, ready } = useStore();
  if (!ready) return <div className="loading">Cargando tu bolsa…</div>;
  if (!lines.length)
    return (
      <section className="section empty-state">
        <p className="eyebrow" style={{ justifyContent: "center" }}>
          TU BOLSA
        </p>
        <h1 className="page-title">Hay espacio para tu estilo.</h1>
        <p>Elegí tus prendas favoritas y hacelas parte de tu día.</p>
        <Link className="button" href="/tienda">
          EXPLORAR LA COLECCIÓN <ArrowUpRight size={18} />
        </Link>
      </section>
    );
  const subtotal = lines.reduce((sum, x) => sum + x.price * x.quantity, 0);
  return (
    <section className="section">
      <p className="eyebrow">TU SELECCIÓN</p>
      <h1 className="page-title">
        Tu bolsa ({lines.reduce((s, x) => s + x.quantity, 0)}).
      </h1>
      <div className="cart-layout">
        <div>
          {lines.map((line) => (
            <article className="cart-line" key={line.variantId}>
              <Link href={`/producto/${line.slug}`}>
                <Image
                  src={line.image}
                  alt={line.name}
                  width="90"
                  height="115"
                />
              </Link>
              <div>
                <Link href={`/producto/${line.slug}`}>
                  <h2>{line.name}</h2>
                </Link>
                <p>
                  {line.color} / {line.size}
                </p>
                <p>{money(line.price)}</p>
                <div className="quantity-controls">
                  <button
                    aria-label={`Reducir cantidad de ${line.name}`}
                    onClick={() => quantity(line.variantId, line.quantity - 1)}
                  >
                    <Minus size={12} />
                  </button>
                  <span>{line.quantity}</span>
                  <button
                    aria-label={`Aumentar cantidad de ${line.name}`}
                    disabled={
                      line.quantity >= line.stock || line.quantity >= 20
                    }
                    onClick={() => quantity(line.variantId, line.quantity + 1)}
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>
              <div>
                <p>{money(line.price * line.quantity)}</p>
                <button
                  className="text-button"
                  aria-label={`Eliminar ${line.name}`}
                  onClick={() => quantity(line.variantId, 0)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          ))}
          <Link
            className="underlined-link"
            style={{ marginTop: 28 }}
            href="/tienda"
          >
            SEGUIR EXPLORANDO <ArrowUpRight size={16} />
          </Link>
        </div>
        <aside className="order-summary">
          <h2>El siguiente paso.</h2>
          <div className="summary-row">
            <span>Subtotal estimado</span>
            <span>{money(subtotal)}</span>
          </div>
          <div className="summary-row">
            <span>Entrega</span>
            <span>Se calcula en checkout</span>
          </div>
          <div className="summary-row summary-total">
            <span>Subtotal</span>
            <span>{money(subtotal)}</span>
          </div>
          <Link className="button" href="/checkout">
            CONTINUAR <ArrowUpRight size={17} />
          </Link>
          <p>
            Los precios y el inventario se verifican en el servidor antes de
            crear el pedido. Agregar a la bolsa no reserva prendas.
          </p>
        </aside>
      </div>
    </section>
  );
}
