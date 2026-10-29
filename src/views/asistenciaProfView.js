// =====================================================================
// VISTA: Asistencia de profesionales (fichaje)
// ---------------------------------------------------------------------
// CAPA VISTA. Navegación por fecha + una fila por profesional con su
// estado del día y los horarios de entrada / salida (prellenados con el
// horario habitual del perfil si todavía no fichó).
//
// Separada en dos pestañas, TURNO MAÑANA y TURNO TARDE (como la grilla):
// cada una muestra a quienes trabajan ese turno, con las horas de ese
// turno. El que hace los dos aparece en las dos: a la mañana carga su
// primer tramo y a la tarde el segundo (script 17), cada uno con su
// propio estado (script 18): puede faltar a la mañana y venir a la tarde.
// =====================================================================

import { esc } from '../utils/ui.js';
import { nombreDia, iniciales } from '../utils/fechas.js';
import { horarioDe, textoTurnos, turnosDe, TURNOS_CENTRO, rangoTurno } from '../utils/turnosCentro.js';
import { tramosDe, CAMPOS_TRAMO, esDobleTurno, estadoDeTramo } from '../utils/tramosFichaje.js';

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
    <div class="tabs ga-turnos apf-turnos" id="apf-turnos"></div>
    <div id="apf-body"></div>`;
}

// ¿El profesional aparece en la pestaña de ese turno? Los que no tienen
// turno cargado aparecen en las dos (para que igual se les pueda fichar).
export function trabajaEnTurno(prof, turno) {
  const suyos = turnosDe(prof);
  return !suyos.length || suyos.some(t => t.clave === turno);
}

// Pestañas Turno mañana / Turno tarde, con cuántos profesionales tiene cada una.
export function renderPestanasTurnoAsistencia(profesionales, turno) {
  return TURNOS_CENTRO.map(t => {
    const cuantos = profesionales.filter(p => trabajaEnTurno(p, t.clave)).length;
    const icono = t.clave === 'manana' ? '☀️' : '🌇';
    return `
      <button type="button" class="tab apf-tab-${t.clave}${t.clave === turno ? ' active' : ''}" data-turno="${t.clave}">
        ${icono} ${esc(t.etiqueta)} <small>${esc(rangoTurno(t))} · ${cuantos}</small>
      </button>`;
  }).join('');
}

// El tramo que se carga en la pestaña de `turno`: el de doble turno usa
// el 1 a la mañana y el 2 a la tarde; el de un turno (o sin turno), el 1.
export function tramoEnTurno(prof, turno) {
  const tramos = tramosDe(prof);
  return tramos.find(t => t.turno?.clave === turno) || tramos[0];
}

// Una fila por profesional. `fichaje` es su registro del día (o undefined).
// `ctx` = { bloqueado, esHoy, ahora, turno }:
//   - turno: la pestaña ('manana' | 'tarde'); se muestran las horas de ese turno.
//   - bloqueado: fecha futura -> todo deshabilitado.
//   - esHoy + ahora: el prefill NO adelanta horas que todavía no ocurrieron
//     (si el horario habitual aún no llegó, el campo queda vacío: se ficha
//     la hora real cuando el profesional efectivamente llega / se va).
export function filaHtml(prof, fichaje, ctx = {}) {
  const { bloqueado = false, esHoy = false, ahora = '', turno = 'manana' } = ctx;
  const f = fichaje || {};
  const { n, turno: suTurno } = tramoEnTurno(prof, turno);
  // El estado que se edita en esta pestaña: el del turno (doble turno) o
  // el del día (un solo turno).
  const estado = estadoDeTramo(f, n, esDobleTurno(prof)) || 'presente';
  const c = CAMPOS_TRAMO[n];
  // Horario habitual de este tramo: el de su turno (o el de su perfil si
  // no tiene turno cargado).
  const habitual = suTurno ? { entrada: suTurno.desde, salida: suTurno.hasta } : horarioDe(prof);

  // Prellenado. Si es hoy no se adelantan horas que todavía no ocurrieron:
  //   - su turno todavía no empezó -> vacío;
  //   - está en curso              -> la hora actual como entrada;
  //   - ya terminó                 -> su horario habitual (ya pasó entero).
  const guardadaEnt = f[c.entrada], guardadaSal = f[c.salida];
  const yaTermino = !!(esHoy && ahora && suTurno && ahora >= suTurno.hasta);
  let entrada;
  if (guardadaEnt) entrada = (esHoy && ahora && hhmm(guardadaEnt) > ahora) ? ahora : hhmm(guardadaEnt);
  else if (yaTermino) entrada = habitual.entrada;
  else if (esHoy && ahora) entrada = (suTurno && ahora < suTurno.desde) ? '' : ahora;
  else entrada = habitual.entrada;
  let salida;
  if (guardadaSal) salida = (esHoy && ahora && hhmm(guardadaSal) > ahora) ? '' : hhmm(guardadaSal);
  else if (yaTermino) salida = habitual.salida;
  else salida = esHoy ? '' : habitual.salida;

  const conHoras = estado === 'presente';
  if (!conHoras) { entrada = ''; salida = ''; }
  const offHoras = (bloqueado || !conHoras) ? 'disabled' : '';
  const sinTurno = !turnosDe(prof).length
    ? `<span class="apf-sin-turno" title="Cargale el turno en Profesionales">Sin turno cargado</span>` : '';
  const horas = `
      <div class="apf-horas" data-tramo="${n}">
        <label class="apf-hora"><span>Entrada${marcaUbicacion(f[c.entradaPor], f[c.entradaDist])}</span>
          <input type="time" class="apf-entrada" value="${entrada}" ${offHoras}></label>
        <label class="apf-hora"><span>Salida${marcaUbicacion(f[c.salidaPor], f[c.salidaDist])}</span>
          <input type="time" class="apf-salida" value="${salida}" ${offHoras}></label>
        ${sinTurno}
      </div>`;

  const opts = Object.entries(ESTADOS_FICHAJE)
    .map(([v, l]) => `<option value="${v}" ${v === estado ? 'selected' : ''}>${l}</option>`).join('');
  // Tilde de "guardado": con doble turno, el de ESTE turno (que la mañana
  // esté guardada no quiere decir que la tarde también).
  const guardado = !!fichaje && (!esDobleTurno(prof) || !!(f[`estado_${n}`] || f[c.entrada] || f[c.salida]));

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
  // Solo los de la pestaña (turno) elegida.
  const turno = ctx.turno || 'manana';
  const delTurno = profesionales.filter(p => trabajaEnTurno(p, turno));
  const nombreTurno = TURNOS_CENTRO.find(t => t.clave === turno)?.etiqueta.toLowerCase() || 'este turno';
  if (!delTurno.length) {
    return `${aviso}<div class="tablewrap"><div class="state">Nadie trabaja en el ${esc(nombreTurno)}. Se tilda en <b>Profesionales</b>.</div></div>`;
  }
  return `${aviso}<div class="tablewrap apf-lista apf-lista-${turno}" style="padding:6px 4px">${delTurno.map(p => filaHtml(p, fichajesPorId[p.id], ctx)).join('')}</div>`;
}
