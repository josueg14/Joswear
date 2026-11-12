# JOSWEAR

Migración local de la tienda a Next.js App Router, TypeScript, PostgreSQL/Prisma y Editorial Ivory. Estado y límites en [PROGRESS.md](./PROGRESS.md).

## Desarrollo
Node >=22.12. En PowerShell usar `npm.cmd` si la política bloquea npm.ps1.

```sh
npm ci
cp .env.example .env
npm run db:generate
npm run dev
```

Sin PostgreSQL, activar `DEMO_MODE=true`: catálogo identificado como demostración, carrito local y checkout de práctica sin pedidos reales. Sin `.env`, la portada funciona como previsualización; las API de datos requieren PostgreSQL.

```sh
npm run db:migrate
npm run db:seed
npm run admin:bootstrap
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Las pruebas de integración/API exigen una **base aislada** con URL `postgresql://joswear_test@127.0.0.1:55439/joswear_test?schema=public`; crean datos ficticios y limpian sus fixtures. No apuntarlas a producción. Ejecutar `npm run test:integration` y `npm run test:api` con esa URL en el entorno. Para Playwright instalar Chromium con `npx playwright install chromium` si no está disponible. CI define una instancia PostgreSQL descartable con ese nombre y puerto.

## Guías
- [Arquitectura y límites](./docs/ARCHITECTURE.md)
- [Render, almacenamiento, Brevo, backups y operación](./docs/DEPLOYMENT.md)
- [Variables de entorno](./.env.example)
- [Estado por fase y validaciones](./PROGRESS.md)

## Arquitectura
`src/app`: páginas y API; `src/modules`: dominio, validación y servicios; `src/lib`: base de datos/seguridad; `prisma`: esquema, migraciones y seed explícito; `scripts`: bootstrap y worker. Dinero: enteros CRC. Las integraciones comerciales quedan deshabilitadas hasta configurarse. No se conservan las credenciales inseguras del sistema anterior.

## Datos anteriores
El checkout estaba vacío al iniciar; el historial conserva el sistema anterior. No se restaura ni convierte su SQLite automáticamente. Respaldar los archivos privados y definir equivalencias de moneda, categorías y variantes antes de importar. Los hashes bcrypt requieren un restablecimiento seguro, no se reutilizan como Argon2id.
