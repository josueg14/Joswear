import { policies } from "@/modules/catalog/policies";
export const dynamic = "force-dynamic";
export default async function Help() {
  const content = await policies();
  return (
    <article className="section prose">
      <p className="eyebrow">ESTAMOS PARA VOS</p>
      <h1>Comprá con claridad.</h1>
      <h2>Envíos en Costa Rica</h2>
      <p>
        Las zonas habilitadas y tarifas se muestran al ingresar tu dirección en
        el checkout. Solo se aceptan pedidos para zonas configuradas; no se
        presume cobertura ni se asignan tarifas sin confirmar.
      </p>
      <h2>Retiro presencial</h2>
      <p>
        Los puntos de retiro, sus horarios y direcciones se muestran cuando
        estén habilitados por la tienda. Esperá la confirmación de pedido listo
        antes de trasladarte.
      </p>
      <h2>WhatsApp y pagos</h2>
      <p>
        Una solicitud por WhatsApp queda pendiente. SINPE requiere verificación
        del ingreso real por JOSWEAR. El pago online estará disponible cuando la
        marca configure su pasarela.
      </p>
      <h2 id="cambios">Cambios y devoluciones</h2>
      {content.returnsPolicy ? (
        <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.9 }}>
          {content.returnsPolicy}
        </div>
      ) : (
        <p>
          La política comercial definitiva y los canales de contacto están
          pendientes de ser proporcionados por JOSWEAR. No se publican plazos ni
          condiciones sin aprobación del propietario. Los derechos legales
          aplicables del consumidor se mantienen.
        </p>
      )}
    </article>
  );
}
