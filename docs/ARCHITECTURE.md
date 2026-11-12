# Arquitectura y límites

## Capas
App Router ofrece páginas y handlers Node. Las páginas públicas solo reciben una proyección del catálogo que excluye costo y otros campos internos. Los formularios usan validación en cliente para orientar; Zod en servidor es la autoridad. `src/modules/orders` contiene reglas de importes, estados y transacciones; `src/lib` contiene HTTP, sesiones, criptografía y Prisma. `src/modules/email` implementa una outbox transaccional; `src/modules/payments` define el contrato de pasarela. El administrador consume las API con los mismos controles que cualquier cliente HTTP.

## Sesiones y autorización
Clientes y administradores usan cookies distintas, tokens aleatorios de 256 bits y solo guardan SHA-256 del token. Login rota la sesión previa del mismo navegador; logout/reset revocan en PostgreSQL. Cookies HttpOnly, SameSite=Lax y Secure en producción; cliente 7 días, admin 8 horas. Mutaciones de navegador exigen origen exacto APP_URL, JSON y límite de cuerpo. El despliegue debe recibir exclusivamente tráfico por el proxy confiable de Render. La IP de seguridad usa el último salto agregado por ese proxy; revisar esta suposición si se cambia la infraestructura. Fuera de Render usa `local`, sin confiar en cabeceras arbitrarias.

Solo SUPER_ADMIN administra usuarios internos/configuración. El índice parcial permite un solo SUPER_ADMIN, bootstrap usa bloqueo transaccional y rechaza una base con administradores. TOTP valida ventana ±1 y consume el contador de forma atómica para evitar replay; el secreto se cifra AES-256-GCM con IV aleatorio. No se ha implementado recuperación automática de MFA. Los demás roles tienen permisos explícitos por recurso/acción y sin asignaciones implícitas. No pueden darse permisos a sí mismos.

Los intentos se limitan en PostgreSQL por identidad e IP (6/35 fallos por 15 minutos), adecuados para el servicio inicial. Para tráfico elevado, trasladar el limitador a una operación atómica/Redis y aplicar límites en el proxy; el conteo actual puede tolerar peticiones paralelas en el borde del límite. Registro y recuperación también tienen límites. Los mensajes de recuperación no revelan si existe la cuenta. Un escáner de seguridad externo y una revisión legal siguen siendo necesarios antes de producción.

## Dinero, inventario y pedidos
CRC entero, nunca coma flotante. El cliente envía únicamente IDs/cantidades y contacto. La transacción Serializable vuelve a leer precios/publicación, verifica zonas y cupones, reduce stock con condición `stock >= cantidad` y crea pedido, movimientos, historial, pago pendiente y correo. Las variantes se bloquean en orden estable. Una colisión serializable pide reintento; las solicitudes usan UUID de idempotencia más hash del contenido y cliente. Un reintento equivalente devuelve la misma referencia sin nueva reserva.

WhatsApp solo recibe un enlace oficial tras persistir la solicitud pendiente. SINPE necesita conciliación explícita por un administrador con permiso de pagos. La máquina de estados impide saltos, reponer dos veces y retirar pedidos de envío. La cancelación repone inventario y uso del cupón una vez. Un reembolso no afirma devolución física de prendas: registrar el ingreso inspeccionado por Inventario. Pedidos pendientes reservan stock hasta cancelación manual; no se ha fijado un vencimiento comercial automático. Definirlo con el propietario antes de exponer compras a gran volumen.

Retiro genera código aleatorio, guarda digest y lo comunica por la cola privada; entrega exige el código. Envíos permiten guía y transportista opcionales. No existe integración con transportista ni geocodificación de direcciones.

## Persistencia y recursos
PostgreSQL conserva relaciones, unicidad, índices y restricciones CHECK para dinero/stock/cantidades. Las migraciones incluyen un índice parcial de SUPER_ADMIN y CHECK que Prisma no representa por completo; no eliminarlos al regenerar migraciones. El seed crea solo ejemplos marcados DEMO y sin publicar. El modo demo de frontend usa un catálogo independiente, bolsa/favoritos locales y checkout de práctica sin persistencia ni correos.

La bolsa de invitado usa localStorage validado; al iniciar sesión combina variantes del carrito de cuenta tomando la mayor cantidad y limitándola a stock/20. La cuenta persiste el carrito en PostgreSQL. Los favoritos se guardan en el navegador; no se sincronizan entre dispositivos.

Las subidas tienen límites de bytes/píxeles, verifican firma/MIME, decodifican y recodifican con Sharp a WebP, quitan metadatos y limitan dimensiones a 3000 px. Solo se publican URLs del origen externo configurado. Nunca se guardan imágenes en disco de Render. Se conserva tipografía del sistema (Arial/Georgia); no se redistribuyen archivos de fuentes.

## Correo y pagos
La cola tiene clave única por evento, claim condicional, hasta cinco reintentos y recuperación de leases abandonados. Brevo recibe `headers.idempotencyKey` estable; la protección del proveedor tiene una ventana limitada, por lo que un resultado de entrega ambiguo debe conciliase al operar la cola. No se promete entrega exactamente una vez. EMAIL_MODE=sandbox no consume trabajos ni muestra enlaces de autenticación en logs. El administrador ve estados y errores generales, nunca payloads con tokens. Solo hay correo transaccional y alertas solicitadas por una cuenta verificada.

Sandbox de pagos: HMAC SHA-256 del cuerpo, comparación constante, validación de moneda/importe y evento externo único. Está bloqueado en producción y solo modifica pagos sandbox, sin confirmar pedidos comerciales. Para producción falta el proveedor elegido y el circuito de intención/checkout alojado/confirmación transaccional del pedido.

## Privacidad y operación
Los textos legales y la identidad del comercio se publican desde configuración; se bloquea activar compras hasta tener esos datos, aprobación de políticas, HTTPS y Brevo. La responsabilidad de validar su contenido legal corresponde al propietario. `security:retention` muestra un dry-run; `-- --apply` aplica limpieza de sesiones/tokens caducados y logs antiguos y anonimiza metadatos, según SECURITY_RETENTION_DAYS aprobado. No borra pedidos ni auditoría financiera. No se ha ejecutado limpieza sobre datos del propietario.

Backups, restauración, remitente, monitorización, dominio y decisiones de pasarela se describen en [DEPLOYMENT.md](./DEPLOYMENT.md). El blueprint y CI están escritos; no se han ejecutado en servicios remotos.
