# JOSWEAR — progreso verificable

## Fase 0 — Auditoría
- El 2026-11-02 el workspace solo contenía `.git`; todos los archivos de HEAD estaban eliminados antes de iniciar. No se restauran eliminaciones ni se modifica SQLite existente en Git.
- HEAD `02afd97`: Express 4, JavaScript, SQLite, bcrypt, JWT en navegador, HTML/CSS; node_modules y .env estaban versionados. Sin tests ni migraciones.
- Se revisaron servidor, registro/login, catálogo, checkout y portada desde Git. No se pudo ejecutar la versión anterior por ausencia de archivos/dependencias.
- Fallos previos: total confiado al navegador, sin reserva transaccional por variante, administrador con clave fija, datos de ejemplo expresados en dólares, recursos Picsum y testimonios sin fuente.
- No existen logos ni fotografías originales en HEAD ni en el workspace. No se presentan imágenes de terceros como oficiales.
- Migración: Next App Router y dominios separados; CRC entero; PostgreSQL con migraciones; sesiones opacas y permisos en servidor; outbox Brevo; adaptadores externos cerrados por defecto.
- Preservar intención funcional: tienda, categorías, carrito, registro/login, pedidos y administración. Migración de clientes requiere reset de contraseña; importación de SQLite exige copia privada y revisión de precios/moneda, nunca conversión automática.

## Estado por fase
| Fase | Implementación y evidencia | Dependencias o límites |
|---|---|---|
| 0 | Auditoría de HEAD, plan de migración, README y ejemplo de entorno. | No era posible ejecutar el checkout inicial vacío. |
| 1 | Editorial Ivory, tokens, header sticky, navegación móvil, hero configurable, categorías, tarjetas con segunda imagen, animaciones y reduced-motion. | Logo/fotos originales ausentes; wordmark textual e ilustraciones DEMO explícitas. Tipografías del sistema, sin redistribuir fuentes. No se afirma certificación WCAG/Core Web Vitals. |
| 2 | PostgreSQL/Prisma 7.10.1, modelos solicitados más sesiones cliente y alertas; tres migraciones SQL, CHECK de importes/stock, índices y unicidad. | Probado localmente en PostgreSQL 17 aislado, no en Render. |
| 3 | Registro, verificación, login por usuario/correo, reset de un uso, sesiones y direcciones; admin independiente, bootstrap, TOTP cifrado y antireplay, permisos de servidor. | El propietario debe provisionar su SUPER_ADMIN. Recuperación de MFA es operativa/manual; no hay credenciales predeterminadas. |
| 4 | Crear/editar/despublicar productos, variantes e inventario; eliminación bloqueada con dependencias, galería, subida validada/recodificada, filtros, búsqueda con datalist, favoritos, relacionados y alertas. | Almacenamiento requiere gateway HTTPS configurado. Favoritos locales; no sincronizan entre dispositivos. Formularios administrativos avanzados usan JSON para variantes/imágenes/permisos. |
| 5 | Bolsa invitado local validada, carrito de cuenta PostgreSQL y combinación al login; checkout con precios/stock en servidor, cupones, referencia e idempotencia. WhatsApp y SINPE manual. | Online productivo pendiente de proveedor aprobado. La demostración no crea pedidos. Reservas pendientes se cancelan manualmente; no hay vencimiento comercial automático. |
| 6 | Zonas, tarifas, umbral gratuito y direcciones validadas contra zona; retiro con ubicación, horarios, código y confirmación; guía opcional. | Datos comerciales y transportista reales no proporcionados. |
| 7 | Plantillas transaccionales, outbox, claim, reintentos, sandbox sin envíos, clave idempotente Brevo y alertas administrativas configurables. | No se probó envío real, dominio ni remitente. No se promete entrega exactamente una vez fuera de la ventana de idempotencia del proveedor. |
| 8 | Panel responsive, sidebar colapsable, métricas desde pagos confirmados por fecha, gráfico, módulos de gestión, CSV, errores/estados vacíos y confirmaciones. | Listados limitados; sin paginación avanzada. Datos de demostración no se publican como métricas de ventas. |
| 9 | Cookies seguras, revocación, límites persistentes, CSRF por origen/JSON, límites de cuerpos, Argon2id, auditoría y aislamiento por permisos/propietario. Retención en dry-run y script aplicable con política aprobada. | Sin pentest externo ni evaluación legal formal. Dispositivo se muestra como user-agent aproximado. |
| 10 | Máquina de estados, historial, conciliación manual, reserva transaccional, cancelación con reposición única, correo de pedido/pago/envío/retiro y seguimiento desde cuenta. | Reembolso administrativo requiere verificar movimiento real; no inicia un reembolso bancario externo. |
| 11 | render.yaml, health, predeploy de migraciones, instrucciones de secretos, backups/restauración, Brevo y almacenamiento; CI escrito. | Blueprint propone recursos de pago: no se ejecutó. No hay despliegue, dominio, backups ni monitorización remotos verificados. |
| 12 | Seed marcado DEMO sin administrador, lint/typecheck/build y baterías Vitest/Playwright. Resultados finales se registran abajo. | Los flujos externos requieren credenciales y validación posterior. |

## Verificaciones
- Prisma 7.10.1: generación, validación y tres migraciones aplicadas en la instancia PostgreSQL local aislada, puerto 55439.
- Seed ejecutado: seis productos DEMO sin publicar; ningún administrador de negocio.
- Vitest: 32 pruebas unitarias aprobadas (CRC, estados, checkout, firma, MFA/cifrado, plantillas y sanitización de imágenes).
- Integración PostgreSQL: 11 pruebas aprobadas (stock concurrente, idempotencia, cancelación, tarifas, cupón, conciliación, retiro y webhook firmado/idempotente).
- Playwright API: 5 pruebas aprobadas (registro/verificación/reset, MFA y antireplay, permisos STAFF, producto/validación y costo excluido de datos públicos, CSRF y límite de solicitudes concurrentes).
- Playwright navegador: 7 aprobadas, 1 omitida intencionalmente (el caso exclusivamente móvil no se ejecuta en escritorio). Verifica tallas, bolsa persistente, favoritos, filtros, checkout de práctica y menú móvil sin desbordamiento.
- Lint y typecheck sin errores. Compilación Next.js de producción aprobada. Inspección visual local de portada a 1440 y 390 px completada.
- Total: 55 pruebas aprobadas; ningún correo ni pago real enviado. CI remoto no ejecutado.
- `npm audit --omit=dev`: 0 vulnerabilidades. Auditoría completa: 16 alertas moderadas transitivas de herramientas ESLint/minimatch; no se aplicó un downgrade incompatible sugerido por `audit --force`.

## Dependencias del propietario
Logo original, fotografías y catálogo/precios reales, WhatsApp, datos de retiro, zonas/tarifas, políticas legales, dominio, PostgreSQL, remitente Brevo verificado, almacenamiento externo y elección de pasarela. No se necesitan para compilar o explorar el modo demostración.

## Decisiones
- Sin publicación remota ni gastos externos.
- El checkout sandbox no se anuncia como pedido real ni pago confirmado.
- No se confirma pago con comprobantes ni con datos del navegador.
- Los cambios anteriores a la sesión quedan fuera de los commits de hitos; no se incluirán secretos, SQLite ni node_modules.
