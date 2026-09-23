const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const db = new Database(path.join(__dirname, 'joswear.db'));
db.pragma('journal_mode = WAL');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'cliente',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      category TEXT NOT NULL,
      image TEXT,
      sizes TEXT,
      stock INTEGER DEFAULT 100,
      featured INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      phone TEXT,
      address TEXT NOT NULL,
      city TEXT,
      total REAL NOT NULL,
      status TEXT DEFAULT 'pendiente',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      size TEXT,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );
  `);

  seedAdmin();
  seedProducts();
}

function seedAdmin() {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@joswear.com');
  if (!existing) {
    const hashed = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (name, email, password, role) VALUES (?,?,?,?)')
      .run('Administrador', 'admin@joswear.com', hashed, 'admin');
    console.log('✅ Usuario admin creado -> admin@joswear.com / admin123');
  }
}

function seedProducts() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
  if (count > 0) return;

  const ropaSizes = JSON.stringify(['S', 'M', 'L', 'XL']);
  const unicoSize = JSON.stringify(['Único']);

  const products = [
    ['Hoodie Oversize Negra', 'Buzo de algodón pesado con capucha, corte oversize y bolsillo canguro.', 45.99, 'Hombre', 'https://picsum.photos/seed/joswear-hoodie-negra/700/900', ropaSizes, 40, 1],
    ['Camiseta Streetwear Blanca', 'Camiseta 100% algodón con estampado frontal minimalista.', 22.50, 'Hombre', 'https://picsum.photos/seed/joswear-camiseta-blanca/700/900', ropaSizes, 60, 0],
    ['Jogger Cargo Verde Militar', 'Pantalón jogger con bolsillos cargo y ajuste en tobillo.', 38.00, 'Hombre', 'https://picsum.photos/seed/joswear-jogger-verde/700/900', ropaSizes, 35, 1],
    ['Chaqueta Bomber Urbana', 'Chaqueta bomber acolchada con forro interior y cierre metálico.', 65.00, 'Hombre', 'https://picsum.photos/seed/joswear-bomber/700/900', ropaSizes, 20, 0],
    ['Vestido Satinado Midi', 'Vestido midi de caída fluida en satín, ideal para el día y la noche.', 52.00, 'Mujer', 'https://picsum.photos/seed/joswear-vestido-midi/700/900', ropaSizes, 25, 1],
    ['Crop Top Ribbed', 'Top corto acanalado de algodón elástico, ajuste ceñido.', 18.90, 'Mujer', 'https://picsum.photos/seed/joswear-crop-top/700/900', ropaSizes, 50, 0],
    ['Falda Plisada Denim', 'Falda plisada en denim lavado con botonadura frontal.', 34.50, 'Mujer', 'https://picsum.photos/seed/joswear-falda-denim/700/900', ropaSizes, 30, 0],
    ['Blazer Oversize Beige', 'Blazer estructurado de corte amplio, tejido tipo lino.', 58.00, 'Mujer', 'https://picsum.photos/seed/joswear-blazer-beige/700/900', ropaSizes, 18, 1],
    ['Gorra Snapback Bordada', 'Gorra snapback con logo bordado en 3D y visera plana.', 15.00, 'Accesorios', 'https://picsum.photos/seed/joswear-gorra/700/900', unicoSize, 70, 0],
    ['Riñonera Urbana', 'Riñonera de nylon resistente al agua con múltiples compartimentos.', 20.00, 'Accesorios', 'https://picsum.photos/seed/joswear-rinonera/700/900', unicoSize, 45, 0],
    ['Cinturón Cuero Sintético', 'Cinturón unisex de cuero sintético con hebilla metálica minimalista.', 12.50, 'Accesorios', 'https://picsum.photos/seed/joswear-cinturon/700/900', unicoSize, 55, 0],
    ['Lentes de Sol Retro', 'Lentes de sol con montura retro y protección UV400.', 17.00, 'Accesorios', 'https://picsum.photos/seed/joswear-lentes/700/900', unicoSize, 40, 1]
  ];

  const insert = db.prepare(`
    INSERT INTO products (name, description, price, category, image, sizes, stock, featured)
    VALUES (?,?,?,?,?,?,?,?)
  `);

  const insertMany = db.transaction((rows) => {
    for (const row of rows) insert.run(...row);
  });

  insertMany(products);
  console.log(`✅ ${products.length} productos de ejemplo insertados`);
}

module.exports = { db, initDatabase };
