"use client";
import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";
import { z } from "zod";
import type { CatalogProduct } from "@/modules/catalog/demo";
const lineSchema = z.object({
  variantId: z.string(),
  productId: z.string(),
  name: z.string(),
  slug: z.string(),
  size: z.string(),
  color: z.string(),
  price: z.number().int().nonnegative(),
  image: z.string(),
  quantity: z.number().int().min(1).max(20),
  stock: z.number().int().nonnegative(),
});
export type Line = z.infer<typeof lineSchema>;
type Snapshot = {
  lines: Line[];
  favorites: string[];
  ready: boolean;
  notice: string;
};
type Store = Snapshot & {
  add: (p: CatalogProduct, variantId: string) => void;
  quantity: (id: string, value: number) => void;
  clear: () => void;
  favorite: (id: string) => void;
};
const empty: Snapshot = { lines: [], favorites: [], ready: false, notice: "" };
let snapshot = empty;
let initialized = false;
let loggedIn = false;
let syncing = false;
const listeners = new Set<() => void>();
function update(next: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...next };
  try {
    localStorage.setItem(
      "joswear-v2",
      JSON.stringify({ lines: snapshot.lines, favorites: snapshot.favorites }),
    );
  } catch {
    /* Private mode may deny persistence. */
  }
  listeners.forEach((fn) => fn());
}
function getSnapshot() {
  if (!initialized && typeof window !== "undefined") {
    initialized = true;
    let saved: Partial<Snapshot> = {};
    try {
      const parsed = z
        .object({
          lines: z.array(lineSchema).max(50),
          favorites: z.array(z.string()).max(500),
        })
        .safeParse(JSON.parse(localStorage.getItem("joswear-v2") || "{}"));
      if (parsed.success) saved = parsed.data;
    } catch {}
    snapshot = { ...empty, ...saved, ready: true };
  }
  return snapshot;
}
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
const Context = createContext<Store | null>(null);
async function syncAccount() {
  if (syncing) return;
  syncing = true;
  try {
    const account = await fetch("/api/auth/me").then((r) => r.json());
    loggedIn = !!account.customer;
    if (!loggedIn) return;
    const response = await fetch("/api/cart");
    if (!response.ok) return;
    const cart = await response.json();
    const merged = new Map(
      snapshot.lines.map((line) => [line.variantId, line]),
    );
    for (const item of cart.items ?? []) {
      const v = item.variant;
      const p = v.product;
      const old = merged.get(v.id);
      const parsed = lineSchema.safeParse({
        variantId: v.id,
        productId: p.id,
        name: p.name,
        slug: p.slug,
        size: v.size,
        color: v.color,
        price: p.salePrice ?? p.price,
        image: p.images[0]?.url ?? "/demo/tee.svg",
        quantity: Math.min(
          20,
          v.stock,
          Math.max(old?.quantity ?? 0, item.quantity),
        ),
        stock: v.stock,
      });
      if (parsed.success && p.published) merged.set(v.id, parsed.data);
    }
    update({ lines: [...merged.values()] });
  } catch {
    /* Preserve the guest bag when offline. */
  } finally {
    syncing = false;
  }
}
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const state = useSyncExternalStore(subscribe, getSnapshot, () => empty);
  useEffect(() => {
    void syncAccount();
    const handler = () => {
      void syncAccount();
    };
    window.addEventListener("joswear-auth", handler);
    return () => window.removeEventListener("joswear-auth", handler);
  }, []);
  useEffect(() => {
    if (!state.ready || !loggedIn || syncing) return;
    const timer = setTimeout(() => {
      void fetch("/api/cart", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: state.lines.map((x) => ({
            variantId: x.variantId,
            quantity: x.quantity,
          })),
        }),
      }).catch(() => {});
    }, 500);
    return () => clearTimeout(timer);
  }, [state.lines, state.ready]);
  function add(p: CatalogProduct, variantId: string) {
    const v = p.variants.find((x) => x.id === variantId);
    if (!v?.stock) return;
    const existing = snapshot.lines.find((x) => x.variantId === v.id);
    if (existing)
      update({
        lines: snapshot.lines.map((x) =>
          x.variantId === v.id
            ? { ...x, quantity: Math.min(x.quantity + 1, v.stock, 20) }
            : x,
        ),
      });
    else if (snapshot.lines.length < 50)
      update({
        lines: [
          ...snapshot.lines,
          {
            variantId: v.id,
            productId: p.id,
            name: p.name,
            slug: p.slug,
            size: v.size,
            color: v.color,
            price: p.salePrice ?? p.price,
            image: p.images[0]?.url ?? "/demo/tee.svg",
            quantity: 1,
            stock: v.stock,
          },
        ],
      });
    update({ notice: p.name + " añadido a tu bolsa" });
    setTimeout(() => update({ notice: "" }), 3500);
  }
  return (
    <Context.Provider
      value={{
        ...state,
        add,
        quantity: (id, value) =>
          update({
            lines: snapshot.lines
              .map((x) =>
                x.variantId === id
                  ? { ...x, quantity: Math.min(value, x.stock, 20) }
                  : x,
              )
              .filter((x) => x.quantity > 0),
          }),
        clear: () => update({ lines: [] }),
        favorite: (id) =>
          update({
            favorites: snapshot.favorites.includes(id)
              ? snapshot.favorites.filter((x) => x !== id)
              : [...snapshot.favorites, id],
          }),
      }}
    >
      {children}
      <div className={`toast ${state.notice ? "visible" : ""}`} role="status">
        {state.notice}
      </div>
    </Context.Provider>
  );
}
export function useStore() {
  const store = useContext(Context);
  if (!store) throw new Error("StoreProvider requerido");
  return store;
}
