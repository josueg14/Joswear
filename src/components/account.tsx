"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { money, statusLabels } from "@/modules/orders/domain";
type AccountData = {
  demo?: boolean;
  customer: { firstName: string; lastName: string; email: string } | null;
  orders?: {
    id: string;
    reference: string;
    status: string;
    total: number;
    createdAt: string;
    history: { id: string; status: string; createdAt: string }[];
  }[];
  addresses?: {
    id: string;
    province: string;
    canton: string;
    district: string;
    detail: string;
  }[];
  sessions?: { id: string; expiresAt: string }[];
};
export function Account() {
  const [data, setData] = useState<AccountData | null>(null);
  const [error, setError] = useState("");
  function refresh() {
    fetch("/api/auth/me")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setData(d);
      })
      .catch(() => setError("No se pudo cargar tu cuenta."));
  }
  useEffect(() => {
    refresh();
  }, []);
  async function revoke(id: string) {
    const response = await fetch("/api/auth/revoke-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (response.ok) refresh();
    else setError("No se pudo revocar la sesión.");
  }
  if (!data)
    return (
      <section className="section empty-state">
        {error || "Cargando tu cuenta…"}
      </section>
    );
  if (!data.customer)
    return (
      <section className="section empty-state">
        <p className="eyebrow" style={{ justifyContent: "center" }}>
          TU JOSWEAR
        </p>
        <h1 className="page-title">Un espacio para vos.</h1>
        <p>Guardá tus direcciones y seguí el estado de tus pedidos.</p>
        {data.demo && (
          <p className="form-message">
            El entorno de demostración no crea cuentas reales. Conectá
            PostgreSQL y Brevo para habilitar el registro.
          </p>
        )}
        <Link className="button" href="/cuenta/login">
          INICIAR SESIÓN
        </Link>
        <p>
          <Link className="underlined-link" href="/cuenta/registro">
            Crear cuenta
          </Link>
        </p>
      </section>
    );
  return (
    <section className="section">
      <p className="eyebrow">TU JOSWEAR</p>
      <h1 className="page-title">Hola, {data.customer.firstName}.</h1>
      <p>{data.customer.email}</p>
      <button
        className="text-button"
        onClick={async () => {
          const r = await fetch("/api/auth/logout", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "{}",
          });
          if (r.ok) refresh();
        }}
      >
        Cerrar sesión
      </button>
      {error && <p role="alert">{error}</p>}
      <h2 style={{ marginTop: 35 }}>Tus pedidos</h2>
      {!data.orders?.length && (
        <p style={{ marginTop: 20 }}>Todavía no tenés pedidos.</p>
      )}
      {data.orders?.map((order) => (
        <details key={order.id}>
          <summary>
            {order.reference} · {statusLabels[order.status]} ·{" "}
            {money(order.total)}
          </summary>
          {order.history.map((h) => (
            <p key={h.id}>
              {statusLabels[h.status]} —{" "}
              {new Date(h.createdAt).toLocaleString("es-CR")}
            </p>
          ))}
        </details>
      ))}
      <h2 style={{ marginTop: 35 }}>Direcciones</h2>
      {data.addresses?.map((a) => (
        <p key={a.id}>
          {a.province}, {a.canton}, {a.district}. {a.detail}
        </p>
      ))}
      <form
        className="form-grid admin-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const body = Object.fromEntries(new FormData(form));
          const response = await fetch("/api/auth/address", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          });
          if (response.ok) {
            form.reset();
            refresh();
          } else setError((await response.json()).error);
        }}
      >
        {[
          ["province", "Provincia"],
          ["canton", "Cantón"],
          ["district", "Distrito"],
          ["phone", "Teléfono"],
          ["detail", "Dirección exacta"],
        ].map(([name, label]) => (
          <label key={name}>
            {label}
            <input
              name={name}
              required
              maxLength={name === "detail" ? 600 : 80}
            />
          </label>
        ))}
        <button className="button" type="submit">
          Guardar dirección
        </button>
      </form>
      <h2>Sesiones activas</h2>
      {data.sessions?.map((s) => (
        <div className="summary-row" key={s.id}>
          <span>Vence {new Date(s.expiresAt).toLocaleString("es-CR")}</span>
          <button className="text-button" onClick={() => revoke(s.id)}>
            Revocar sesión
          </button>
        </div>
      ))}
    </section>
  );
}
