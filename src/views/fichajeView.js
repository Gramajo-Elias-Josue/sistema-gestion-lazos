// =====================================================================
// VISTA: Mi fichaje (solo el profesional)
// ---------------------------------------------------------------------
// CAPA VISTA. Una sección por TURNO que trabaja el profesional, cada una
// con su color (mañana / tarde) y dos tarjetas: ENTRADA y SALIDA. El que
// hace los dos turnos ve las dos secciones (ficha el corte del mediodía);
// el que hace uno, solo la suya. Cada botón se habilita solo cuando le
// toca (utils/tramosFichaje.js, mismas reglas que la base).
// No hay campo de hora: la pone la base al fichar (función fichar()).
// La salida fichada por error se puede deshacer (solo la de hoy y solo si
// la fichó él con su ubicación; si la cargó la secretaría, la corrige ella).
//
// Debajo, "Mi asistencia": el mismo calendario mensual que ve la
// secretaría en la ficha del profesional.
// =====================================================================

import { esc } from '../utils/ui.js';
import { etiquetaMes } from '../utils/calendario.js';
import { rangoTurno } from '../utils/turnosCentro.js';
import {
  CAMPOS_TRAMO, tramosDe, esDobleTurno, botonesFichaje, pasoFichaje, puedeDeshacerSalida,
  estadoDeTramo, tramoBloqueado,
} from '../utils/tramosFichaje.js';
import { ESTADOS_FICHAJE } from './asistenciaProfView.js';

// Estructura de la sección: los turnos y el calendario del mes.
export function renderEstructuraFichaje({ anio, mes }) {
  return `
    <div class="panel" style="margin-bottom:20px"><div class="panel-b" id="fich-cuerpo"></div></div>
    <div class="panel">
      <div class="panel-h">
        <h2>Mi asistencia</h2>
        <button type="button" class="btn ghost" id="fich-pdf" style="padding:7px 13px">⬇ Descargar PDF</button>
      </div>
      <div class="panel-b">
        <div class="cal-nav" id="fich-cal-nav">
          <button class="nav-dia" data-mes="-1" title="Mes anterior">‹</button>
          <b id="fich-mes-label">${esc(etiquetaMes(anio, mes))}</b>
          <button class="nav-dia" data-mes="1" title="Mes siguiente">›</button>
          <button class="btn ghost" data-mes="hoy" style="padding:7px 13px">Mes actual</button>
        </div>
        <div id="fich-cal-contenido"></div>
      </div>
    </div>`;
}

// "HH:MM:SS" -> "HH:MM".
const hhmm = (t) => t ? String(t).slice(0, 5) : '';

// Ícono de cada turno (además del color, para quien no distingue colores).
const ICONO_TURNO = { manana: '☀️', tarde: '🌇' };

// Una tarjeta (entrada o salida de un tramo). `hora` = la fichada (o
// vacío); `habilitado` = si el botón se puede tocar ahora.
function tarjeta({ que, titulo, hora, por, habilitado, ayuda, extra = '' }) {
  const hecho = !!hora;
  const detalle = hecho
    ? `<div class="fich-hora">${esc(hhmm(hora))}</div>
       <small>${por === 'secretaria' ? 'Cargada por la secretaría' : 'Fichada con tu ubicación 📍'}</small>`
    : `<div class="fich-hora fich-hora-vacia">--:--</div><small>${esc(ayuda)}</small>`;
  return `
    <div class="fich-card${hecho ? ' fich-hecha' : ''}">
      <div class="fich-tit">${esc(titulo)}</div>
      ${detalle}
      <button type="button" class="btn fich-btn" data-fichar="${que}" ${habilitado ? '' : 'disabled'}>
        ${hecho ? `✓ ${esc(titulo)} fichada` : `📍 Fichar ${esc(titulo.toLowerCase())}`}
      </button>
      ${extra}
    </div>`;
}

// Un turno: encabezado con su color + tarjetas de entrada y salida (o el
// aviso, si ese turno figura ausente / de licencia en la planilla).
function seccionTramo({ n, turno }, fila, botones, doble) {
  const c = CAMPOS_TRAMO[n];
  const entradaHecha = !!fila?.[c.entrada];
  const clase = turno ? `fich-t-${turno.clave}` : 'fich-t-sin';
  const encabezado = turno
    ? `${ICONO_TURNO[turno.clave] || ''} ${esc(turno.etiqueta)} <small>${esc(rangoTurno(turno))}</small>`
    : 'Tu turno <small>(todavía no tenés turno cargado)</small>';

  const entrada = tarjeta({
    que: c.fichaEntrada, titulo: 'Entrada',
    hora: fila?.[c.entrada], por: fila?.[c.entradaPor],
    habilitado: botones[c.fichaEntrada],
    ayuda: n === 2 && fila?.hora_entrada && !fila?.hora_salida
      ? 'Se habilita después de fichar la salida de la mañana.'
      : 'Fichala al llegar al centro.',
  });
  const salida = tarjeta({
    que: c.fichaSalida, titulo: 'Salida',
    hora: fila?.[c.salida], por: fila?.[c.salidaPor],
    habilitado: botones[c.fichaSalida],
    ayuda: entradaHecha ? 'Fichala al irte.' : 'Se habilita después de fichar la entrada.',
    extra: puedeDeshacerSalida(fila, n)
      ? `<button type="button" class="fich-deshacer" data-deshacer-salida="${n}">↺ Deshacer salida (si fue un error)</button>`
      : '',
  });

  const cuerpo = tramoBloqueado(fila, n, doble)
    ? `<div class="state">En este turno figurás como <b>${esc(ESTADOS_FICHAJE[estadoDeTramo(fila, n, doble)] || '')}</b> en la planilla, así que no hace falta fichar. Si es un error, avisale a la secretaría.</div>`
    : `<div class="fich-grid">${entrada}${salida}</div>`;
  return `
    <section class="fich-tramo ${clase}">
      <div class="fich-tramo-h">${encabezado}</div>
      ${cuerpo}
    </section>`;
}

// La pantalla completa. `fila` = el fichaje del día (o null);
// `profesional` = su ficha (de ahí salen sus turnos).
export function renderFichaje({ fila, profesional }) {
  const doble = esDobleTurno(profesional);
  const paso = pasoFichaje(fila, doble);

  if (paso === 'bloqueado') {
    const estado = ESTADOS_FICHAJE[fila?.estado] || fila?.estado || '';
    return `<div class="state">Hoy figurás como <b>${esc(estado)}</b> en la planilla, así que no hace falta fichar. Si es un error, avisale a la secretaría.</div>`;
  }

  const botones = botonesFichaje(fila, doble);
  const secciones = tramosDe(profesional).map(t => seccionTramo(t, fila, botones, doble)).join('');
  const pie = paso === 'listo'
    ? `<div class="fich-listo">Ya fichaste ${doble ? 'los dos turnos' : 'la entrada y la salida'} de hoy. ✓</div>`
    : `<p class="fich-nota">Se usa tu ubicación para confirmar que estás en el centro. La hora la pone el sistema.</p>`;

  return `<div class="fich-tramos">${secciones}</div>${pie}`;
}
