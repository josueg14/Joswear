// Protección de ruta: solo admins autenticados
if (!isLoggedIn() || !isAdmin()) {
  window.location.href = 'login.html';
}

let editingId = null;

// ---------- Tabs ----------
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// ---------- Productos ----------
async function loadProducts() {
  const tbody = document.getElementById('productsTableBody');
  try {
    const products = await apiRequest('/products');
    tbody.innerHTML = products.map((p) => `
      <tr>
        <td><img src="${p.image}" alt="${p.name}"></td>
        <td>${p.name}</td>
        <td>${p.category}</td>
        <td>${money(p.price)}</td>
        <td>${p.stock}</td>
        <td>${p.featured ? 'Sí' : 'No'}</td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="editProduct(${p.id})">Editar</button>
          <button class="btn btn-sm btn-danger" onclick="deleteProduct(${p.id})">Eliminar</button>
        </td>
      </tr>
    `).join('');

    document.getElementById('statsBar').textContent = `${products.length} productos en catálogo`;
    window._productsCache = products;
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7">Error: ${err.message}</td></tr>`;
  }
}

function editProduct(id) {
  const p = window._productsCache.find((x) => x.id === id);
  if (!p) return;
  editingId = id;
  document.getElementById('formTitle').textContent = `Editando: ${p.name}`;
  document.getElementById('productId').value = p.id;
  document.getElementById('p_name').value = p.name;
  document.getElementById('p_description').value = p.description || '';
  document.getElementById('p_price').value = p.price;
  document.getElementById('p_category').value = p.category;
  document.getElementById('p_image').value = p.image || '';
  document.getElementById('p_sizes').value = (p.sizes || []).join(', ');
  document.getElementById('p_stock').value = p.stock;
  document.getElementById('p_featured').checked = !!p.featured;
  document.getElementById('productSubmitBtn').textContent = 'Actualizar producto';
  document.getElementById('cancelEditBtn').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForm() {
  editingId = null;
  document.getElementById('productForm').reset();
  document.getElementById('productId').value = '';
  document.getElementById('formTitle').textContent = 'Nuevo producto';
  document.getElementById('productSubmitBtn').textContent = 'Guardar producto';
  document.getElementById('cancelEditBtn').classList.add('hidden');
}

document.getElementById('cancelEditBtn').addEventListener('click', resetForm);

async function deleteProduct(id) {
  if (!confirm('¿Eliminar este producto? Esta acción no se puede deshacer.')) return;
  try {
    await apiRequest(`/products/${id}`, { method: 'DELETE' });
    loadProducts();
  } catch (err) {
    alert(err.message);
  }
}

document.getElementById('productForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorMsg = document.getElementById('productError');
  errorMsg.textContent = '';

  const payload = {
    name: document.getElementById('p_name').value,
    description: document.getElementById('p_description').value,
    price: parseFloat(document.getElementById('p_price').value),
    category: document.getElementById('p_category').value,
    image: document.getElementById('p_image').value,
    sizes: document.getElementById('p_sizes').value.split(',').map((s) => s.trim()).filter(Boolean),
    stock: parseInt(document.getElementById('p_stock').value, 10) || 0,
    featured: document.getElementById('p_featured').checked
  };

  try {
    if (editingId) {
      await apiRequest(`/products/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      await apiRequest('/products', { method: 'POST', body: JSON.stringify(payload) });
    }
    resetForm();
    loadProducts();
  } catch (err) {
    errorMsg.textContent = err.message;
  }
});

// ---------- Pedidos ----------
async function loadOrders() {
  const tbody = document.getElementById('ordersTableBody');
  try {
    const orders = await apiRequest('/orders');
    tbody.innerHTML = orders.map((o) => `
      <tr>
        <td>#${o.id}</td>
        <td>${o.customer_name}</td>
        <td>${o.customer_email}<br>${o.phone || ''}</td>
        <td>${o.address}${o.city ? ', ' + o.city : ''}</td>
        <td>${o.items.map((i) => `${i.product_name} (${i.size}) x${i.quantity}`).join('<br>')}</td>
        <td>${money(o.total)}</td>
        <td>
          <select class="status-select" onchange="updateOrderStatus(${o.id}, this.value)">
            ${['pendiente', 'confirmado', 'enviado', 'entregado', 'cancelado'].map((s) =>
              `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s}</option>`
            ).join('')}
          </select>
        </td>
        <td>${new Date(o.created_at).toLocaleDateString('es-ES')}</td>
      </tr>
    `).join('') || `<tr><td colspan="8">Aún no hay pedidos.</td></tr>`;
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8">Error: ${err.message}</td></tr>`;
  }
}

async function updateOrderStatus(id, status) {
  try {
    await apiRequest(`/orders/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
  } catch (err) {
    alert(err.message);
    loadOrders();
  }
}

loadProducts();
loadOrders();
