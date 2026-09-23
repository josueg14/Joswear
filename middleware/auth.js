const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'joswear-clave-secreta-por-defecto';

function verifyToken(req, res, next) {
  const header = req.headers['authorization'];
  const token = header && header.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Se requiere iniciar sesión' });

  jwt.verify(token, SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Sesión inválida o expirada' });
    req.user = decoded;
    next();
  });
}

// No bloquea la petición si no hay token: permite compras como invitado
function optionalAuth(req, res, next) {
  const header = req.headers['authorization'];
  const token = header && header.split(' ')[1];
  if (token) {
    jwt.verify(token, SECRET, (err, decoded) => {
      if (!err) req.user = decoded;
      next();
    });
  } else {
    next();
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso solo para administradores' });
  }
  next();
}

module.exports = { verifyToken, optionalAuth, requireAdmin, SECRET };
