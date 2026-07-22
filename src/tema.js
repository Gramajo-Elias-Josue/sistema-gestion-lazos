// =====================================================================
// TEMA: Modo claro / oscuro
// ---------------------------------------------------------------------
// Cambia entre el tema claro (por defecto) y el oscuro, y recuerda la
// elección en localStorage para la próxima visita.
//
// El tema se aplica como atributo `data-theme` en <html>. Toda la paleta
// vive en variables CSS (styles/main.css): el tema oscuro solo redefine
// esas variables bajo `:root[data-theme="dark"]`, así que con cambiar el
// atributo se reskinea toda la aplicación de una sola vez.
//
// Nota: el tema inicial se fija con un pequeño script en index.html ANTES
// de pintar, para que no haya un parpadeo claro→oscuro al recargar.
// =====================================================================

const CLAVE = 'lazos-tema';

// Conecta el botón sol/luna del encabezado de la app.
export function iniciarTema() {
  conectarToggleTema(document.getElementById('theme-toggle'));
}

// Conecta CUALQUIER botón para alternar el tema (sirve para el toggle del
// encabezado y también para el de la pantalla de login). Como el tema vive
// en <html>, todos los toggles quedan sincronizados solos.
export function conectarToggleTema(btn) {
  if (!btn) return;
  btn.addEventListener('click', () => {
    aplicarTema(temaActual() === 'dark' ? 'light' : 'dark');
  });
  actualizarTitulo(btn);
}

// Tema activo según el atributo de <html> ('light' por defecto).
function temaActual() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

// Aplica el tema: atributo en <html> + guardado + tooltip de los botones.
function aplicarTema(tema) {
  document.documentElement.setAttribute('data-theme', tema);
  localStorage.setItem(CLAVE, tema);
  // Puede haber más de un toggle en pantalla (encabezado + login): se
  // actualizan todos, ya comparten la clase .theme-toggle.
  document.querySelectorAll('.theme-toggle').forEach(actualizarTitulo);
}

// Ajusta el tooltip/aria del botón según a qué modo se va a cambiar.
function actualizarTitulo(btn) {
  if (!btn) return;
  const texto = temaActual() === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
  btn.title = texto;
  btn.setAttribute('aria-label', texto);
}
