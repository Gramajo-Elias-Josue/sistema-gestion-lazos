// =====================================================================
// SIDEBAR: Contraer / expandir (escritorio) y abrir/cerrar (celular)
// ---------------------------------------------------------------------
// Dos comportamientos, según el ancho de pantalla (los decide el CSS,
// esto solo cambia clases):
//   - Escritorio: el botón de arriba del logo contrae la barra a solo
//     íconos. Se recuerda en localStorage para la próxima vez.
//   - Pantallas chicas (celular / tablet angosta): la barra queda oculta
//     y desliza como un cajón. La abre el botón de hamburguesa del
//     encabezado; se cierra tocando el fondo oscuro, con Escape, o
//     apenas se toca una sección del menú (para no taparla).
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

  iniciarMenuMovil(app);
}

// Ajusta el tooltip/aria del botón según el estado.
function actualizarTitulo(app, toggle) {
  const colapsado = app.classList.contains('nav-collapsed');
  const texto = colapsado ? 'Expandir menú' : 'Contraer menú';
  toggle.title = texto;
  toggle.setAttribute('aria-label', texto);
}

// Cajón del menú en pantallas chicas (ver comentario de arriba).
function iniciarMenuMovil(app) {
  const abrir = document.getElementById('mobile-nav-toggle');
  const fondo = document.getElementById('nav-backdrop');
  const nav = document.getElementById('nav');
  if (!abrir || !fondo) return;

  const cerrarMenu = () => app.classList.remove('nav-open');

  abrir.addEventListener('click', () => app.classList.add('nav-open'));
  fondo.addEventListener('click', cerrarMenu);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrarMenu();
  });
  // Tocar una sección del menú navega Y cierra el cajón, para no dejarlo
  // tapando la pantalla (el router ya hace la navegación por su cuenta;
  // esto solo se ocupa de cerrar).
  nav?.addEventListener('click', (e) => {
    if (e.target.closest('button[data-v]')) cerrarMenu();
  });
}
