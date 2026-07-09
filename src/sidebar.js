// =====================================================================
// SIDEBAR: Contraer / expandir la barra lateral
// ---------------------------------------------------------------------
// Maneja el botón que colapsa la barra lateral (deja solo los iconos) y
// recuerda la preferencia del usuario en localStorage para la próxima vez.
// =====================================================================

const CLAVE = 'cet-sidebar-colapsado';

export function iniciarSidebar() {
  const app = document.querySelector('.app');
  const toggle = document.getElementById('nav-toggle');
  if (!app || !toggle) return;

  // Restaura el estado guardado de una sesión anterior.
  if (localStorage.getItem(CLAVE) === '1') {
    app.classList.add('nav-collapsed');
  }
  actualizarTitulo(app, toggle);

  // Click en el botón: alterna y guarda la preferencia.
  toggle.addEventListener('click', () => {
    app.classList.toggle('nav-collapsed');
    localStorage.setItem(CLAVE, app.classList.contains('nav-collapsed') ? '1' : '0');
    actualizarTitulo(app, toggle);
  });
}

// Ajusta el tooltip/aria del botón según el estado.
function actualizarTitulo(app, toggle) {
  const colapsado = app.classList.contains('nav-collapsed');
  const texto = colapsado ? 'Expandir menú' : 'Contraer menú';
  toggle.title = texto;
  toggle.setAttribute('aria-label', texto);
}
