import { policies } from "@/modules/catalog/policies";
export const dynamic = "force-dynamic";
export default async function Privacy() {
  const content = await policies();
  if (content.privacyPolicy)
    return (
      <article className="section prose">
        <p className="eyebrow">{content.merchantName || "JOSWEAR"}</p>
        <h1>Privacidad.</h1>
        <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.9 }}>
          {content.privacyPolicy}
        </div>
        {content.merchantEmail && (
          <p>
            <a href={`mailto:${content.merchantEmail}`}>
              {content.merchantEmail}
            </a>
          </p>
        )}
      </article>
    );
  return (
    <article className="section prose">
      <p className="eyebrow">TUS DATOS</p>
      <h1>Privacidad.</h1>
      <p>
        Este entorno es una implementación en preparación. Antes de aceptar
        compras reales, JOSWEAR debe proporcionar la identidad y contacto del
        responsable, plazos de conservación, encargados del tratamiento y
        procedimiento para ejercer derechos conforme a la Ley 8968 de Costa
        Rica.
      </p>
      <h2>Datos necesarios</h2>
      <p>
        El registro y el checkout solicitan datos para gestionar la cuenta,
        entregar pedidos y enviar comunicaciones transaccionales. No se solicita
        consentimiento de marketing de forma implícita. No se almacenan números
        de tarjeta ni códigos de seguridad.
      </p>
      <h2>Almacenamiento del navegador</h2>
      <p>
        La bolsa y los favoritos se conservan localmente en este navegador. Las
        sesiones utilizan cookies HttpOnly. Podés borrar los datos locales desde
        la configuración del navegador y cerrar las sesiones desde tu cuenta.
      </p>
      <h2>Seguridad y registros</h2>
      <p>
        Los accesos administrativos generan registros de seguridad con acceso
        restringido. La información de dispositivo se aproxima mediante
        user-agent y no identifica de forma exacta un equipo físico.
      </p>
    </article>
  );
}
