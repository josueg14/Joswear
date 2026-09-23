let allProducts = [];
let currentCategory = new URLSearchParams(window.location.search).get('category') || '';
let currentSearch = '';

function cardTemplate(p) {
  const sizeOptions = p.sizes.map((s) => `<option value="${s}">${s}</option>`).join('');
  return `
    <div class="card">
      <div class="card-media">
        <span class="card-tag">${p.category}</span>
        <img src="${p.image}" alt="${p.name}">
      </div>
      <div class="card-body">
        <div class="card-name">${p.name}</div>
        <div class="card-price">${money(p.price)}</div>
        <select class="card-select" id="size-${p.id}">${sizeOptions}</select>
        <div class="card-actions">
          <button class="btn btn-block btn-sm" onclick="addProductToCart(${p.id})">Agregar al carrito</button>
        </div>
      </div>
    </div>
  `;
}

function addProductToCart(id) {
  const product = allProducts.find((p) => p.id === id);
  if (!product) return;
  const size = document.getElementById(`size-${id}`).value;
  addToCart(product, size, 1);

  const btn = event.target;
  const original = btn.textContent;
  btn.textContent = '¡Agregado!';
  setTimeout(() => { btn.textContent = original; }, 1200);
}

function renderGrid() {
  const grid = document.getElementById('productGrid');
  const filtered = allProducts.filter((p) => {
    const matchCat = !currentCategory || p.category === currentCategory;
    const matchSearch = !currentSearch || p.name.toLowerCase().includes(currentSearch.toLowerCase());
    return matchCat && matchSearch;
  });

  document.getElementById('resultCount').textContent = `${filtered.length} producto(s) encontrado(s)`;

  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-state"><p>No encontramos productos con esos filtros. Prueba con otra categoría o término.</p></div>`;
    return;
  }
  grid.innerHTML = filtered.map(cardTemplate).join('');
}

function setActiveFilterButton() {
  document.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.cat === currentCategory);
  });
}

async function loadProducts() {
  const grid = document.getElementById('productGrid');
  try {
    allProducts = await apiRequest('/products');
    setActiveFilterButton();
    renderGrid();
  } catch (err) {
    grid.innerHTML = `<p>No se pudieron cargar los productos: ${err.message}</p>`;
  }
}

document.querySelectorAll('.filter-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    currentCategory = btn.dataset.cat;
    setActiveFilterButton();
    renderGrid();
  });
});

document.getElementById('searchInput').addEventListener('input', (e) => {
  currentSearch = e.target.value;
  renderGrid();
});

loadProducts();
