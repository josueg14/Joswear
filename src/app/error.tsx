"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="section empty-state">
      <h1>No pudimos cargar esta página.</h1>
      <p>Intentá de nuevo en unos momentos.</p>
      <button className="button" onClick={reset}>
        Reintentar
      </button>
    </section>
  );
}
