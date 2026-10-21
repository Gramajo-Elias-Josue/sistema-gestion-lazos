// =====================================================================
// UTILIDADES: Interfaz (UI)
// ---------------------------------------------------------------------
// Pequeños ayudantes de presentación compartidos por varias vistas:
// estados de carga/error, notificaciones (toast), el pill de
// estado y un escape de HTML. No contienen lógica de negocio ni acceso
// a datos: solo arman fragmentos de interfaz.
// =====================================================================

// HTML del estado "cargando" (spinner + texto).
export function htmlCargando(texto = 'Cargando…') {
  return `<div class="state"><div class="spin"></div>${esc(texto)}</div>`;
}

// HTML del estado "error".
export function htmlError(mensaje = 'Ocurrió un error.') {
  return `<div class="state error"><span class="ic">⚠</span>${esc(mensaje)}</div>`;
}

// Pill de estado (ok / warn / bad).
export function pill(clase, texto) {
  return `<span class="pill ${clase}"><span class="d"></span>${esc(texto)}</span>`;
}

// Diálogo de confirmación CON ESTILOS (reemplazo del window.confirm nativo).
// Devuelve una Promesa que resuelve true (aceptar) o false (cancelar).
// Uso: if (await confirmar({ titulo, mensaje })) { … }
export function confirmar({
  titulo = 'Confirmar',
  mensaje = '',
  textoOk = 'Aceptar',
  textoCancelar = 'Cancelar',
  peligro = false,
} = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:440px">
        <div class="modal-h"><h2>${esc(titulo)}</h2><button class="x" data-no aria-label="Cerrar">×</button></div>
        <div class="modal-b"><p style="font-size:16px;line-height:1.55;color:var(--ink-soft)">${esc(mensaje)}</p></div>
        <div class="modal-f">
          <button class="btn ghost" data-no>${esc(textoCancelar)}</button>
          <button class="btn${peligro ? ' danger' : ''}" data-yes>${esc(textoOk)}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const cerrar = (val) => { overlay.remove(); resolve(val); };
    overlay.querySelectorAll('[data-no]').forEach(b => b.addEventListener('click', () => cerrar(false)));
    overlay.querySelector('[data-yes]').addEventListener('click', () => cerrar(true));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(false); });
    // Enter confirma, Escape cancela.
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') cerrar(false);
      if (e.key === 'Enter') cerrar(true);
    });
    overlay.querySelector('[data-yes]').focus();
  });
}

// Contenedor fijo (arriba, centrado) donde se apilan los avisos. Se crea
// una sola vez y se reutiliza, así dos toasts seguidos se acomodan uno
// debajo del otro en vez de superponerse.
let contenedorToasts = null;
function contenedorDeToasts() {
  if (contenedorToasts && document.body.contains(contenedorToasts)) return contenedorToasts;
  contenedorToasts = document.createElement('div');
  contenedorToasts.className = 'toast-stack';
  document.body.appendChild(contenedorToasts);
  return contenedorToasts;
}

// Aviso arriba de todo, centrado. tipo: 'ok' (verde, ✓) o 'bad' (rojo, !).
// Ícono fijo según el tipo (se distingue de un vistazo), botón para
// cerrarlo antes de tiempo, y una barrita que se vacía mostrando cuánto
// le queda antes de desaparecer solo.
export function toast(mensaje, tipo = 'ok') {
  const el = document.createElement('div');
  el.className = 'toast' + (tipo === 'bad' ? ' bad' : '');
  el.innerHTML = `
    <span class="toast-ico" aria-hidden="true">${tipo === 'bad' ? '!' : '✓'}</span>
    <span class="toast-msg">${esc(mensaje)}</span>
    <button type="button" class="toast-cerrar" aria-label="Cerrar aviso">×</button>
    <span class="toast-barra"></span>`;
  contenedorDeToasts().appendChild(el);

  const quitar = () => el.remove();
  el.querySelector('.toast-cerrar').addEventListener('click', quitar);
  setTimeout(quitar, 5000);
}

// Escapa texto para insertarlo de forma segura dentro de HTML.
// Importante: los datos vienen de la base, así que se escapan siempre
// antes de interpolarlos en plantillas.
export function esc(valor) {
  if (valor == null) return '';
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Tonos de color de las tarjetas: los mismos --area-N de la Grilla de
// atención (tienen versión clara y oscura). El 5 se saltea: es el gris
// de "sin sector".
const TONOS = [0, 1, 2, 3, 4, 6, 7];

// Tono fijo para un texto (p. ej. el id de un paciente): la misma
// persona tiene siempre el mismo color, en cualquier página o recarga.
export function tonoDe(texto) {
  let h = 0;
  for (const c of String(texto ?? '')) h = (h * 31 + c.codePointAt(0)) >>> 0;
  return TONOS[h % TONOS.length];
}
