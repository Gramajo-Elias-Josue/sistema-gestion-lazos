// =====================================================================
// VISTA: Asistencia de profesionales (fichaje)
// ---------------------------------------------------------------------
// CAPA VISTA. Navegación por fecha + una fila por profesional con su
// estado del día y los horarios de entrada / salida (prellenados con el
// horario habitual del perfil si todavía no fichó).
// =====================================================================

import { esc } from '../utils/ui.js';
import { nombreDia, iniciales } from '../utils/fechas.js';

export const ESTADOS_FICHAJE = { presente: 'Presente', ausente: 'Ausente', licencia: 'Licencia' };

// "HH:MM:SS" -> "HH:MM" (para <input type="time">).
function hhmm(t) { return t ? String(t).slice(0, 5) : ''; }

// Encabezado con navegación de fecha.
export function renderEstructura(fecha) {
  return `
    <div class="asis-head">
      <div class="datenav">
        <button class="nav-dia" id="apf-prev" title="Día anterior">‹</button>
        <input type="date" id="apf-fecha" value="${fecha}"
          style="font-family:var(--body);font-size:16px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--card);box-shadow:var(--shadow);color:var(--ink)">
        <button class="nav-dia" id="apf-next" title="Día siguiente">›</button>
        <button class="btn ghost" id="apf-hoy">Hoy</button>
      </div>
      <div class="datechip" id="apf-dia">${nombreDia(fecha)}</div>
      <div class="livestat">
        <div><div class="n" id="apf-pres">0</div><small>Presentes</small></div>
        <div><div class="n" id="apf-aus">0</div><small>Ausentes</small></div>
        <div><div class="n" id="apf-lic">0</div><small>Licencia</small></div>
        <div><div class="n" id="apf-sf">0</div><small>Sin fichar</small></div>
        <div><div class="n" id="apf-pct">0%</div><small>Presentes</small></div>
      </div>
    </div>
    <div id="apf-body"></div>`;
}

// Una fila por profesional. `fichaje` es su registro del día (o undefined).
// `ctx` = { bloqueado, esHoy, ahora }:
//   - bloqueado: fecha futura -> todo deshabilitado.
//   - esHoy + ahora: el prefill NO adelanta horas que todavía no ocurrieron
//     (si el horario habitual aún no llegó, el campo queda vacío: se ficha
//     la hora real cuando el profesional efectivamente llega / se va).
export function filaHtml(prof, fichaje, ctx = {}) {
  const { bloqueado = false, esHoy = false, ahora = '' } = ctx;
  const f = fichaje || {};
  const estado = f.estado || 'presente';

  const prefillEntrada = () => {
    if (f.hora_entrada) {
      if (esHoy && ahora && hhmm(f.hora_entrada) > ahora) return ahora;
      return hhmm(f.hora_entrada);
    }
    if (esHoy && ahora) return ahora;
    return hhmm(prof.horario_entrada);
  };
  const prefillSalida = () => {
    if (f.hora_salida) {
      if (esHoy && ahora && hhmm(f.hora_salida) > ahora) return '';
      return hhmm(f.hora_salida);
    }
    if (esHoy) return '';
    return hhmm(prof.horario_salida);
  };
  const conHoras = estado === 'presente';
  const entrada = conHoras ? prefillEntrada() : '';
  const salida = conHoras ? prefillSalida() : '';

  const opts = Object.entries(ESTADOS_FICHAJE)
    .map(([v, l]) => `<option value="${v}" ${v === estado ? 'selected' : ''}>${l}</option>`).join('');
  const guardado = !!fichaje;
  const offHoras = (bloqueado || !conHoras) ? 'disabled' : '';

  return `
    <div class="asis-row" data-prof="${prof.id}">
      <button class="ficha-asis" data-ficha-prof="${prof.id}" title="Ver el calendario de asistencia de ${esc(prof.nombre_completo)}">
        <span class="pav">${esc(iniciales(prof.nombre_completo))}</span>
        <span class="nm">
          <b>${esc(prof.nombre_completo)}</b><br>
          <small>${esc(prof.profesion || '')}${prof.matricula ? ' · ' + esc(prof.matricula) : ''}${prof.horario_entrada ? ' · ' + hhmm(prof.horario_entrada) + '–' + (hhmm(prof.horario_salida) || '') : ''}</small>
        </span>
      </button>
      <select class="apf-estado" ${bloqueado ? 'disabled' : ''}>${opts}</select>
      <div class="apf-horas">
        <label class="apf-hora"><span>Entrada</span>
          <input type="time" class="apf-entrada" value="${entrada}" ${offHoras}></label>
        <label class="apf-hora"><span>Salida</span>
          <input type="time" class="apf-salida" value="${salida}" ${offHoras}></label>
      </div>
      <span class="gtick ${guardado ? 'ok' : 'pend'}" title="${guardado ? 'Fichaje guardado' : 'Sin guardar'}">${guardado ? '✓' : '•'}</span>
      <button class="btn apf-guardar" data-prof="${prof.id}" ${bloqueado ? 'disabled' : ''}>Guardar</button>
    </div>`;
}

// Lista completa de filas (un wrap tipo tabla). Con fecha futura muestra
// el aviso y deja todo deshabilitado.
export function renderFilas(profesionales, fichajesPorId = {}, ctx = {}) {
  if (!profesionales.length) {
    return `<div class="tablewrap"><div class="state">No hay profesionales activos. Cargá profesionales en su sección.</div></div>`;
  }
  const aviso = ctx.bloqueado
    ? `<div class="banner">📅 Fecha futura: el fichaje se registra el día que el profesional asiste.</div>`
    : '';
  return `${aviso}<div class="tablewrap" style="padding:6px 4px">${profesionales.map(p => filaHtml(p, fichajesPorId[p.id], ctx)).join('')}</div>`;
}
