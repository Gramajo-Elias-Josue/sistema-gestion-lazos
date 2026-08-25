// =====================================================================
// VISTA: Convenios (obras sociales)
// ---------------------------------------------------------------------
// CAPA VISTA. Sección recién creada: todavía no se cargó qué datos lleva
// cada convenio, así que por ahora solo lista los nombres.
// =====================================================================

import { esc } from '../utils/ui.js';

export function renderEstructura() {
  return `
    <p style="color:var(--ink-soft);font-size:15px;margin-bottom:18px">
      Convenios con las obras sociales del centro.
    </p>
    <div id="convenios-lista"></div>`;
}

export function renderLista(convenios) {
  if (!convenios.length) {
    return `<div class="tablewrap"><div class="state">Todavía no hay convenios cargados.</div></div>`;
  }
  const filas = convenios.map(c => `
    <tr>
      <td><b>${esc(c.nombre)}</b></td>
      <td>${esc(c.notas || '—')}</td>
    </tr>`).join('');
  return `
    <div class="tablewrap">
      <table>
        <thead><tr><th>Obra social</th><th>Notas</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </div>`;
}
