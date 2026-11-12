"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowUpRight } from "lucide-react";
import { useStore } from "./store-provider";
import { money } from "@/modules/orders/domain";
const schema = z.object({
  name: z.string().min(3, "Ingresá tu nombre completo"),
  email: z.email("Revisá tu correo"),
  phone: z
    .string()
    .regex(/^(?:\+506)?[2-8]\d{7}$/, "Teléfono de Costa Rica inválido"),
  delivery: z.enum(["shipping", "pickup"]),
  method: z.enum(["whatsapp", "sinpe", "online"]),
  zoneId: z.string(),
  pickupLocationId: z.string(),
  province: z.string(),
  canton: z.string(),
  district: z.string(),
  detail: z.string(),
  reference: z.string(),
  coupon: z.string(),
  consent: z
    .boolean()
    .refine(
      Boolean,
      "Aceptá el tratamiento necesario para gestionar tu pedido",
    ),
});
type Fields = z.infer<typeof schema>;
type Delivery = {
  demo: boolean;
  commerceEnabled?: boolean;
  methods: string[];
  zones: {
    id: string;
    name: string;
    province: string;
    canton: string | null;
    district: string | null;
    rates: { price: number; freeFrom: number | null }[];
  }[];
  pickups: { id: string; name: string; address: string; hours: string }[];
};
export function Checkout() {
  const store = useStore();
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    reference: string;
    total: number;
    message: string;
    whatsappUrl?: string;
    instructions?: string;
  } | null>(null);
  const [key] = useState(() => crypto.randomUUID());
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Fields>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      delivery: "shipping",
      method: "whatsapp",
      zoneId: "",
      pickupLocationId: "",
      province: "",
      canton: "",
      district: "",
      detail: "",
      reference: "",
      coupon: "",
      consent: false,
    },
  });
  const values = useWatch({ control });
  useEffect(() => {
    fetch("/api/delivery")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        setDelivery(data);
        if (data.methods?.length) setValue("method", data.methods[0]);
      })
      .catch(() =>
        setError(
          "No pudimos consultar las opciones de entrega. Intentá nuevamente.",
        ),
      );
  }, [setValue]);
  const subtotal = store.lines.reduce((s, x) => s + x.price * x.quantity, 0);
  const zone = delivery?.zones.find((x) => x.id === values.zoneId);
  const rate = zone?.rates[0];
  const shipping =
    values.delivery === "pickup"
      ? 0
      : rate
        ? rate.freeFrom !== null && subtotal >= rate.freeFrom
          ? 0
          : rate.price
        : null;
  async function submit(data: Fields) {
    setError("");
    if (delivery?.demo) {
      setResult({
        reference: `DEMO-${key.slice(0, 8).toUpperCase()}`,
        total: subtotal,
        message:
          "Simulación finalizada. No se creó un pedido, no se reservó inventario y no se envió ninguna solicitud.",
      });
      return;
    }
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: key,
          name: data.name,
          email: data.email,
          phone: data.phone,
          delivery: data.delivery,
          method: data.method,
          zoneId: data.zoneId,
          pickupLocationId: data.pickupLocationId,
          coupon: data.coupon || undefined,
          items: store.lines.map((x) => ({
            variantId: x.variantId,
            quantity: x.quantity,
          })),
          address:
            data.delivery === "shipping"
              ? {
                  province: data.province,
                  canton: data.canton,
                  district: data.district,
                  detail: data.detail,
                  reference: data.reference,
                }
              : undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setResult(result);
      store.clear();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo completar el pedido",
      );
    }
  }
  if (result)
    return (
      <section className="section empty-state">
        <p className="eyebrow" style={{ justifyContent: "center" }}>
          {delivery?.demo ? "SIMULACIÓN" : "SOLICITUD RECIBIDA"}
        </p>
        <h1 className="page-title">{result.reference}</h1>
        <p>{result.message}</p>
        <p>
          {delivery?.demo ? "Subtotal de práctica" : "Total"}:{" "}
          {money(result.total)}
        </p>
        {result.instructions && <p>{result.instructions}</p>}
        {result.whatsappUrl && (
          <a
            className="button"
            href={result.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            ABRIR WHATSAPP <ArrowUpRight size={18} />
          </a>
        )}
        <p>
          <Link className="underlined-link" href="/tienda">
            Volver a la tienda
          </Link>
        </p>
      </section>
    );
  if (!store.ready) return <div className="loading">Cargando tu bolsa…</div>;
  if (!store.lines.length)
    return (
      <section className="section empty-state">
        <h1 className="page-title">Tu bolsa está vacía.</h1>
        <Link className="button" href="/tienda">
          Explorar prendas
        </Link>
      </section>
    );
  return (
    <section className="section">
      <p className="eyebrow">UN PASO MÁS CERCA</p>
      <h1 className="page-title">A tu manera.</h1>
      {delivery?.demo && (
        <p className="demo-notice">
          CHECKOUT DE PRÁCTICA · Usá datos ficticios. La simulación no envía ni
          guarda datos personales.
        </p>
      )}
      <form className="checkout-layout" onSubmit={handleSubmit(submit)}>
        <div>
          <h2>01 / Tus datos</h2>
          <div className="form-grid">
            <label className="span-two">
              Nombre completo
              <input autoComplete="name" {...register("name")} />
            </label>
            <label>
              Correo electrónico
              <input type="email" autoComplete="email" {...register("email")} />
            </label>
            <label>
              Teléfono
              <input
                type="tel"
                autoComplete="tel"
                placeholder="8 dígitos"
                {...register("phone")}
              />
            </label>
          </div>
          <h2>02 / ¿Cómo lo recibís?</h2>
          <div className="radio-options">
            <label>
              <input type="radio" value="shipping" {...register("delivery")} />{" "}
              Envío a domicilio
            </label>
            <label>
              <input type="radio" value="pickup" {...register("delivery")} />{" "}
              Retiro presencial
            </label>
          </div>
          {values.delivery === "shipping" ? (
            <div className="form-grid" style={{ marginTop: 20 }}>
              {!delivery?.demo && (
                <label className="span-two">
                  Zona de envío
                  <select
                    {...register("zoneId", {
                      onChange: (e) => {
                        const z = delivery?.zones.find(
                          (x) => x.id === e.target.value,
                        );
                        if (z) {
                          setValue("province", z.province);
                          setValue("canton", z.canton || "");
                          setValue("district", z.district || "");
                        }
                      },
                    })}
                  >
                    <option value="">Seleccioná una zona habilitada</option>
                    {delivery?.zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Provincia
                <select {...register("province")}>
                  <option value="">Seleccioná</option>
                  {[
                    "San José",
                    "Alajuela",
                    "Cartago",
                    "Heredia",
                    "Guanacaste",
                    "Puntarenas",
                    "Limón",
                  ].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label>
                Cantón
                <input {...register("canton")} />
              </label>
              <label>
                Distrito
                <input {...register("district")} />
              </label>
              <label>
                Referencias
                <input {...register("reference")} />
              </label>
              <label className="span-two">
                Dirección exacta
                <textarea {...register("detail")} />
              </label>
              {!delivery?.demo && !delivery?.zones.length && (
                <p className="form-message span-two">
                  La tienda todavía no ha configurado zonas ni tarifas de envío.
                </p>
              )}
            </div>
          ) : (
            <div style={{ marginTop: 20 }}>
              <label>
                Punto de retiro
                <select {...register("pickupLocationId")}>
                  <option value="">
                    {delivery?.demo
                      ? "Sin puntos de retiro en la demostración"
                      : "Seleccioná un punto de retiro"}
                  </option>
                  {delivery?.pickups.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.address} — {p.hours}
                    </option>
                  ))}
                </select>
              </label>
              {!delivery?.pickups.length && (
                <p className="form-message" style={{ marginTop: 15 }}>
                  No hay direcciones de retiro proporcionadas por JOSWEAR.
                </p>
              )}
            </div>
          )}
          <h2>03 / ¿Cómo querés comprar?</h2>
          <div className="radio-options">
            {[
              ["whatsapp", "WhatsApp"],
              ["sinpe", "SINPE Móvil"],
              ["online", "Pago online"],
            ].map(([value, text]) => (
              <label key={value}>
                <input
                  type="radio"
                  value={value}
                  disabled={
                    !delivery?.demo && !delivery?.methods.includes(value)
                  }
                  {...register("method")}
                />
                {text}
                {value === "online" && <small>Pendiente</small>}
              </label>
            ))}
          </div>
          <p className="product-caption" style={{ margin: "18px 0" }}>
            La solicitud queda pendiente. Los comprobantes no confirman pagos
            automáticamente.
          </p>
          <label className="check-label">
            <input type="checkbox" {...register("consent")} />
            <span>
              Acepto el uso de mis datos para gestionar esta solicitud.{" "}
              <Link className="underlined-link" href="/privacidad">
                Privacidad
              </Link>
            </span>
          </label>
        </div>
        <aside className="order-summary">
          <h2>Tu selección</h2>
          {store.lines.map((x) => (
            <div className="summary-row" key={x.variantId}>
              <span>
                {x.quantity} × {x.name}
                <br />
                <small>
                  {x.size} / {x.color}
                </small>
              </span>
              <span>{money(x.price * x.quantity)}</span>
            </div>
          ))}
          <label>
            Cupón
            <input
              {...register("coupon")}
              disabled={delivery?.demo}
              placeholder="Código de descuento"
            />
          </label>
          <div className="summary-row">
            <span>Subtotal estimado</span>
            <span>{money(subtotal)}</span>
          </div>
          <div className="summary-row">
            <span>Entrega</span>
            <span>
              {delivery?.demo
                ? "Sin tarifa demo"
                : shipping === null
                  ? "Seleccioná una zona"
                  : money(shipping)}
            </span>
          </div>
          <div className="summary-row summary-total">
            <span>Estimado</span>
            <span>{money(subtotal + (shipping || 0))}</span>
          </div>
          <p>
            El servidor aplicará el cupón y verificará el total al crear tu
            solicitud.
          </p>
          {Object.values(errors).map((e, i) => (
            <p className="error-message form-message" role="alert" key={i}>
              {e.message}
            </p>
          ))}
          {error && (
            <p className="form-message error-message" role="alert">
              {error}
            </p>
          )}
          <button
            className="button"
            disabled={
              isSubmitting ||
              !delivery ||
              (!delivery.demo && !delivery.commerceEnabled)
            }
            type="submit"
          >
            {isSubmitting
              ? "PROCESANDO…"
              : delivery?.demo
                ? "PROBAR CHECKOUT"
                : "CREAR SOLICITUD"}
            <ArrowUpRight size={18} />
          </button>
          {!delivery?.demo && !delivery?.commerceEnabled && (
            <p>Las compras reales aún no están habilitadas.</p>
          )}
        </aside>
      </form>
    </section>
  );
}
