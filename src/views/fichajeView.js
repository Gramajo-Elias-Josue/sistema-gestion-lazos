// =====================================================================
// VISTA: Mi fichaje (solo el profesional)
// ---------------------------------------------------------------------
// CAPA VISTA. Dos tarjetas, una para la ENTRADA y otra para la SALIDA,
// cada una con su botón. Cada botón se habilita solo cuando le toca:
//   - Entrada: hasta que se fiche (después queda la hora y el botón apagado).
//   - Salida:  recién con la entrada fichada, y hasta que se fiche.
// No hay campo de hora: la pone la base al fichar (función fichar()).
// La salida fichada por error se puede deshacer (solo la de hoy y solo si
// la fichó él con su ubicación; si la cargó la secretaría, la corrige ella).
//
// Debajo, "Mi asistencia": el mismo calendario mensual que ve la
// secretaría en la ficha del profesional.
// =====================================================================

import { esc } from '../utils/ui.js';
import { proximoPaso } from '../utils/ubicacion.js';
import { etiquetaMes } from '../utils/calendario.js';
import { ESTADOS_FICHAJE } from './asistenciaProfView.js';

// Estructura de la sección: las dos tarjetas y el calendario del mes.
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

// ¿Se puede deshacer la salida de esta fila? (misma regla que la base)
export function puedeDeshacerSalida(fila) {
  return !!fila?.hora_salida && fila?.salida_por === 'ubicacion';
}

// "HH:MM:SS" -> "HH:MM".
const hhmm = (t) => t ? String(t).slice(0, 5) : '';

// Una tarjeta (entrada o salida). `hora` = la fichada (o vacío);
// `habilitado` = si el botón se puede tocar ahora.
function tarjeta({ que, titulo, icono, hora, por, habilitado, ayuda, extra = '' }) {
  const hecho = !!hora;
  const detalle = hecho
    ? `<div class="fich-hora">${esc(hhmm(hora))}</div>
       <small>${por === 'secretaria' ? 'Cargada por la secretaría' : 'Fichada con tu ubicación 📍'}</small>`
    : `<div class="fich-hora fich-hora-vacia">--:--</div><small>${esc(ayuda)}</small>`;
  return `
    <div class="fich-card${hecho ? ' fich-hecha' : ''}">
      <div class="fich-tit">${icono} ${esc(titulo)}</div>
      ${detalle}
      <button type="button" class="btn fich-btn" data-fichar="${que}" ${habilitado ? '' : 'disabled'}>
        ${hecho ? `✓ ${esc(titulo)} fichada` : `📍 Fichar ${esc(titulo.toLowerCase())}`}
      </button>
      ${extra}
    </div>`;
}

// La pantalla completa. `fila` = el fichaje del día (o null).
export function renderFichaje({ fila }) {
  const paso = proximoPaso(fila);

  if (paso === 'bloqueado') {
    const estado = ESTADOS_FICHAJE[fila?.estado] || fila?.estado || '';
    return `<div class="state">Hoy figurás como <b>${esc(estado)}</b> en la planilla, así que no hace falta fichar. Si es un error, avisale a la secretaría.</div>`;
  }

  const entrada = tarjeta({
    que: 'entrada', titulo: 'Entrada', icono: '🟢',
    hora: fila?.hora_entrada, por: fila?.entrada_por,
    habilitado: paso === 'entrada',
    ayuda: 'Fichala al llegar al centro.',
  });
  const salida = tarjeta({
    que: 'salida', titulo: 'Salida', icono: '🔴',
    hora: fila?.hora_salida, por: fila?.salida_por,
    habilitado: paso === 'salida',
    ayuda: paso === 'entrada' ? 'Se habilita después de fichar la entrada.' : 'Fichala al irte.',
    extra: puedeDeshacerSalida(fila)
      ? `<button type="button" class="fich-deshacer" data-deshacer-salida>↺ Deshacer salida (si fue un error)</button>`
      : '',
  });

  const pie = paso === 'listo'
    ? `<div class="fich-listo">Ya fichaste la entrada y la salida de hoy. ✓</div>`
    : `<p class="fich-nota">Se usa tu ubicación para confirmar que estás en el centro. La hora la pone el sistema.</p>`;

  return `<div class="fich-grid">${entrada}${salida}</div>${pie}`;
}
