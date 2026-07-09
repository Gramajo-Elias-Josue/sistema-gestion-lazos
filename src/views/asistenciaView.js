// =====================================================================
// VISTA: Asistencia del día
// ---------------------------------------------------------------------
// CAPA VISTA. Arma la planilla diaria: navegación entre fechas,
// estadísticas en vivo, acciones rápidas (marcar todos presentes,
// buscador) y una fila por paciente.
//
// Flujo de cada fila:
//   1) Sin guardar  -> tilde gris, botones de estado habilitados.
//   2) Se marca     -> se guarda solo y queda BLOQUEADA con tilde verde.
//   3) Para cambiar -> se toca el lápiz (✎), que reabre los botones.
// Al marcar "C/ aviso" se abre un modal para aclarar el motivo.
// =====================================================================

import { iniciales } from '../utils/fechas.js';
import { esc } from '../utils/ui.js';

// Estados posibles de asistencia. Cada uno tiene:
//   valor -> lo que se guarda en la base
//   label -> texto del botón
//   on    -> clase CSS del botón cuando está activo
export const ESTADOS_ASIS = [
  { valor: 'presente',           label: 'Presente', on: 'on-p'  },
  { valor: 'ausente',            label: 'Ausente',  on: 'on-a'  },
  { valor: 'ausente_con_aviso',  label: 'C/ aviso', on: 'on-av' },
  { valor: 'enfermedad',         label: 'Enfermo',  on: 'on-e'  },
];

// Estructura base de la sección: navegación de fecha + estadísticas +
// barra de acciones + contenedor de filas. El controlador rellena el resto.
export function renderEstructura(fecha) {
  return `
    <div class="asis-head">
      <div class="datenav">
        <button class="nav-dia" id="asis-prev" title="Día anterior">‹</button>
        <div class="datechip">
          📅 <input type="date" id="asis-fecha" value="${fecha}" style="all:unset;cursor:pointer;font-weight:600">
          <span id="asis-dia" style="color:var(--ink-faint);font-weight:500"></span>
        </div>
        <button class="nav-dia" id="asis-sig" title="Día siguiente">›</button>
        <button class="btn ghost" id="asis-hoy" style="padding:8px 14px">Hoy</button>
      </div>
      <div class="livestat">
        <div><div class="n" id="st-pres" style="color:var(--teal-600)">0</div><small>Presentes</small></div>
        <div><div class="n" id="st-aus" style="color:var(--red-600)">0</div><small>Ausentes</small></div>
        <div><div class="n" id="st-falta" style="color:var(--amber-600)">0</div><small>Sin marcar</small></div>
        <div><div class="n" id="st-pct">0%</div><small>Asistencia</small></div>
      </div>
    </div>
    <div class="asis-toolbar">
      <input id="asis-buscar" type="search" autocomplete="off" placeholder="🔎 Buscar paciente…">
      <button class="btn" id="asis-todos" title="Marca como presentes a todos los pacientes sin marcar">✓ Todos presentes</button>
    </div>
    <div id="asis-aviso"></div>
    <div class="tablewrap"><div id="asisbody"></div></div>`;
}

// Aviso que se muestra al elegir una fecha futura (solo consulta).
export function renderAvisoFuturo() {
  return `<div class="banner">📅 Fecha futura: la asistencia se registra el mismo día o se corrige después, no por adelantado.</div>`;
}

// HTML de TODAS las filas (se usa al cargar/recargar el día).
// `vista` reúne el estado de la pantalla (ver filaHtml).
export function renderFilas(pacientes, vista) {
  if (!pacientes.length) {
    return `<div class="state">No hay pacientes activos para registrar.</div>`;
  }
  return pacientes.map(p => filaHtml(p, vista)).join('');
}

// HTML de UNA fila. Se exporta aparte para poder re-renderizar solo la
// fila que cambió (al marcar, editar o guardar) sin rehacer toda la lista.
//   vista = { seleccion, notas, mesStats, guardado, editando, bloqueado }
//     seleccion -> { id: estado } marcado en la fecha
//     notas     -> { id: observación } del día
//     mesStats  -> { id: { presentes, total, pct } } resumen mensual
//     guardado  -> { id: true } si la marca está confirmada en la base
//     editando  -> { id: true } si la fila está reabierta para cambiar
//     bloqueado -> true si la fecha es futura (se muestra, no se edita)
export function filaHtml(p, { seleccion, notas, mesStats, guardado, editando, bloqueado }) {
  const sel = seleccion[p.id];
  const nota = notas[p.id];
  const yaGuardado = !!guardado[p.id];
  const enEdicion = !!editando[p.id];

  // La fila se bloquea si la fecha es futura, o si ya se guardó y no se
  // está editando. Sin guardar, queda abierta para marcar.
  const bloqueada = bloqueado || (yaGuardado && !enEdicion);

  const botones = ESTADOS_ASIS.map(e =>
    `<button data-paciente="${p.id}" data-estado="${e.valor}" class="${sel === e.valor ? e.on : ''}" ${bloqueada ? 'disabled' : ''}>${e.label}</button>`
  ).join('');

  // Tilde permanente de guardado: verde si está en la base, gris si no.
  const tick = yaGuardado
    ? `<span class="gtick ok" title="Asistencia guardada">✓</span>`
    : `<span class="gtick pend" title="Sin guardar">✓</span>`;

  // Porcentaje de presentismo del mes (sobre los días con registro).
  const m = mesStats[p.id];
  const mesHtml = m
    ? `<div class="mes" title="${m.presentes} de ${m.total} días presente en el mes"><b>${m.pct}%</b> mes</div>`
    : `<div class="mes">—</div>`;

  // Lápiz: ÚNICA función es reabrir la fila para editar. Solo tiene
  // sentido si ya hay algo guardado y la fecha no está bloqueada.
  const lapizTitulo = nota ? `Editar — Aviso: ${esc(nota)}` : 'Editar asistencia';
  const lapiz = `<button class="btn-editar ${enEdicion ? 'activo' : ''}" data-editar="${p.id}" title="${lapizTitulo}" ${(!yaGuardado || bloqueado) ? 'disabled' : ''}>✎</button>`;

  // data-buscar: texto plano (nombre + diagnóstico) para el filtro.
  return `
    <div class="asis-row" data-fila="${p.id}" data-buscar="${esc(((p.nombre_completo || '') + ' ' + (p.diagnostico || '')).toLowerCase())}">
      <div class="pav">${iniciales(p.nombre_completo)}</div>
      <div class="nm"><b>${esc(p.nombre_completo)}</b><br><small>${esc(p.diagnostico || '')}</small></div>
      ${tick}
      ${mesHtml}
      ${lapiz}
      <div class="seg">${botones}</div>
    </div>`;
}

// Modal para aclarar el AVISO de ausencia de un paciente (se abre al
// marcar "C/ aviso"). El texto se guarda como observación del registro.
export function renderModalAviso(paciente, nota) {
  return `
    <div class="overlay" id="overlay-nota">
      <div class="modal" style="max-width:480px">
        <div class="modal-h">
          <h2>Aviso de ausencia · ${esc(paciente.nombre_completo)}</h2>
          <button class="x" data-cerrar>×</button>
        </div>
        <form id="form-nota">
          <div class="modal-b">
            <div class="form-field full">
              <label>Motivo del aviso *</label>
              <textarea name="observaciones" placeholder="Ej: avisó que falta por control médico, viaje familiar…">${esc(nota || '')}</textarea>
              <p class="form-error" id="nota-error">Escribí el motivo del aviso para poder guardar la asistencia.</p>
              <small style="color:var(--ink-faint)">Sin un motivo escrito, la asistencia no se guarda.</small>
            </div>
          </div>
          <div class="modal-f">
            <button type="button" class="btn ghost" data-cerrar>Cancelar</button>
            <button type="submit" class="btn" id="btn-guardar-nota">Guardar aviso</button>
          </div>
        </form>
      </div>
    </div>`;
}
