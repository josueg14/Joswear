function getUser() {
  try {
    return JSON.parse(localStorage.getItem('joswear_user') || 'null');
  } catch (e) {
    return null;
  }
}

function isLoggedIn() {
  return !!localStorage.getItem('joswear_token');
}

function isAdmin() {
  const user = getUser();
  return !!user && user.role === 'admin';
}

function logout() {
  localStorage.removeItem('joswear_token');
  localStorage.removeItem('joswear_user');
  window.location.href = 'index.html';
}

function updateAuthNav() {
  const user = getUser();
  document.querySelectorAll('.nav-auth').forEach((el) => {
    if (user) {
      const firstName = user.name.split(' ')[0];
      el.innerHTML = `<span>Hola, ${firstName}</span>` +
        (user.role === 'admin' ? ` <a href="admin.html">Admin</a>` : '') +
        ` <a href="#" data-logout>Salir</a>`;
      const logoutLink = el.querySelector('[data-logout]');
      if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
          e.preventDefault();
          logout();
        });
      }
    } else {
      el.innerHTML = `<a href="login.html">Iniciar sesión</a>`;
    }
  });
}

document.addEventListener('DOMContentLoaded', updateAuthNav);
