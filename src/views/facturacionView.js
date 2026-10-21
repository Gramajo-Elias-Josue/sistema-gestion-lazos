// =====================================================================
// VISTA: Facturación
// ---------------------------------------------------------------------
// CAPA VISTA. Planilla de CONTROL (no genera facturas): un estado por
// paciente y por mes. Misma lógica visual que la planilla de asistencia,
// pero con navegación por MES en vez de por día.
// =====================================================================

import { esc } from '../utils/ui.js';
import { etiquetaPeriodo } from '../utils/periodos.js';
import { ESTADOS_FACTURACION, ESTADO_POR_DEFECTO } from '../utils/facturacion.js';

// Encabezado: navegación de mes + resumen en vivo + buscador.
export function renderEstructura(periodo) {
  return `
    <div class="asis-head">
      <div class="datenav">
        <button class="nav-dia" id="fac-prev" title="Mes anterior">‹</button>
        <div class="datechip"><b id="fac-periodo">${esc(etiquetaPeriodo(periodo))}</b></div>
        <button class="nav-dia" id="fac-next" title="Mes siguiente">›</button>
        <button class="btn ghost" id="fac-hoy">Mes actual</button>
      </div>
      <div class="livestat" id="fac-resumen"></div>
    </div>
    <div class="asis-toolbar">
      <input id="fac-buscar" type="search" autocomplete="off" placeholder="🔎 Buscar paciente…">
      <button class="btn ghost" id="btn-excel-fac" title="Descargar la facturación de este mes en Excel">⤓ Exportar a Excel</button>
    </div>
    <div class="tablewrap"><div id="fac-body"></div></div>`;
}

// Resumen en vivo: cuántos pacientes hay en cada estado.
export function renderResumen({ no_facturado = 0, facturado_no_cobrado = 0, facturado_cobrado = 0 } = {}) {
  return `
    <div><div class="n" style="color:var(--red-600)">${no_facturado}</div><small>No facturado</small></div>
    <div><div class="n" style="color:var(--amber-600)">${facturado_no_cobrado}</div><small>Facturado</small></div>
    <div><div class="n" style="color:var(--teal-600)">${facturado_cobrado}</div><small>Cobrado</small></div>`;
}

// Todas las filas de la planilla del período.
// `estadosPorId` = { paciente_id: estado } (lo ya guardado en la base).
export function renderFilas(pacientes, estadosPorId = {}) {
  if (!pacientes.length) {
    return `<div class="state">No hay pacientes activos.</div>`;
  }
  return pacientes.map(p => filaHtml(p, estadosPorId[p.id])).join('');
}

// Una fila (se re-renderiza sola al cambiar su estado).
export function filaHtml(p, estado = ESTADO_POR_DEFECTO) {
  const botones = ESTADOS_FACTURACION.map(e =>
    `<button data-paciente="${p.id}" data-estado="${e.valor}" class="${estado === e.valor ? e.on : ''}">${e.label}</button>`
  ).join('');

  return `
    <div class="asis-row" data-fila="${p.id}" data-buscar="${esc(((p.nombre_completo || '') + ' ' + (p.obra_social || '')).toLowerCase())}">
      <span class="nm"><b>${esc(p.nombre_completo)}</b><br><small>${esc(p.obra_social || 'Sin obra social')}</small></span>
      <div class="seg">${botones}</div>
    </div>`;
}
