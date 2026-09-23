# JOSWEAR — Tienda de ropa online

Sitio completo de e-commerce: **frontend** (HTML/CSS/JS) + **backend** (Node.js/Express) +
**base de datos** (SQLite) con un sistema de ventas real: catálogo, carrito, checkout,
autenticación de usuarios y panel de administración para gestionar productos y pedidos.

## Requisitos

- [Node.js](https://nodejs.org) versión 18 o superior instalado en tu computadora.

## Instalación y ejecución

1. Descomprime este proyecto y abre una terminal dentro de la carpeta `joswear`.
2. Instala las dependencias:

   ```bash
   npm install
   ```

3. (Opcional) copia `.env.example` a `.env` y cambia `JWT_SECRET` por una clave propia:

   ```bash
   cp .env.example .env
   ```

4. Inicia el servidor:

   ```bash
   npm start
   ```

5. Abre tu navegador en **http://localhost:3000**

La base de datos (`db/joswear.db`) se crea automáticamente la primera vez que arrancas el
servidor, junto con 12 productos de ejemplo y un usuario administrador.

### Credenciales del administrador (demo)

- **Correo:** admin@joswear.com
- **Contraseña:** admin123

Inicia sesión con esas credenciales y el sitio te redirigirá automáticamente al panel
`/admin.html`, donde puedes crear, editar y eliminar productos, y ver/gestionar los
pedidos que hagan los clientes.

## Estructura del proyecto

```
joswear/
├── server.js              # Servidor Express (API + estático)
├── package.json
├── .env.example
├── db/
│   └── database.js        # Conexión SQLite, tablas y datos de ejemplo
├── middleware/
│   └── auth.js             # Verificación de JWT y control de admin
├── routes/
│   ├── auth.js              # /api/auth  (registro, login)
│   ├── products.js          # /api/products (CRUD)
│   └── orders.js            # /api/orders  (checkout, historial, admin)
└── public/                  # Frontend
    ├── index.html            # Inicio
    ├── tienda.html            # Catálogo con filtros y búsqueda
    ├── carrito.html            # Carrito de compras
    ├── checkout.html            # Formulario de compra
    ├── confirmacion.html        # Confirmación de pedido
    ├── login.html / registro.html
    ├── admin.html                # Panel de administración
    ├── css/style.css
    └── js/                        # api.js, cart.js, auth.js, shop.js, admin.js, ui.js
```

## Cómo funciona el sistema de ventas

1. El cliente navega el catálogo (`tienda.html`), filtra por categoría o busca por nombre.
2. Agrega productos al carrito (guardado en `localStorage` del navegador).
3. En `checkout.html` completa sus datos de envío y confirma el pedido.
4. El backend crea el pedido y sus artículos en SQLite (`orders` y `order_items`) y
   calcula el total en el servidor (nunca confía en el total enviado desde el navegador).
5. El administrador ve todos los pedidos en `admin.html`, con sus artículos, datos de
   contacto y puede actualizar el estado (pendiente → confirmado → enviado → entregado).

## Notas de seguridad para producción

Este proyecto está listo para usarse tal cual en desarrollo o como base de un proyecto
real, pero antes de publicarlo en internet con clientes reales, considera:

- Usar variables de entorno reales (`.env`) con un `JWT_SECRET` largo y aleatorio.
- Servir el sitio detrás de HTTPS.
- Agregar un proveedor de pagos real (Stripe, PayPal, etc.) en el checkout.
- Agregar límites de tasa (rate limiting) a las rutas de login/registro.
- Hacer respaldos periódicos del archivo `db/joswear.db`.

## Personalizar

- **Productos**: edítalos desde el panel `/admin.html`, o directamente en el arreglo
  `products` de `db/database.js` antes del primer arranque.
- **Colores y tipografía**: variables CSS al inicio de `public/css/style.css` (`:root`).
- **Categorías**: si agregas categorías nuevas, actualiza los botones de filtro en
  `tienda.html` y el `<select>` de categoría en `admin.html`.
