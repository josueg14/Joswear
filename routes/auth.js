const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { db } = require('../db/database');
const { SECRET } = require('../middleware/auth');

router.post('/registro', (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    return res.status(400).json({ error: 'Ese correo ya está registrado' });
  }

  const hashed = bcrypt.hashSync(password, 10);
  const info = db.prepare('INSERT INTO users (name, email, password, role) VALUES (?,?,?,?)')
    .run(name, email.toLowerCase(), hashed, 'cliente');

  const user = { id: info.lastInsertRowid, name, email: email.toLowerCase(), role: 'cliente' };
  const token = jwt.sign(user, SECRET, { expiresIn: '7d' });

  res.json({ token, user });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });
  }

  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!row || !bcrypt.compareSync(password, row.password)) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
  }

  const user = { id: row.id, name: row.name, email: row.email, role: row.role };
  const token = jwt.sign(user, SECRET, { expiresIn: '7d' });

  res.json({ token, user });
});

module.exports = router;
