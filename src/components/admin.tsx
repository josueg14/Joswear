"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { adminForms, adminModules } from "@/modules/admin/forms";
import { money, statuses, statusLabels } from "@/modules/orders/domain";
type Row = Record<string, unknown>;
const show = (value: unknown) =>
  value === null || value === undefined
    ? "—"
    : typeof value === "boolean"
      ? value
        ? "Sí"
        : "No"
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
export function Admin({ username }: { username: string }) {
  const router = useRouter();
  const [module, setModule] = useState("dashboard");
  const [data, setData] = useState<unknown>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [edit, setEdit] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [details, setDetails] = useState<Row | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const query = new URLSearchParams({
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  }).toString();
  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/${module}?${query}`);
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    return d;
  }, [module, query]);
  useEffect(() => {
    let active = true;
    load()
      .then((value) => {
        if (active) setData(value);
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error ? e.message : "No se pudo cargar el módulo",
          );
      });
    return () => {
      active = false;
    };
  }, [load]);
  async function save(payload: unknown, method = "POST") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await fetch(`/api/admin/${module}`, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMessage("Cambios guardados y registrados en auditoría.");
      setEdit(null);
      setDetails(null);
      setData(await load());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }
  const fields = adminForms[module];
  const rows = Array.isArray(data) ? (data as Row[]) : [];
  const summary = data && !Array.isArray(data) ? (data as Row) : null;
  const columns: Record<string, string[]> = {
    products: ["id", "name", "price", "published"],
    variants: ["id", "productId", "sku", "size", "color", "stock"],
    categories: ["id", "name", "slug"],
    collections: ["id", "name", "slug"],
    orders: ["reference", "name", "status", "total"],
    customers: ["firstName", "lastName", "email", "verifiedAt"],
    inventory: ["id", "sku", "size", "color", "stock"],
    coupons: ["id", "code", "percent", "uses", "active"],
    banners: ["id", "title", "active"],
    shipping: ["id", "name", "province", "price", "active"],
    pickups: ["id", "name", "address", "active"],
    payments: ["id", "provider", "amount", "status"],
    reports: ["reference", "status", "total", "createdAt"],
    admins: ["id", "username", "role", "active"],
    settings: ["key", "value"],
  };
  const labels: Record<string, string> = {
    id: "ID",
    name: "Nombre",
    slug: "Slug",
    price: "Precio CRC",
    published: "Publicado",
    reference: "Referencia",
    status: "Estado",
    total: "Total CRC",
    firstName: "Nombre",
    lastName: "Apellidos",
    email: "Correo",
    verifiedAt: "Verificación",
    sku: "SKU",
    size: "Talla",
    color: "Color",
    stock: "Stock",
    code: "Código",
    percent: "%",
    uses: "Usos",
    active: "Habilitado",
    title: "Título",
    province: "Provincia",
    address: "Dirección",
    provider: "Método",
    amount: "Importe CRC",
    createdAt: "Fecha",
    username: "Usuario",
    role: "Rol",
    key: "Clave",
    value: "Valor",
  };
  return (
    <div
      className="admin-layout"
      style={collapsed ? { gridTemplateColumns: "1fr" } : undefined}
    >
      {!collapsed && (
        <aside className="admin-sidebar" aria-label="Módulos administrativos">
          {adminModules.map(([key, label]) => (
            <button
              className={module === key ? "selected" : ""}
              key={key}
              onClick={() => {
                setData(null);
                setError("");
                setModule(key);
                setEdit(null);
                setDetails(null);
                setMessage("");
              }}
            >
              {label}
            </button>
          ))}
        </aside>
      )}
      <section className="admin-content">
        <div className="section-heading">
          <div>
            <p className="eyebrow">JOSWEAR / {username}</p>
            <h1>{adminModules.find(([key]) => key === module)?.[1]}</h1>
          </div>
          <div>
            <button
              className="text-button"
              aria-expanded={!collapsed}
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? "Mostrar menú" : "Ocultar menú"}
            </button>
            <button
              className="text-button"
              style={{ marginLeft: 15 }}
              onClick={async () => {
                const r = await fetch("/api/auth/admin-logout", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: "{}",
                });
                if (r.ok) router.push("/admin/login");
              }}
            >
              Cerrar sesión
            </button>
          </div>
        </div>
        {["dashboard", "reports"].includes(module) && (
          <div className="form-grid admin-form">
            <label>
              Desde
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label>
              Hasta
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
          </div>
        )}
        {error && (
          <p className="form-message error-message" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="form-message" role="status">
            {message}
          </p>
        )}
        {fields && !edit && (
          <button className="button" onClick={() => setEdit({})}>
            {module === "inventory"
              ? "REGISTRAR AJUSTE"
              : module === "settings"
                ? "CONFIGURAR VALOR"
                : "CREAR REGISTRO"}
          </button>
        )}
        {module === "products" && (
          <div style={{ marginTop: 20 }}>
            <label>
              Subir fotografía al almacenamiento externo
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const form = new FormData();
                  form.set("file", file);
                  setBusy(true);
                  try {
                    const r = await fetch("/api/admin/upload", {
                      method: "POST",
                      body: form,
                    });
                    const d = await r.json();
                    if (!r.ok) throw new Error(d.error);
                    setMessage(
                      `Imagen disponible: ${d.url}. Añadí esta URL al campo de imágenes del producto.`,
                    );
                  } catch (err) {
                    setError(
                      err instanceof Error ? err.message : "Error de subida",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </label>
          </div>
        )}
        {edit && fields && (
          <form
            className="form-grid admin-form"
            key={`${module}-${show(edit.id || edit.key)}`}
            onSubmit={(e) => {
              e.preventDefault();
              try {
                const form = new FormData(e.currentTarget);
                const input: Row = {};
                for (const f of fields) {
                  if (f.name === "variants" && edit.id) continue;
                  const raw = String(form.get(f.name) ?? "").trim();
                  if (f.type === "checkbox") input[f.name] = form.has(f.name);
                  else if (f.type === "number") {
                    if (raw) input[f.name] = Number(raw);
                  } else if (f.type === "json") {
                    if (raw) input[f.name] = JSON.parse(raw);
                  } else if (f.type === "datetime-local")
                    input[f.name] = raw
                      ? new Date(raw).toISOString()
                      : undefined;
                  else if (raw || f.required) input[f.name] = raw;
                }
                if (
                  !window.confirm(
                    "¿Guardar estos cambios? La operación quedará registrada en auditoría.",
                  )
                )
                  return;
                void save({ id: edit.id, data: input });
              } catch {
                setError("Revisá el formato JSON de los campos avanzados.");
              }
            }}
          >
            {fields
              .filter((f) => !(f.name === "variants" && edit.id))
              .map((f) => (
                <label
                  className={f.type === "json" ? "span-two" : ""}
                  key={f.name}
                >
                  {f.label}
                  {f.type === "checkbox" ? (
                    <input
                      type="checkbox"
                      name={f.name}
                      defaultChecked={edit[f.name] === true}
                    />
                  ) : f.type === "json" ? (
                    <textarea
                      name={f.name}
                      required={f.required}
                      defaultValue={
                        edit[f.name] === undefined
                          ? ""
                          : JSON.stringify(edit[f.name], null, 2)
                      }
                      placeholder={f.hint}
                    />
                  ) : (
                    <input
                      name={f.name}
                      type={f.type || "text"}
                      required={f.required}
                      step={f.type === "number" ? "1" : undefined}
                      defaultValue={
                        f.type === "password"
                          ? ""
                          : f.type === "datetime-local" && edit[f.name]
                            ? new Date(String(edit[f.name]))
                                .toISOString()
                                .slice(0, 16)
                            : show(edit[f.name]) === "—"
                              ? ""
                              : show(edit[f.name])
                      }
                    />
                  )}
                  {f.hint && f.type !== "json" && <small>{f.hint}</small>}
                </label>
              ))}
            <button className="button" disabled={busy} type="submit">
              {busy ? "GUARDANDO…" : "GUARDAR"}
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => setEdit(null)}
            >
              Cancelar
            </button>
          </form>
        )}
        {!data && !error && (
          <p style={{ margin: "30px 0" }}>Consultando datos…</p>
        )}
        {module === "dashboard" && summary && (
          <>
            <div className="stat-grid">
              {[
                ["revenue", "Ingresos confirmados"],
                ["confirmed", "Pagos confirmados"],
                ["pending", "Pedidos pendientes"],
                ["average", "Ticket promedio"],
                ["customers", "Clientes"],
                ["products", "Productos activos"],
                ["outOfStock", "Variantes agotadas"],
              ].map(([key, label]) => (
                <div className="stat" key={key}>
                  <span>{label}</span>
                  <strong>
                    {["revenue", "average"].includes(key)
                      ? money(Number(summary[key]))
                      : show(summary[key])}
                  </strong>
                </div>
              ))}
            </div>
            <h2 style={{ marginTop: 35 }}>Ingresos diarios confirmados</h2>
            {Object.keys(summary.daily as Row).length ? (
              <div
                className="chart"
                role="img"
                aria-label="Ingresos diarios confirmados en el período"
              >
                {Object.entries(summary.daily as Record<string, number>).map(
                  ([day, value]) => (
                    <div
                      key={day}
                      title={`${day}: ${money(value)}`}
                      style={{
                        height: `${Math.max(2, (value / Math.max(...Object.values(summary.daily as Record<string, number>))) * 90)}%`,
                      }}
                    >
                      <span>{day.slice(5)}</span>
                    </div>
                  ),
                )}
              </div>
            ) : (
              <p style={{ marginTop: 20 }}>
                Sin pagos confirmados en este período.
              </p>
            )}
          </>
        )}
        {module === "security" && summary && (
          <>
            <h2 style={{ margin: "25px 0" }}>Sesiones administrativas</h2>
            <p className="product-caption">
              Dispositivo aproximado a partir de user-agent; no identifica un
              equipo de forma exacta.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {[
                      "Usuario",
                      "IP",
                      "User-agent",
                      "Actividad",
                      "Estado",
                      "Acción",
                    ].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(summary.sessions as Row[]).map((s) => (
                    <tr key={show(s.id)}>
                      <td>{show((s.account as Row).username)}</td>
                      <td>{show(s.ip)}</td>
                      <td>{show(s.userAgent)}</td>
                      <td>{show(s.lastActivity)}</td>
                      <td>
                        {s.revokedAt
                          ? "Revocada"
                          : new Date(String(s.expiresAt)) < new Date()
                            ? "Vencida"
                            : "Activa"}
                      </td>
                      <td>
                        <button
                          className="text-button"
                          disabled={busy || !!s.revokedAt}
                          onClick={() => {
                            if (window.confirm("¿Revocar esta sesión?"))
                              void save({ data: { sessionId: s.id } });
                          }}
                        >
                          Revocar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {[
              ["logins", "Accesos"],
              ["audit", "Auditoría"],
              ["emails", "Cola de correo"],
            ].map(([key, label]) => (
              <details key={key}>
                <summary>{label}</summary>
                <pre>{JSON.stringify(summary[key], null, 2)}</pre>
              </details>
            ))}
          </>
        )}
        {module === "reports" && (
          <a className="button" href={`/api/admin/reports?${query}&format=csv`}>
            EXPORTAR CSV
          </a>
        )}
        {Array.isArray(data) && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {(columns[module] || []).map((c) => (
                    <th key={c}>{labels[c] || c}</th>
                  ))}
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={show(row.id || row.key || row.reference || i)}>
                    {(columns[module] || []).map((c) => (
                      <td key={c}>
                        {c === "status"
                          ? statusLabels[String(row[c])] || show(row[c])
                          : show(row[c])}
                      </td>
                    ))}
                    <td>
                      <button
                        className="text-button"
                        onClick={() => setDetails(details === row ? null : row)}
                      >
                        Ver detalle
                      </button>
                      {fields && module !== "inventory" && (
                        <button
                          className="text-button"
                          onClick={() => {
                            setEdit(row);
                            setDetails(null);
                          }}
                        >
                          Editar
                        </button>
                      )}
                      {[
                        "products",
                        "variants",
                        "categories",
                        "collections",
                        "banners",
                        "coupons",
                        "shipping",
                        "pickups",
                      ].includes(module) && (
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                "¿Eliminar este registro? Solo se permite si no tiene dependencias que deban conservarse.",
                              )
                            )
                              void save({ id: row.id }, "DELETE");
                          }}
                        >
                          Eliminar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && (
              <p className="empty-state">
                Sin registros. Los datos aparecerán al configurar este módulo.
              </p>
            )}
          </div>
        )}
        {details && (
          <>
            <h2>Detalle</h2>
            <pre>{JSON.stringify(details, null, 2)}</pre>
            {module === "orders" && (
              <form
                className="form-stack admin-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  if (
                    window.confirm(
                      "¿Aplicar el cambio de estado? Verificá pagos y entrega antes de confirmar.",
                    )
                  )
                    void save({
                      id: details.id,
                      data: {
                        status: form.get("status"),
                        paymentVerified: form.has("verified"),
                        note: form.get("note"),
                        pickupCode: form.get("pickupCode") || undefined,
                        tracking: form.get("tracking") || undefined,
                        carrier: form.get("carrier") || undefined,
                      },
                    });
                }}
              >
                <label>
                  Nuevo estado
                  <select name="status">
                    {statuses.map((s) => (
                      <option key={s} value={s}>
                        {statusLabels[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Retiro: código entregado por cliente
                  <input name="pickupCode" maxLength={20} />
                </label>
                <label>
                  Envío: número de guía (opcional)
                  <input name="tracking" maxLength={120} />
                </label>
                <label>
                  Transportista (opcional)
                  <input name="carrier" maxLength={80} />
                </label>
                <label>
                  Motivo
                  <textarea
                    name="note"
                    minLength={3}
                    maxLength={500}
                    required
                  />
                </label>
                <label className="check-label">
                  <input type="checkbox" name="verified" /> Verifiqué el ingreso
                  o reembolso real en la cuenta bancaria
                </label>
                <button className="button" type="submit" disabled={busy}>
                  APLICAR TRANSICIÓN
                </button>
              </form>
            )}
            <button className="text-button" onClick={() => setDetails(null)}>
              Cerrar detalle
            </button>
          </>
        )}
        <p style={{ marginTop: 35 }} className="product-caption">
          Listados limitados a los últimos registros. Exportación: hasta 10 000
          pedidos por período.
        </p>
        <Link className="underlined-link" href="/">
          VER TIENDA
        </Link>
      </section>
    </div>
  );
}
