import type { Metadata } from "next";
import "./globals.css";
import { StoreProvider } from "@/components/store-provider";
import { Header, Footer } from "@/components/shell";
export const metadata: Metadata = {
  title: {
    default: "JOSWEAR — Tu ritmo. Tu estilo.",
    template: "%s | JOSWEAR",
  },
  description: "Moda urbana en Costa Rica. Explora las colecciones de JOSWEAR.",
  robots:
    process.env.DEMO_MODE === "true" || !process.env.DATABASE_URL
      ? { index: false, follow: false }
      : { index: true, follow: true },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <StoreProvider>
          <a className="skip-link" href="#contenido">
            Saltar al contenido
          </a>
          <Header />
          <main id="contenido">{children}</main>
          <Footer />
        </StoreProvider>
      </body>
    </html>
  );
}
