// =====================================================================
// VISTA: Notificaciones (campana del encabezado)
// ---------------------------------------------------------------------
// CAPA VISTA. Arma la lista del desplegable a partir de los items ya
// armados por utils/notificaciones.js (notificacionesGlobales).
// =====================================================================

import { esc } from '../utils/ui.js';

export function renderListaNotificaciones(items = []) {
  if (!items.length) {
    return `<div class="state" style="padding:22px 16px">Sin novedades. ✓</div>`;
  }

  return items.map(it => `
    <div class="alert">
      <div class="ico i-${it.color}">${it.icono}</div>
      <div class="tx">
        <b>${esc(it.titulo)}</b>
        <span>${esc(it.detalle)}</span>
      </div>
    </div>`).join('');
}
