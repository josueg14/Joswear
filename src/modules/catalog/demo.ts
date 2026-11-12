export type CatalogProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  salePrice: number | null;
  category: { name: string; slug: string };
  demo: boolean;
  featured: boolean;
  images: { url: string; alt: string }[];
  variants: {
    id: string;
    size: string;
    color: string;
    stock: number;
    sku: string;
  }[];
};
const entries = [
  ["hoodie-essential", "Hoodie Essential", "hoodie", "hombre", 28000, "Carbón"],
  ["camiseta-boxy", "Camiseta Boxy", "tee", "mujer", 14500, "Marfil"],
  ["cargo-studio", "Cargo Studio", "pants", "hombre", 32000, "Taupe"],
  ["gorra-daily", "Gorra Daily", "cap", "accesorios", 12000, "Carbón"],
  ["hoodie-sand", "Hoodie Sand", "hoodie", "mujer", 28000, "Arena"],
  ["camiseta-core", "Camiseta Core", "tee", "hombre", 14500, "Carbón"],
] as const;
export const demoProducts: CatalogProduct[] = entries.map(
  ([slug, name, shape, category, price, color], i) => ({
    id: slug,
    slug,
    name,
    price,
    salePrice: null,
    demo: true,
    featured: i < 4,
    description:
      "Pieza de demostración para explorar JOSWEAR. El catálogo, los materiales y los precios definitivos se publicarán al configurar la tienda.",
    category: {
      name: category[0].toUpperCase() + category.slice(1),
      slug: category,
    },
    images: [
      {
        url: `/demo/${shape}.svg`,
        alt: `Ilustración de demostración: ${name}`,
      },
      {
        url: `/demo/${shape}-back.svg`,
        alt: `Vista posterior ilustrada: ${name}`,
      },
    ],
    variants: (shape === "cap" ? ["Única"] : ["S", "M", "L", "XL"]).map(
      (size, j) => ({
        id: `${slug}-${size}`,
        size,
        color,
        stock: j === 3 ? 0 : 8,
        sku: `DEMO-${i}-${size}`,
      }),
    ),
  }),
);
