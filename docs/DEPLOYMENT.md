# Render y operaciones

## Antes de producción
El blueprint [render.yaml](../render.yaml) propone recursos de pago. No se ha ejecutado ni autorizado ningún gasto o despliegue. Revisar precios/planes actuales de Render antes de aprobarlo.

1. Conectar un repositorio GitHub privado. Confirmar que `.env`, SQLite y node_modules NO están en la rama publicada. El commit original los incluía; rotar cualquier secreto real de ese historial y purgarlo en una operación separada autorizada.
2. Crear PostgreSQL persistente y servicio Node con el blueprint. Configurar APP_URL con el origen HTTPS final, DATABASE_URL privada y MFA_ENCRYPTION_KEY aleatoria de 32 bytes en hex. La aplicación no inventa dominio.
3. Build `npm ci && npm run build`; predeploy `npm run db:migrate`; inicio `npm start`. No usar `db push` en producción. Revisar SQL de migración y snapshot antes de aplicarlo.
4. Bootstrap desde una consola privada: suministrar BOOTSTRAP_USERNAME, BOOTSTRAP_PASSWORD (mínimo 16 caracteres) y un secreto TOTP base32 de al menos 32 caracteres ya registrado en el autenticador del propietario. Ejecutar `npm run admin:bootstrap` una sola vez; borrar esas variables. El proceso no imprime secretos. Guardar MFA_ENCRYPTION_KEY en un gestor de secretos; perderla bloquea descifrado MFA. La recuperación de MFA necesita un procedimiento manual autenticado por el propietario.
5. Cargar el logo original en public/ y configurar NEXT_PUBLIC_LOGO_URL (requiere rebuild). Configurar almacenamiento externo y subir fotos reales; no usar disco efímero.
6. Crear categorías, colección, productos/variantes, zonas con tarifas reales y puntos de retiro. Configurar WhatsApp en formato `506` + 8 dígitos, SINPE opcional y políticas aprobadas. No activar `commerceEnabled` hasta completar y revisar todo.
7. Brevo: autenticar dominio (SPF/DKIM/DMARC), verificar remitente, establecer BREVO_API_KEY y BREVO_SENDER_EMAIL, EMAIL_MODE=live. Programar `npm run email:worker` cada minuto con un scheduler o worker dedicado. Un lote procesa 20 trabajos; hasta cinco intentos con retroceso exponencial. Supervisar FAILED. En sandbox la cola no se consume ni se imprimen enlaces de autenticación.
8. Pagos online: seleccionar pasarela autorizada con el propietario, implementar PaymentProvider, crear intento alojado, comprobar firma, importe, moneda, asociación y evento único, y actualizar pedido/cola en transacción. El adaptador sandbox valida eventos para pruebas, no confirma pedidos reales. No existe una pasarela productiva implementada.
9. Probar `/api/health`, assets, compra real de prueba, cancelación, restauración de stock, registro/verificación/recuperación, MFA, permisos y entrega de correo. DNS/HTTPS y verificación posterior requieren acceso que no se ha proporcionado.

## Contrato del almacenamiento
POST HTTPS a STORAGE_UPLOAD_URL con bearer STORAGE_UPLOAD_TOKEN y cuerpo binario WebP. La aplicación recibe JPEG/PNG/WebP (máximo 5 MB y 40 megapíxeles), decodifica/recodifica con Sharp, elimina EXIF y limita dimensiones a 3000 px. Respuesta JSON `{ "url": "https://origen-permitido/clave.webp" }` bajo STORAGE_PUBLIC_ORIGIN. El servicio externo debe publicar Content-Type correcto con nosniff. Este adaptador no presupone S3/Cloudinary ni credenciales; enlazar su API mediante un gateway propio o sustituir el adaptador por SDK aprobado. No acepta SVG/HTML.

## Backups y restauración
Habilitar backups/PITR de Render conforme al plan contratado. Adicionalmente ejecutar `pg_dump --format=custom --file=backup.dump` con PGHOST/PGUSER/PGDATABASE/PGPASSWORD en entorno privado. Cifrar backup, limitar acceso y probarlo periódicamente. Restaurar a una base nueva mediante `pg_restore --no-owner --dbname=... backup.dump`; nunca sobre la base de producción sin aprobación y snapshot. Aplicar migraciones pendientes, verificar conteos, importes y referencias, ejecutar health y flujos de compra, luego cambiar DATABASE_URL durante mantenimiento. Respaldar también imágenes y clave MFA por canales separados. Definir RPO/RTO con el propietario.

## Observabilidad y privacidad
Health revela conectividad, no secretos. Auditar operaciones desde Seguridad; no exportar tokens, claves o contraseñas. Los campos user-agent/IP son aproximados. Configurar SECURITY_RETENTION_DAYS según política legal; `npm run security:retention` muestra conteos sin modificar y `npm run security:retention -- --apply` aplica la política. Definir con responsable el plazo legal de pedidos y auditoría antes de automatizar borrados. La eliminación de datos de clientes aún necesita un procedimiento operativo. Publicar privacyPolicy, returnsPolicy, merchantName y merchantEmail en configuración; policiesApproved declara la aprobación del propietario. El servidor exige esos datos, HTTPS y Brevo real antes de habilitar commerceEnabled.

## Límites actuales
Consultar [PROGRESS.md](../PROGRESS.md) antes de considerar este sistema listo para aceptar ventas. No se ha desplegado. No hay integración productiva con transportistas, pasarela, backups ni monitorización externa.
