import type { NextConfig } from "next";
const config: NextConfig = {
  experimental: { cpus: 1 },
  // GitHub Actions runs `npm run typecheck`; skip Next's duplicate check on Render's 512 MB tier.
  typescript: { ignoreBuildErrors: true },
  turbopack: { root: process.cwd() },
  async redirects() {
    return [
      ...["Hombre", "Mujer", "Accesorios"].map((category) => ({
        source: "/tienda.html",
        has: [{ type: "query" as const, key: "category", value: category }],
        destination: `/tienda?categoria=${category.toLowerCase()}`,
        permanent: true,
      })),
      ...Object.entries({
        "index.html": "/",
        "tienda.html": "/tienda",
        "carrito.html": "/carrito",
        "checkout.html": "/checkout",
        "login.html": "/cuenta/login",
        "registro.html": "/cuenta/registro",
        "admin.html": "/admin",
        "confirmacion.html": "/cuenta",
      }).map(([source, destination]) => ({
        source: `/${source}`,
        destination,
        permanent: true,
      })),
    ];
  },
  poweredByHeader: false,
  images: {
    remotePatterns: process.env.STORAGE_PUBLIC_ORIGIN
      ? [
          {
            protocol: "https",
            hostname: new URL(process.env.STORAGE_PUBLIC_ORIGIN).hostname,
          },
        ]
      : [],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`,
          },
        ],
      },
    ];
  },
};
export default config;
