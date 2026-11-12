"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
type Mode =
  | "login"
  | "register"
  | "forgot"
  | "reset"
  | "verify"
  | "admin-login";
export function AuthForm({ mode, token = "" }: { mode: Mode; token?: string }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<Record<string, string>>();
  const titles: Record<Mode, string> = {
    login: "Qué bueno verte.",
    register: "Hacé espacio para vos.",
    forgot: "Volvé a tu cuenta.",
    reset: "Una nueva contraseña.",
    verify: "Confirmá tu correo.",
    "admin-login": "Acceso administrativo.",
  };
  async function submit(data: Record<string, string>) {
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...data, ...(token ? { token } : {}) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setMessage(result.message || "Sesión iniciada");
      if (mode === "login" || mode === "admin-login") {
        window.dispatchEvent(new Event("joswear-auth"));
        router.push(mode === "admin-login" ? "/admin" : "/cuenta");
        router.refresh();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo completar la solicitud",
      );
    }
  }
  return (
    <section className="auth-card">
      <p className="eyebrow">
        {mode === "admin-login" ? "JOSWEAR / ADMINISTRACIÓN" : "TU JOSWEAR"}
      </p>
      <h1>{titles[mode]}</h1>
      <form className="form-stack" onSubmit={handleSubmit(submit)}>
        {mode === "register" && (
          <>
            <div className="form-grid">
              <label>
                Nombre
                <input
                  autoComplete="given-name"
                  maxLength={60}
                  required
                  {...register("firstName")}
                />
              </label>
              <label>
                Apellidos
                <input
                  autoComplete="family-name"
                  maxLength={80}
                  required
                  {...register("lastName")}
                />
              </label>
            </div>
            <label>
              Nombre de usuario
              <input
                autoComplete="username"
                minLength={3}
                maxLength={32}
                pattern="[a-z0-9_]+"
                required
                {...register("username")}
              />
            </label>
          </>
        )}
        {(mode === "register" || mode === "forgot") && (
          <label>
            Correo electrónico
            <input
              type="email"
              autoComplete="email"
              maxLength={180}
              required
              {...register("email")}
            />
          </label>
        )}
        {(mode === "login" || mode === "admin-login") && (
          <label>
            {mode === "admin-login"
              ? "Usuario administrativo"
              : "Correo o usuario"}
            <input
              autoComplete="username"
              maxLength={180}
              required
              {...register("identity")}
            />
          </label>
        )}
        {["login", "register", "reset", "admin-login"].includes(mode) && (
          <label>
            Contraseña
            <input
              type="password"
              autoComplete={
                mode === "register" || mode === "reset"
                  ? "new-password"
                  : "current-password"
              }
              minLength={mode === "register" || mode === "reset" ? 12 : 1}
              maxLength={128}
              required
              {...register("password")}
            />
            {(mode === "register" || mode === "reset") && (
              <small>Al menos 12 caracteres.</small>
            )}
          </label>
        )}
        {mode === "admin-login" && (
          <label>
            Código MFA
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              {...register("code")}
            />
            <small>Obligatorio para SUPER_ADMIN y cuentas con MFA.</small>
          </label>
        )}
        {mode === "verify" && (
          <p>Confirmá para activar tu cuenta. El enlace vence en 24 horas.</p>
        )}
        {message && (
          <p role="status" className="form-message">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="form-message error-message">
            {error}
          </p>
        )}
        <button className="button wide" type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "PROCESANDO…"
            : mode === "register"
              ? "CREAR CUENTA"
              : mode === "forgot"
                ? "ENVIAR INSTRUCCIONES"
                : mode === "verify"
                  ? "VERIFICAR CORREO"
                  : mode === "reset"
                    ? "GUARDAR CONTRASEÑA"
                    : "INICIAR SESIÓN"}
        </button>
      </form>
      <div className="auth-links">
        <Link href="/cuenta/login">Iniciar sesión</Link>
        {mode === "login" ? (
          <>
            <Link href="/cuenta/registro">Crear cuenta</Link>
            <Link href="/cuenta/recuperar">Olvidé mi contraseña</Link>
          </>
        ) : (
          <Link href="/tienda">Volver a la tienda</Link>
        )}
      </div>
    </section>
  );
}
