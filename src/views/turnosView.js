// =====================================================================
// VISTA: Agenda de turnos
// ---------------------------------------------------------------------
// CAPA VISTA. Navegación por fecha + lista de turnos del día + formulario
// para crear un turno.
//
// La agenda es SOLO para pacientes CASUALES: personas sin legajo que
// vienen a una consulta suelta (se anota su nombre en el turno). Los
// pacientes fijos se organizan en la Grilla de atención de Inicio.
// =====================================================================

import { esc, pill, tonoDe } from '../utils/ui.js';
import { nombreDia, iniciales } from '../utils/fechas.js';

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

// Nombre de quién tiene el turno: el casual lo trae anotado; los turnos
// viejos (de antes de la agenda de casuales) apuntan a un paciente cargado.
export function nombreDelTurno(turno) {
  return turno?.paciente_nombre || turno?.pacientes?.nombre_completo || '—';
}

// Encabezado con navegación de fecha + botón de nuevo turno.
// `puedeOperar` = el usuario gestiona la agenda (director / secretaría). El
// profesional entra en modo consulta: navega las fechas pero no crea turnos.
export function renderEstructura(fecha, puedeOperar = true) {
  const btnNuevo = puedeOperar
    ? `<button class="btn" id="btn-nuevo-turno" style="margin-left:auto">+ Nuevo turno</button>`
    : `<span class="pill" style="margin-left:auto">Solo consulta</span>`;
  return `
    <div class="seccion-intro">
      <p>Turnos para <b>pacientes casuales</b>: consultas sueltas de personas sin legajo. Los pacientes fijos se organizan en la <b>Grilla de atención</b> de Inicio; acá no se puede dar un turno encima de uno de ellos.</p>
    </div>
    <div class="asis-head">
      <div class="datenav">
        <button class="nav-dia" id="t-prev" title="Día anterior">‹</button>
        <input type="date" id="t-fecha" value="${fecha}"
          style="font-family:var(--body);font-size:16px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--card);box-shadow:var(--shadow);color:var(--ink)">
        <button class="nav-dia" id="t-next" title="Día siguiente">›</button>
        <button class="btn ghost" id="t-hoy">Hoy</button>
      </div>
      <div class="datechip" id="t-dia">${nombreDia(fecha)}</div>
      ${btnNuevo}
    </div>
    <div id="turnos-lista"></div>`;
}

// Tabla de turnos del día. `puedeOperar` = puede cambiar el estado del turno
// (marcar "Atendido") y eliminarlo; el profesional lo ve en modo consulta.
// `certificados` = { turnoId: certificado } de los casuales que ya lo
// tienen. La evaluación / certificado se puede hacer (cualquiera que vea
// la agenda, incluido el profesional) recién con el turno "Atendido": así
// queda confirmado que la persona vino.
export function renderLista(turnos, puedeOperar = true, certificados = {}) {
  if (!turnos.length) {
    const ayuda = puedeOperar ? ' Usá “+ Nuevo turno”.' : '';
    return `<div class="tablewrap"><div class="state">No hay turnos para este día.${ayuda}</div></div>`;
  }

  const filas = turnos.map(t => {
    const est = ESTADOS_TURNO[t.estado] || ESTADOS_TURNO.programado;
    const nombre = nombreDelTurno(t);
    const prof = t.profesionales || {};
    const contacto = [
      t.paciente_dni || t.pacientes?.dni ? `DNI ${t.paciente_dni || t.pacientes.dni}` : '',
      t.paciente_telefono ? `Tel. ${t.paciente_telefono}` : '',
    ].filter(Boolean).join(' · ') || 'Sin datos de contacto';
    const opciones = Object.entries(ESTADOS_TURNO)
      .map(([v, info]) => `<option value="${v}" ${v === t.estado ? 'selected' : ''}>${info.etiqueta}</option>`)
      .join('');
    // Solo casuales (los turnos viejos de pacientes con legajo lo hacen
    // desde su historia clínica) y solo con la asistencia confirmada.
    const tieneCert = !!certificados[t.id];
    const btnCert = (!t.paciente_id && t.estado === 'atendido') ? `
          <button class="btn ghost btn-cert-turno destacado" data-id="${t.id}" style="padding:6px 11px">${tieneCert ? '📄 Ver certificado' : '+ Evaluación / certificado'}</button>` : '';
    const acciones = (puedeOperar ? `
          <select class="turno-estado" data-id="${t.id}" aria-label="Estado del turno" style="font-family:var(--body);font-size:14px;padding:7px 9px;border:1px solid var(--line);border-radius:8px;background:var(--card-2);color:var(--ink)">${opciones}</select>` : '')
      + btnCert
      + (puedeOperar ? `
          <button class="btn ghost btn-eliminar-turno peligro" data-id="${t.id}" style="padding:6px 11px;color:var(--red-600)">Eliminar</button>` : '');

    return `
      <tr class="tono-${tonoDe(t.id)}" style="cursor:default">
        <td class="tc-nombre">
          <div class="pname">
            <div class="pav">${esc(iniciales(nombre))}</div>
            <div><b>${esc(nombre)}</b><br><small>${esc(contacto)}</small></div>
          </div>
        </td>
        <td data-t="Hora" style="font-weight:600;white-space:nowrap">${hhmm(t.hora)}</td>
        <td data-t="Profesional"><span><b>${esc(prof.nombre_completo || '—')}</b>${prof.profesion ? `<br><small style="color:var(--ink-faint)">${esc(prof.profesion)}</small>` : ''}</span></td>
        <td data-t="Estado">${pill(est.clase, est.etiqueta)}</td>
        ${acciones ? `
        <td class="tc-acciones" style="white-space:nowrap;text-align:right">${acciones}
        </td>` : ''}
      </tr>`;
  }).join('');

  return `
    <div class="tablewrap tabla-cards">
      <table>
        <thead>
          <tr><th>Paciente</th><th>Hora</th><th>Profesional</th><th>Estado</th><th></th></tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>`;
}

// Formulario (modal) para crear un turno casual. La persona no tiene
// legajo: sus datos se escriben acá, no se eligen de una lista.
export function renderFormTurno(profesionales, fecha) {
  const optsProf = profesionales.length
    ? profesionales.map(p => {
        const diasJson = JSON.stringify(p.dias_trabajo || []);
        return `<option value="${p.id}" data-dias="${esc(diasJson)}">${esc(p.nombre_completo)}${p.profesion ? ' — ' + esc(p.profesion) : ''}</option>`;
      }).join('')
    : '';

  const aviso = !profesionales.length
    ? `<div class="form-field full"><div class="banner">Necesitás al menos un profesional activo para crear un turno.</div></div>`
    : '';
  const opcional = '<small style="color:var(--ink-faint);font-weight:400">(opcional)</small>';

  return `
    <div class="overlay" id="overlay-turno">
      <div class="modal" style="max-width:520px">
        <div class="modal-h"><h2>Nuevo turno casual</h2><button class="x" data-cerrar>×</button></div>
        <form id="form-turno">
          <div class="modal-b">
            <div class="form-grid">
              ${aviso}
              <div class="form-field full"><label>Nombre del paciente *</label><input name="paciente_nombre" required autocomplete="off" placeholder="Nombre y apellido"></div>
              <div class="form-field"><label>Teléfono ${opcional}</label><input name="paciente_telefono" type="tel" autocomplete="off"></div>
              <div class="form-field"><label>DNI ${opcional}</label><input name="paciente_dni" inputmode="numeric" autocomplete="off"></div>
              <div class="form-field full"><label>Profesional *</label><select name="profesional_id" required>${optsProf}</select></div>
              <div class="form-field"><label>Fecha *</label><input type="date" name="fecha" required value="${esc(fecha)}"></div>
              <div class="form-field"><label>Hora *</label><input type="time" name="hora" required></div>
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
