"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowUpRight,
  Menu,
  X,
  Search,
  UserRound,
  ShoppingBag,
  Heart,
} from "lucide-react";
import { useStore } from "./store-provider";
export function Header() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(false);
  const store = useStore();
  const path = usePathname();
  const reduced = useReducedMotion();
  const menu = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    menu.current?.querySelector<HTMLElement>("a")?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
      if (e.key === "Tab") {
        const nodes = [
          toggle.current,
          ...Array.from(
            menu.current?.querySelectorAll<HTMLElement>("a, button") ?? [],
          ),
        ].filter(Boolean) as HTMLElement[];
        const index = nodes.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && index <= 0) {
          e.preventDefault();
          nodes.at(-1)?.focus();
        } else if (!e.shiftKey && index === nodes.length - 1) {
          e.preventDefault();
          nodes[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", handler);
    };
  }, [open]);
  const links = [
    ["Todo", "/tienda"],
    ["Hombre", "/tienda?categoria=hombre"],
    ["Mujer", "/tienda?categoria=mujer"],
    ["Accesorios", "/tienda?categoria=accesorios"],
  ];
  return (
    <>
      <div className="announcement">
        HECHO PARA TU DÍA A DÍA <span>ESTILO URBANO · COSTA RICA</span>
      </div>
      <header className="header">
        <button
          className="mobile-menu icon-button"
          ref={toggle}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
        <Link href="/" className="wordmark" aria-label="JOSWEAR, inicio">
          {process.env.NEXT_PUBLIC_LOGO_URL ? (
            <Image
              src={process.env.NEXT_PUBLIC_LOGO_URL}
              alt="JOSWEAR"
              width="160"
              height="32"
            />
          ) : (
            <>
              JOS<span>WEAR</span>
              <sup>CR</sup>
            </>
          )}
        </Link>
        <nav className="desktop-nav" aria-label="Principal">
          {links.map(([name, href]) => (
            <Link
              className={path === "/tienda" && name === "Todo" ? "active" : ""}
              key={name}
              href={href}
            >
              {name}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <button
            className="icon-button"
            onClick={() => setSearch(!search)}
            aria-label="Buscar"
            aria-expanded={search}
          >
            <Search size={20} />
          </button>
          <Link
            className="icon-button hide-small"
            href="/favoritos"
            aria-label="Favoritos"
          >
            <Heart size={20} />
          </Link>
          <Link className="icon-button" href="/cuenta" aria-label="Mi cuenta">
            <UserRound size={20} />
          </Link>
          <Link
            className="bag-link"
            href="/carrito"
            aria-label={`Bolsa, ${store.lines.reduce((s, x) => s + x.quantity, 0)} prendas`}
          >
            <ShoppingBag size={20} />
            <span>{store.lines.reduce((s, x) => s + x.quantity, 0)}</span>
          </Link>
        </div>
      </header>
      {search && (
        <form action="/tienda" className="search-bar">
          <label htmlFor="site-search">¿Qué estás buscando?</label>
          <input
            id="site-search"
            name="q"
            placeholder="Hoodies, camisetas, cargo…"
            autoFocus
          />
          <button
            className="button"
            type="submit"
            onClick={() => setSearch(false)}
          >
            Buscar <Search size={16} />
          </button>
        </form>
      )}
      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-navigation"
            ref={menu}
            className="mobile-panel"
            initial={{ opacity: 0, y: reduced ? 0 : -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <nav aria-label="Navegación móvil">
              {links.map(([name, href]) => (
                <Link
                  key={name}
                  href={href}
                  onClick={() => {
                    setOpen(false);
                    toggle.current?.focus();
                  }}
                >
                  {name}
                  <ArrowUpRight />
                </Link>
              ))}
              <Link href="/favoritos" onClick={() => setOpen(false)}>
                Favoritos <Heart />
              </Link>
            </nav>
            <p>VESTÍ A TU MANERA.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-top">
        <div>
          <Link href="/" className="wordmark">
            JOS<span>WEAR</span>
            <sup>CR</sup>
          </Link>
          <p>
            Tu ritmo. Tu estilo.
            <br />
            Un espacio para vestir a tu manera.
          </p>
        </div>
        <div>
          <h3>EXPLORAR</h3>
          <Link href="/tienda">Todas las prendas</Link>
          <Link href="/tienda?categoria=hombre">Hombre</Link>
          <Link href="/tienda?categoria=mujer">Mujer</Link>
          <Link href="/tienda?categoria=accesorios">Accesorios</Link>
        </div>
        <div>
          <h3>TU JOSWEAR</h3>
          <Link href="/cuenta">Mi cuenta</Link>
          <Link href="/carrito">Mi bolsa</Link>
          <Link href="/favoritos">Mis favoritos</Link>
        </div>
        <div>
          <h3>ESTAMOS PARA VOS</h3>
          <Link href="/ayuda">Envíos y retiros</Link>
          <Link href="/ayuda#cambios">Cambios y devoluciones</Link>
          <Link href="/privacidad">Privacidad</Link>
          <Link href="/admin">Administración</Link>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} JOSWEAR</span>
        <span>COSTA RICA · PRECIOS EN CRC ₡</span>
        <a href="#contenido">VOLVER ARRIBA ↑</a>
      </div>
    </footer>
  );
}
