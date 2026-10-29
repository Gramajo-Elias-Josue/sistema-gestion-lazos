// =====================================================================
// VISTA: Asistencia de profesionales (fichaje)
// ---------------------------------------------------------------------
// CAPA VISTA. Navegación por fecha + una fila por profesional con su
// estado del día y los horarios de entrada / salida (prellenados con el
// horario habitual del perfil si todavía no fichó). El que trabaja
// mañana Y tarde tiene dos pares de horas: uno por turno (script 17).
// =====================================================================

import { esc } from '../utils/ui.js';
import { nombreDia, iniciales } from '../utils/fechas.js';
import { horarioDe, textoTurnos } from '../utils/turnosCentro.js';
import { tramosDe, CAMPOS_TRAMO } from '../utils/tramosFichaje.js';

export const ESTADOS_FICHAJE = { presente: 'Presente', ausente: 'Ausente', licencia: 'Licencia' };

// "HH:MM:SS" -> "HH:MM" (para <input type="time">).
function hhmm(t) { return t ? String(t).slice(0, 5) : ''; }

// Marca 📍 junto a "Entrada" / "Salida" cuando esa hora la fichó el
// propio profesional con su ubicación (la marca la pone la base).
function marcaUbicacion(por, distancia) {
  if (por !== 'ubicacion') return '';
  const detalle = Number.isFinite(distancia) ? `, a ${distancia} m del centro` : '';
  return ` <span class="apf-ubi" title="La fichó el profesional con su ubicación${detalle}">📍</span>`;
}

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
        <div><div class="n" id="apf-pct">0%</div><small>Asistencia</small></div>
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
  const tramos = tramosDe(prof);
  const doble = tramos.length === 2;

  // Prellenado de un tramo. `habitual` = { entrada, salida } de su turno.
  // El de la tarde (tramo 2), si es hoy, solo se sugiere cuando ya llegó
  // la hora de la tarde (a la mañana todavía no pasó).
  const prefill = (n, habitual, turno) => {
    const c = CAMPOS_TRAMO[n];
    const guardadaEnt = f[c.entrada], guardadaSal = f[c.salida];
    let entrada;
    if (guardadaEnt) entrada = (esHoy && ahora && hhmm(guardadaEnt) > ahora) ? ahora : hhmm(guardadaEnt);
    else if (esHoy && ahora) entrada = (n === 2 && turno && ahora < turno.desde) ? '' : ahora;
    else entrada = habitual.entrada;
    let salida;
    if (guardadaSal) salida = (esHoy && ahora && hhmm(guardadaSal) > ahora) ? '' : hhmm(guardadaSal);
    else salida = esHoy ? '' : habitual.salida;
    return { entrada, salida };
  };

  const conHoras = estado === 'presente';
  const offHoras = (bloqueado || !conHoras) ? 'disabled' : '';
  const horas = tramos.map(({ n, turno }) => {
    const c = CAMPOS_TRAMO[n];
    // Con un solo turno, el habitual es el de su perfil; con dos, el de cada turno.
    const habitual = doble && turno ? { entrada: turno.desde, salida: turno.hasta } : horarioDe(prof);
    const v = conHoras ? prefill(n, habitual, turno) : { entrada: '', salida: '' };
    const titulo = doble && turno
      ? `<span class="apf-turno apf-t-${turno.clave}">${turno.clave === 'manana' ? '☀️ Mañana' : '🌇 Tarde'}</span>`
      : '';
    return `
      <div class="apf-horas" data-tramo="${n}">
        ${titulo}
        <label class="apf-hora"><span>Entrada${marcaUbicacion(f[c.entradaPor], f[c.entradaDist])}</span>
          <input type="time" class="apf-entrada" value="${v.entrada}" ${offHoras}></label>
        <label class="apf-hora"><span>Salida${marcaUbicacion(f[c.salidaPor], f[c.salidaDist])}</span>
          <input type="time" class="apf-salida" value="${v.salida}" ${offHoras}></label>
      </div>`;
  }).join('');

  const opts = Object.entries(ESTADOS_FICHAJE)
    .map(([v, l]) => `<option value="${v}" ${v === estado ? 'selected' : ''}>${l}</option>`).join('');
  const guardado = !!fichaje;

  return `
    <div class="asis-row" data-prof="${prof.id}">
      <button class="ficha-asis" data-ficha-prof="${prof.id}" title="Ver el calendario de asistencia de ${esc(prof.nombre_completo)}">
        <span class="pav">${esc(iniciales(prof.nombre_completo))}</span>
        <span class="nm">
          <b>${esc(prof.nombre_completo)}</b><br>
          <small>${esc(prof.profesion || '')}${prof.matricula ? ' · ' + esc(prof.matricula) : ''}${textoTurnos(prof) ? ' · ' + esc(textoTurnos(prof)) : ''}</small>
        </span>
      </button>
      <select class="apf-estado" ${bloqueado ? 'disabled' : ''}>${opts}</select>
      ${horas}
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
