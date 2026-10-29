// =====================================================================
// VISTA: Control de horas (pestaña de Asistencia, SOLO dirección)
// ---------------------------------------------------------------------
// CAPA VISTA. Para pagar los sueldos: por mes y por profesional, los días
// y las horas según la planilla de la SECRETARÍA y según su PROPIO
// fichaje con ubicación, con los días que no cuadran marcados. Tocando
// un profesional se ve su detalle día por día. En el celular las tablas
// pasan a tarjetas (.tabla-cards).
// =====================================================================

import { esc, tonoDe } from '../utils/ui.js';
import { formatearFecha, iniciales } from '../utils/fechas.js';
import { etiquetaPeriodo } from '../utils/periodos.js';
import { formatearHoras, horarioTexto, minutosDia } from '../utils/controlHoras.js';

// Encabezado: navegación de mes + exportar a Excel.
export function renderEstructuraControl(periodo) {
  return `
    <div class="asis-head">
      <div class="datenav">
        <button class="nav-dia" id="ctl-prev" title="Mes anterior">‹</button>
        <div class="datechip"><b id="ctl-periodo">${esc(etiquetaPeriodo(periodo))}</b></div>
        <button class="nav-dia" id="ctl-next" title="Mes siguiente">›</button>
        <button class="btn ghost" id="ctl-hoy">Mes actual</button>
      </div>
      <div class="acciones-excel">
        <button class="btn ghost" id="btn-excel-control" title="Descargar el control de horas de este mes en Excel">⤓ Exportar a Excel</button>
      </div>
    </div>
    <p class="ctl-ayuda">
      Compara lo que cargó la <b>secretaría</b> en su planilla con lo que fichó cada
      <b>profesional</b> con su ubicación. Solo lo ve la dirección. Tocá un profesional
      para ver su detalle día por día.
    </p>
    <div id="ctl-resumen"></div>
    <div id="ctl-detalle"></div>`;
}

// Tabla resumen: un profesional por fila.
// `resumen` = lo que devuelve resumenControlHoras() (utils/controlHoras.js).
export function renderResumenControl(resumen = [], seleccionado = null) {
  if (!resumen.length) return `<div class="state">No hay profesionales activos.</div>`;
  const filas = resumen.map(r => {
    const p = r.profesional;
    const dif = r.minPropio - r.minPlanilla;
    const difTexto = dif === 0 ? '—' : `${dif > 0 ? '+' : '−'}${formatearHoras(Math.abs(dif))}`;
    const revisar = r.alertas
      ? `<span class="pill" style="background:var(--amber-50);color:var(--amber-600)">${r.alertas === 1 ? '1 día' : `${r.alertas} días`} para revisar</span>`
      : (r.dias.length ? '<span class="pill" style="background:var(--teal-50);color:var(--teal-700)">Cuadra ✓</span>' : '<small style="color:var(--ink-faint)">Sin registros</small>');
    return `
      <tr class="ctl-fila tono-${tonoDe(p.id)}${String(seleccionado) === String(p.id) ? ' sel' : ''}" data-ctl-prof="${esc(String(p.id))}" title="Ver el detalle de ${esc(p.nombre_completo)}">
        <td class="tc-nombre">
          <div class="pname"><div class="pav">${esc(iniciales(p.nombre_completo))}</div>
            <div><b>${esc(p.nombre_completo)}</b><br><small>${esc(p.profesion || '')}</small></div></div>
        </td>
        <td data-t="Secretaría">${r.diasPlanilla} ${r.diasPlanilla === 1 ? 'día' : 'días'} · ${esc(formatearHoras(r.minPlanilla))}</td>
        <td data-t="Su fichaje">${r.diasPropio} ${r.diasPropio === 1 ? 'día' : 'días'} · ${esc(formatearHoras(r.minPropio))}</td>
        <td data-t="Diferencia">${esc(difTexto)}</td>
        <td data-t="Estado">${revisar}</td>
      </tr>`;
  }).join('');
  return `
    <div class="tablewrap tabla-cards">
      <table>
        <thead><tr><th>Profesional</th><th>Secretaría (planilla)</th><th>Su fichaje (ubicación)</th><th>Diferencia</th><th></th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </div>`;
}

// Detalle día por día de UN profesional (una fila del resumen).
export function renderDetalleControl(r) {
  if (!r) return '';
  const p = r.profesional;
  const estado = (pl) => {
    if (!pl) return '<small style="color:var(--ink-faint)">Sin planilla</small>';
    const nombres = { presente: 'Presente', ausente: 'Ausente', licencia: 'Licencia' };
    return esc(nombres[pl.estado] || pl.estado);
  };
  const filas = r.dias.length ? r.dias.map(d => `
    <tr class="${d.alerta ? 'ctl-alerta' : ''}">
      <td class="tc-nombre"><b>${esc(formatearFecha(d.fecha))}</b></td>
      <td data-t="Secretaría">${estado(d.planilla)} · ${esc(horarioTexto(d.planilla))}${minutosDia(d.planilla) ? ` <small>(${esc(formatearHoras(minutosDia(d.planilla)))})</small>` : ''}</td>
      <td data-t="Su fichaje">${esc(horarioTexto(d.propio))}${minutosDia(d.propio) ? ` <small>(${esc(formatearHoras(minutosDia(d.propio)))})</small>` : ''}</td>
      <td data-t="Observación">${d.alerta ? `⚠️ ${esc(d.alerta)}` : '<span style="color:var(--teal-700)">Cuadra ✓</span>'}</td>
    </tr>`).join('')
    : `<tr><td colspan="4"><div class="state">Sin registros este mes.</div></td></tr>`;
  return `
    <div class="panel ctl-panel-detalle" style="margin-top:20px">
      <div class="panel-h">
        <h2>Detalle · ${esc(p.nombre_completo)}</h2>
        <span class="cnt">${r.dias.length} ${r.dias.length === 1 ? 'día' : 'días'}</span>
      </div>
      <div class="tablewrap tabla-cards" style="box-shadow:none;border:none">
        <table>
          <thead><tr><th>Fecha</th><th>Secretaría (planilla)</th><th>Su fichaje (ubicación)</th><th>Observación</th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
    </div>`;
}
