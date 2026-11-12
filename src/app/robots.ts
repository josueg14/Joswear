import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  const demo = process.env.DEMO_MODE === "true" || !process.env.DATABASE_URL;
  return {
    rules: [
      {
        userAgent: "*",
        ...(demo
          ? { disallow: "/" }
          : {
              allow: "/",
              disallow: ["/admin", "/api/", "/cuenta", "/checkout", "/carrito"],
            }),
      },
    ],
    ...(process.env.APP_URL && !demo
      ? { sitemap: `${process.env.APP_URL}/sitemap.xml` }
      : {}),
  };
}
