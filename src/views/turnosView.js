// =====================================================================
// VISTA: Agenda de turnos
// ---------------------------------------------------------------------
// CAPA VISTA. Navegación por fecha + lista de turnos del día + formulario
// para crear un turno (paciente ↔ profesional, fecha y hora).
// =====================================================================

import { esc, pill } from '../utils/ui.js';
import { nombreDia } from '../utils/fechas.js';

// Estados posibles de un turno y su pill de color.
export const ESTADOS_TURNO = {
  programado: { etiqueta: 'Programado', clase: 'warn' },
  atendido:   { etiqueta: 'Atendido',   clase: 'ok' },
  ausente:    { etiqueta: 'Ausente',    clase: 'bad' },
  cancelado:  { etiqueta: 'Cancelado',  clase: 'bad' },
};

// "HH:MM:SS" -> "HH:MM" (o '—' si no hay hora).
function hhmm(t) {
  return t ? String(t).slice(0, 5) : '—';
}

// Encabezado con navegación de fecha + botón de nuevo turno.
export function renderEstructura(fecha) {
  return `
    <div class="asis-head">
      <div class="datenav">
        <button class="nav-dia" id="t-prev" title="Día anterior">‹</button>
        <input type="date" id="t-fecha" value="${fecha}"
          style="font-family:var(--body);font-size:16px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--card);box-shadow:var(--shadow);color:var(--ink)">
        <button class="nav-dia" id="t-next" title="Día siguiente">›</button>
        <button class="btn ghost" id="t-hoy">Hoy</button>
      </div>
      <div class="datechip" id="t-dia">${nombreDia(fecha)}</div>
      <button class="btn" id="btn-nuevo-turno" style="margin-left:auto">+ Nuevo turno</button>
    </div>
    <div id="turnos-lista"></div>`;
}

// Tabla de turnos del día.
export function renderLista(turnos) {
  if (!turnos.length) {
    return `<div class="tablewrap"><div class="state">No hay turnos para este día. Usá “+ Nuevo turno”.</div></div>`;
  }

  const filas = turnos.map(t => {
    const est = ESTADOS_TURNO[t.estado] || ESTADOS_TURNO.programado;
    const pac = t.pacientes || {};
    const prof = t.profesionales || {};
    const opciones = Object.entries(ESTADOS_TURNO)
      .map(([v, info]) => `<option value="${v}" ${v === t.estado ? 'selected' : ''}>${info.etiqueta}</option>`)
      .join('');

    return `
      <tr style="cursor:default">
        <td style="font-weight:600;font-size:16px;white-space:nowrap">${hhmm(t.hora)}</td>
        <td>
          <div class="pname">
            <div class="pav">${esc((pac.nombre_completo || '?').slice(0, 2).toUpperCase())}</div>
            <div><b>${esc(pac.nombre_completo || '—')}</b><br><small>DNI ${esc(pac.dni || '—')}</small></div>
          </div>
        </td>
        <td><b>${esc(prof.nombre_completo || '—')}</b><br><small style="color:var(--ink-faint)">${esc(prof.profesion || '')}</small></td>
        <td>${pill(est.clase, est.etiqueta)}</td>
        <td style="white-space:nowrap;text-align:right">
          <select class="turno-estado" data-id="${t.id}" style="font-family:var(--body);font-size:14px;padding:7px 9px;border:1px solid var(--line);border-radius:8px;background:var(--card-2);color:var(--ink)">${opciones}</select>
          <button class="btn ghost btn-eliminar-turno" data-id="${t.id}" style="padding:6px 11px;color:var(--red-600)">Eliminar</button>
        </td>
      </tr>`;
  }).join('');

  return `
    <div class="tablewrap">
      <table>
        <thead>
          <tr><th>Hora</th><th>Paciente</th><th>Profesional</th><th>Estado</th><th></th></tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>`;
}

// Formulario (modal) para crear un turno.
export function renderFormTurno(pacientes, profesionales, fecha) {
  const optsPac = pacientes.length
    ? pacientes.map(p => `<option value="${p.id}">${esc(p.nombre_completo)} (DNI ${esc(p.dni || '—')})</option>`).join('')
    : '';
  const optsProf = profesionales.length
    ? profesionales.map(p => {
        const diasJson = JSON.stringify(p.dias_trabajo || []);
        return `<option value="${p.id}" data-entrada="${esc((p.horario_entrada || '').slice(0, 5))}" data-salida="${esc((p.horario_salida || '').slice(0, 5))}" data-dias="${esc(diasJson)}">${esc(p.nombre_completo)}${p.profesion ? ' — ' + esc(p.profesion) : ''}</option>`;
      }).join('')
    : '';

  // Avisos si faltan pacientes o profesionales cargados.
  const aviso = (!pacientes.length || !profesionales.length)
    ? `<div class="form-field full"><div class="banner">Necesitás al menos un paciente admitido y un profesional activo para crear un turno.</div></div>`
    : '';

  return `
    <div class="overlay" id="overlay-turno">
      <div class="modal" style="max-width:520px">
        <div class="modal-h"><h2>Nuevo turno</h2><button class="x" data-cerrar>×</button></div>
        <form id="form-turno">
          <div class="modal-b">
            <div class="form-grid">
              ${aviso}
              <div class="form-field full"><label>Paciente *</label><select name="paciente_id" required>${optsPac}</select></div>
              <div class="form-field full"><label>Profesional *</label><select name="profesional_id" required>${optsProf}</select></div>
              <div class="form-field"><label>Fecha *</label><input type="date" name="fecha" required value="${esc(fecha)}"></div>
              <div class="form-field"><label>Hora</label><input type="time" name="hora"></div>
              <div class="form-field full"><label>Observaciones</label><textarea name="observaciones" placeholder="Motivo, sala, notas…"></textarea></div>
            </div>
          </div>
          <div class="modal-f">
            <button type="button" class="btn ghost" data-cerrar>Cancelar</button>
            <button type="submit" class="btn" id="btn-guardar-turno">Crear turno</button>
          </div>
        </form>
      </div>
    </div>`;
}
