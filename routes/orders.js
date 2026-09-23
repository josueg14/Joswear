const express = require('express');
const router = express.Router();

const { db } = require('../db/database');
const { verifyToken, requireAdmin, optionalAuth } = require('../middleware/auth');

function attachItems(order) {
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  return { ...order, items };
}

// Crear pedido (checkout). Permite compra como invitado o autenticado.
router.post('/', optionalAuth, (req, res) => {
  const { items, customer_name, customer_email, phone, address, city } = req.body;

  if (!items || !items.length) {
    return res.status(400).json({ error: 'El carrito está vacío' });
  }
  if (!customer_name || !customer_email || !address) {
    return res.status(400).json({ error: 'Nombre, correo y dirección son obligatorios' });
  }

  const total = items.reduce((sum, i) => sum + Number(i.price) * Number(i.quantity), 0);
  const userId = req.user ? req.user.id : null;

  const insertOrder = db.prepare(`
    INSERT INTO orders (user_id, customer_name, customer_email, phone, address, city, total)
    VALUES (?,?,?,?,?,?,?)
  `);
  const insertItem = db.prepare(`
    INSERT INTO order_items (order_id, product_id, product_name, price, quantity, size)
    VALUES (?,?,?,?,?,?)
  `);

  const createOrder = db.transaction(() => {
    const info = insertOrder.run(userId, customer_name, customer_email, phone || '', address, city || '', total);
    for (const i of items) {
      insertItem.run(info.lastInsertRowid, i.id || null, i.name, i.price, i.quantity, i.size || null);
    }
    return info.lastInsertRowid;
  });

  const orderId = createOrder();
  res.json({ orderId, total });
});

// Pedidos del cliente autenticado
router.get('/mine', verifyToken, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json(orders.map(attachItems));
});

// Todos los pedidos (solo admin)
router.get('/', verifyToken, requireAdmin, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
  res.json(orders.map(attachItems));
});

// Actualizar estado de un pedido (solo admin)
router.put('/:id/status', verifyToken, requireAdmin, (req, res) => {
  const { status } = req.body;
  const valid = ['pendiente', 'confirmado', 'enviado', 'entregado', 'cancelado'];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: true });
});

module.exports = router;
