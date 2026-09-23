require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const { initDatabase } = require('./db/database');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Frontend estático (HTML, CSS, JS del cliente)
app.use(express.static(path.join(__dirname, 'public')));

// API REST
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);

// Cualquier ruta no-API devuelve el index (útil si se navega directo a una url)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
    if (err) next();
  });
});

initDatabase();

app.listen(PORT, () => {
  console.log('');
  console.log('  🛍️   JOSWEAR está corriendo');
  console.log(`  →  http://localhost:${PORT}`);
  console.log('  →  Admin: admin@joswear.com / admin123');
  console.log('');
});
