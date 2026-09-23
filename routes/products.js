const express = require('express');
const router = express.Router();

const { db } = require('../db/database');
const { verifyToken, requireAdmin } = require('../middleware/auth');

function parseProduct(p) {
  return { ...p, sizes: JSON.parse(p.sizes || '[]') };
}

// GET /api/products?category=Hombre&search=hoodie&featured=1
router.get('/', (req, res) => {
  const { category, search, featured } = req.query;
  let query = 'SELECT * FROM products WHERE 1=1';
  const params = [];

  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }
  if (featured) {
    query += ' AND featured = 1';
  }
  if (search) {
    query += ' AND name LIKE ?';
    params.push(`%${search}%`);
  }
  query += ' ORDER BY created_at DESC';

  const products = db.prepare(query).all(...params);
  res.json(products.map(parseProduct));
});

router.get('/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(parseProduct(p));
});

router.post('/', verifyToken, requireAdmin, (req, res) => {
  const { name, description, price, category, image, sizes, stock, featured } = req.body;
  if (!name || !price || !category) {
    return res.status(400).json({ error: 'Nombre, precio y categoría son obligatorios' });
  }

  const info = db.prepare(`
    INSERT INTO products (name, description, price, category, image, sizes, stock, featured)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(
    name,
    description || '',
    price,
    category,
    image || '',
    JSON.stringify(sizes || []),
    stock ?? 100,
    featured ? 1 : 0
  );

  res.json({ id: info.lastInsertRowid });
});

router.put('/:id', verifyToken, requireAdmin, (req, res) => {
  const { name, description, price, category, image, sizes, stock, featured } = req.body;

  db.prepare(`
    UPDATE products
    SET name = ?, description = ?, price = ?, category = ?, image = ?, sizes = ?, stock = ?, featured = ?
    WHERE id = ?
  `).run(
    name,
    description || '',
    price,
    category,
    image || '',
    JSON.stringify(sizes || []),
    stock ?? 0,
    featured ? 1 : 0,
    req.params.id
  );

  res.json({ success: true });
});

router.delete('/:id', verifyToken, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
