const API_URL = '/api';

async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('joswear_token');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  let data = {};
  try { data = await res.json(); } catch (e) { /* respuesta sin cuerpo */ }

  if (!res.ok) {
    throw new Error(data.error || 'Ocurrió un error inesperado');
  }
  return data;
}

function money(n) {
  return `$${Number(n).toFixed(2)}`;
}
