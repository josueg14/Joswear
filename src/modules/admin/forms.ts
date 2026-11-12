// Shared field descriptions are presentation only. Every mutation is parsed again in the server schema.
export type Field = {
  name: string;
  label: string;
  type?:
    | "text"
    | "number"
    | "checkbox"
    | "json"
    | "password"
    | "datetime-local";
  hint?: string;
  required?: boolean;
};
export const adminForms: Record<string, Field[]> = {
  variants: [
    { name: "productId", label: "ID del producto", required: true },
    { name: "sku", label: "SKU único", required: true },
    { name: "size", label: "Talla", required: true },
    { name: "color", label: "Color", required: true },
  ],
  products: [
    { name: "name", label: "Nombre", required: true },
    { name: "slug", label: "Slug", required: true },
    { name: "description", label: "Descripción", required: true },
    { name: "price", label: "Precio CRC", type: "number", required: true },
    { name: "salePrice", label: "Precio promocional CRC", type: "number" },
    { name: "cost", label: "Costo CRC", type: "number" },
    { name: "categoryId", label: "ID de categoría", required: true },
    { name: "collectionId", label: "ID de colección" },
    {
      name: "tags",
      label: "Etiquetas (JSON)",
      type: "json",
      hint: '["oversize"]',
    },
    { name: "featured", label: "Destacado", type: "checkbox" },
    { name: "published", label: "Publicado", type: "checkbox" },
    {
      name: "variants",
      label: "Variantes al crear (JSON)",
      type: "json",
      hint: '[{"sku":"SKU-UNICO","size":"M","color":"Marfil","stock":0}]',
    },
    {
      name: "images",
      label: "Imágenes (JSON)",
      type: "json",
      hint: '[{"url":"https://almacenamiento/imagen.webp","alt":"Descripción"}]',
    },
  ],
  categories: [
    { name: "name", label: "Nombre", required: true },
    { name: "slug", label: "Slug", required: true },
  ],
  collections: [
    { name: "name", label: "Nombre", required: true },
    { name: "slug", label: "Slug", required: true },
    { name: "description", label: "Descripción" },
  ],
  banners: [
    { name: "title", label: "Título", required: true },
    { name: "subtitle", label: "Texto", required: true },
    { name: "imageUrl", label: "URL de imagen" },
    { name: "href", label: "Ruta interna", hint: "/tienda", required: true },
    { name: "active", label: "Activo", type: "checkbox" },
  ],
  pickups: [
    { name: "name", label: "Punto de retiro", required: true },
    { name: "address", label: "Dirección real", required: true },
    { name: "hours", label: "Horario", required: true },
    { name: "active", label: "Habilitado", type: "checkbox" },
  ],
  shipping: [
    { name: "name", label: "Zona", required: true },
    { name: "province", label: "Provincia", required: true },
    { name: "canton", label: "Cantón (vacío: toda la provincia)" },
    { name: "district", label: "Distrito (vacío: todo el cantón)" },
    { name: "price", label: "Tarifa CRC", type: "number", required: true },
    { name: "freeFrom", label: "Gratis desde CRC", type: "number" },
    { name: "active", label: "Habilitada", type: "checkbox" },
  ],
  coupons: [
    { name: "code", label: "Código", required: true },
    {
      name: "percent",
      label: "Porcentaje (1–100)",
      type: "number",
      required: true,
    },
    {
      name: "minimum",
      label: "Subtotal mínimo CRC",
      type: "number",
      required: true,
    },
    {
      name: "maxUses",
      label: "Límite de usos",
      type: "number",
      required: true,
    },
    {
      name: "expiresAt",
      label: "Vencimiento",
      type: "datetime-local",
      required: true,
    },
    { name: "active", label: "Habilitado", type: "checkbox" },
  ],
  settings: [
    {
      name: "key",
      label: "Clave",
      required: true,
      hint: "whatsapp, sinpeEnabled, sinpeInstructions, commerceEnabled, policiesApproved, adminAlertEmail",
    },
    {
      name: "value",
      label: "Valor JSON",
      required: true,
      type: "json",
      hint: "Texto entre comillas, true o false según la clave",
    },
  ],
  inventory: [
    { name: "variantId", label: "ID de variante", required: true },
    {
      name: "delta",
      label: "Ajuste (+ ingreso / − salida)",
      required: true,
      type: "number",
    },
    { name: "reason", label: "Motivo del ajuste", required: true },
  ],
  admins: [
    { name: "username", label: "Usuario", required: true },
    {
      name: "password",
      label: "Contraseña inicial (mínimo 16 caracteres)",
      type: "password",
    },
    {
      name: "role",
      label: "Rol",
      required: true,
      hint: "ADMIN, MANAGER, STAFF, SUPPORT",
    },
    { name: "active", label: "Activo", type: "checkbox" },
    {
      name: "permissions",
      label: "Permisos explícitos (JSON)",
      type: "json",
      hint: '[{"resource":"products","action":"read"},{"resource":"products","action":"write"}]',
    },
  ],
};
export const adminModules = [
  ["dashboard", "Resumen"],
  ["products", "Productos"],
  ["variants", "Variantes"],
  ["categories", "Categorías"],
  ["collections", "Colecciones"],
  ["orders", "Pedidos"],
  ["customers", "Clientes"],
  ["inventory", "Inventario"],
  ["coupons", "Promociones"],
  ["banners", "Contenido"],
  ["shipping", "Envíos"],
  ["pickups", "Retiro"],
  ["payments", "Pagos"],
  ["reports", "Reportes"],
  ["admins", "Administradores"],
  ["security", "Seguridad"],
  ["settings", "Configuración"],
] as const;
