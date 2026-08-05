// =====================================================================
// VISTA: Evoluciones (evaluación diaria + informe)
// ---------------------------------------------------------------------
// CAPA VISTA. Se elige un profesional y una fecha; se listan los
// pacientes que tiene en turno ese día, cada uno con un campo para su
// evaluación. Botón para descargar el informe diario en PDF.
// =====================================================================

import { esc } from '../utils/ui.js';
import { nombreDia } from '../utils/fechas.js';

// Encabezado: selección de profesional + navegación de fecha + botón PDF.
export function renderEstructura(fecha, profesionales, profSelId) {
  const opts = profesionales.length
    ? profesionales.map(p => `<option value="${p.id}" ${String(p.id) === String(profSelId) ? 'selected' : ''}>${esc(p.nombre_completo)}${p.profesion ? ' — ' + esc(p.profesion) : ''}</option>`).join('')
    : '<option value="">(no hay profesionales activos)</option>';

  return `
    <div class="asis-head">
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <select id="evo-prof" style="font-family:var(--body);font-size:16px;font-weight:600;padding:10px 13px;border:1px solid var(--line);border-radius:10px;background:var(--card);box-shadow:var(--shadow);color:var(--ink);min-width:230px">${opts}</select>
        <div class="datenav">
          <button class="nav-dia" id="evo-prev" title="Día anterior">‹</button>
          <input type="date" id="evo-fecha" value="${fecha}"
            style="font-family:var(--body);font-size:16px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--card);box-shadow:var(--shadow);color:var(--ink)">
          <button class="nav-dia" id="evo-next" title="Día siguiente">›</button>
          <button class="btn ghost" id="evo-hoy">Hoy</button>
        </div>
        <div class="datechip" id="evo-dia">${nombreDia(fecha)}</div>
      </div>
      <button class="btn" id="evo-pdf" style="margin-left:auto">⤓ Descargar informe PDF</button>
    </div>
    <div id="evo-body"></div>`;
}

// Lista de pacientes (turnos del profesional ese día) con su evaluación.
// items: [{ pacienteId, turnoId, nombre, hora, estado, contenido }]
// ctx = { bloqueado, aviso, diasRestantes }:
//   - bloqueado: la fecha ya no admite carga (futura, o pasado el plazo
//     de una semana) -> todo en solo lectura, con el motivo escrito.
//   - diasRestantes: cuánto queda de plazo (0 = último día).
// Además, GATE POR ATENCIÓN: solo el turno 'atendido' habilita la
// evaluación; los pendientes/ausentes se muestran bloqueados con la
// razón (el paciente todavía no fue atendido).
export function renderFilas(items, ctx = {}) {
  const { bloqueado = false, aviso = null, diasRestantes = null } = ctx;

  if (!items.length) {
    return `<div class="tablewrap"><div class="state">Este profesional no tiene turnos para esta fecha. Cargá turnos en <b>Agenda</b> para poder evaluar.</div></div>`;
  }

  // La evaluación diaria NO es obligatoria: se aclara para que nadie la
  // cargue "por las dudas" si ya la lleva en papel.
  let banner = `<div class="banner">📝 La evaluación diaria es <b>opcional</b>: cargala solo si no la llevás en papel. Se puede cargar hasta una semana después.</div>`;
  if (bloqueado && aviso) {
    banner = `<div class="banner">🔒 ${esc(aviso)}</div>`;
  } else if (diasRestantes === 0) {
    banner = `<div class="banner">⏳ <b>Último día</b> para cargar la evaluación de esta fecha.</div>`;
  } else if (diasRestantes !== null && diasRestantes <= 2) {
    banner = `<div class="banner">⏳ Quedan ${diasRestantes} días para cargar la evaluación de esta fecha.</div>`;
  }

  return banner + items.map(it => {
    // Cada fila se habilita solo si el paciente fue atendido y la fecha
    // no está bloqueada. Si no, textarea de solo lectura + motivo.
    const atendido = it.estado === 'atendido';
    const off = (bloqueado || !atendido) ? 'disabled' : '';
    const nota = !atendido
      ? `<div class="hint" style="margin-top:8px;color:var(--ink-soft);font-size:14px">🔒 Marcá el turno como <b>Atendido</b> en <b>Agenda</b> para cargar la evaluación.</div>`
      : '';
    const placeholder = atendido
      ? 'Evaluación / evolución del día…'
      : 'Disponible cuando el turno esté Atendido.';
    return `
    <div class="panel" style="margin-bottom:14px">
      <div class="panel-h">
        <h2>${esc(it.nombre)}</h2>
        <span class="cnt">${it.hora ? esc(String(it.hora).slice(0, 5)) : 'turno'}${atendido ? ' · atendido' : ''}</span>
      </div>
      <div class="panel-b" style="padding:14px 18px">
        <textarea class="evo-eval" data-paciente="${it.pacienteId}" data-turno="${it.turnoId || ''}"
          placeholder="${esc(placeholder)}" ${off}
          style="width:100%;min-height:96px;font-family:var(--body);font-size:16px;padding:11px 13px;border:1px solid var(--line);border-radius:10px;background:var(--card-2);color:var(--ink);resize:vertical">${esc(it.contenido || '')}</textarea>
        ${nota}
        <div style="text-align:right;margin-top:10px">
          <button class="btn ghost evo-guardar" data-paciente="${it.pacienteId}" style="padding:7px 14px" ${off}>Guardar evaluación</button>
        </div>
      </div>
    </div>`;
  }).join('');
}
