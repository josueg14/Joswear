import Link from "next/link";
import { redirect } from "next/navigation";
import { isDemo } from "@/lib/db";
import { adminSession } from "@/lib/security";
import { Admin } from "@/components/admin";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Administración",
  robots: { index: false, follow: false },
};
export default async function Page() {
  if (isDemo())
    return (
      <section className="section empty-state">
        <p className="eyebrow" style={{ justifyContent: "center" }}>
          ADMINISTRACIÓN JOSWEAR
        </p>
        <h1 className="page-title">Prepará tu tienda.</h1>
        <p>
          Conectá PostgreSQL, aplicá las migraciones y ejecutá el bootstrap
          seguro para crear tu SUPER_ADMIN con MFA. Este entorno no contiene
          credenciales predeterminadas ni estadísticas ficticias.
        </p>
        <Link className="button" href="/admin/login">
          ACCESO ADMINISTRATIVO
        </Link>
      </section>
    );
  let username;
  try {
    username = (await adminSession()).account.username;
  } catch {
    redirect("/admin/login");
  }
  return <Admin username={username} />;
}
