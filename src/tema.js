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

export function iniciarTema() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;

  // Click en el botón sol/luna: alterna el tema y lo guarda.
  btn.addEventListener('click', () => {
    const actual = temaActual();
    aplicarTema(actual === 'dark' ? 'light' : 'dark');
  });

  actualizarTitulo(btn);
}

// Tema activo según el atributo de <html> ('light' por defecto).
function temaActual() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

// Aplica el tema: atributo en <html> + guardado + tooltip del botón.
function aplicarTema(tema) {
  document.documentElement.setAttribute('data-theme', tema);
  localStorage.setItem(CLAVE, tema);
  actualizarTitulo(document.getElementById('theme-toggle'));
}

// Ajusta el tooltip/aria del botón según a qué modo se va a cambiar.
function actualizarTitulo(btn) {
  if (!btn) return;
  const texto = temaActual() === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
  btn.title = texto;
  btn.setAttribute('aria-label', texto);
}
