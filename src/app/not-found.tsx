import Link from "next/link";
export default function NotFound() {
  return (
    <section className="section empty-state">
      <p className="eyebrow">404</p>
      <h1>Esta ruta tomó otro rumbo.</h1>
      <Link className="button" href="/tienda">
        Volver a la colección
      </Link>
    </section>
  );
}
