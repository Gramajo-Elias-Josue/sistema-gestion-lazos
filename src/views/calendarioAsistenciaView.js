// =====================================================================
// VISTA: Calendario de asistencia (ficha grande de una persona)
// ---------------------------------------------------------------------
// CAPA VISTA. Arma el modal con el calendario mensual de UN paciente o
// UN profesional: verde los días que asistió, rojo los que faltó, gris
// los fines de semana (la clínica no abre). Sirve para los dos casos
// porque solo recibe días ya clasificados por utils/calendario.js.
// =====================================================================

import { esc } from '../utils/ui.js';
import { iniciales, formatearFecha } from '../utils/fechas.js';
import { DIAS_SEMANA, ESTADOS_CALENDARIO, etiquetaMes } from '../utils/calendario.js';

// Modal completo. `persona` = { nombre_completo, ... }, `subtitulo` es el
// renglón chico (diagnóstico del paciente o profesión del profesional).
export function renderModalCalendario({ persona = {}, subtitulo = '', anio, mes, contenido = '' }) {
  return `
    <div class="overlay" id="overlay-cal">
      <div class="modal cal-modal">
        <div class="modal-h">
          <div class="cal-titulo">
            <div class="pav">${esc(iniciales(persona.nombre_completo))}</div>
            <div>
              <h2>${esc(persona.nombre_completo || '')}</h2>
              <small>${esc(subtitulo || '')}</small>
            </div>
          </div>
          <button class="x" data-cerrar aria-label="Cerrar">×</button>
        </div>
        <div class="modal-b">
          <div class="cal-nav">
            <button class="nav-dia" data-mes="-1" title="Mes anterior">‹</button>
            <b id="cal-mes-label">${esc(etiquetaMes(anio, mes))}</b>
            <button class="nav-dia" data-mes="1" title="Mes siguiente">›</button>
            <button class="btn ghost" data-mes="hoy" style="padding:7px 13px">Mes actual</button>
          </div>
          <div id="cal-contenido">${contenido}</div>
        </div>
        <div class="modal-f">
          <button type="button" class="btn ghost" data-cerrar>Cerrar</button>
          <button type="button" class="btn" id="cal-pdf">⬇ Descargar PDF</button>
        </div>
      </div>
    </div>`;
}

// Mini calendario en TIRA para la fila de la planilla diaria: un
// cuadradito por día del mes, con los mismos colores que la ficha
// grande. Sirve para ver de un vistazo cómo viene el mes del paciente
// sin abrir nada. `fechaActual` marca el día que se está registrando.
export function renderMiniCalendario(calendario, { fechaActual = null } = {}) {
  if (!calendario) return `<span class="mini-cal vacia">—</span>`;

  const celdas = calendario.dias.map(d => {
    let clase = 'm-dia';
    let detalle = 'Sin registro';

    if (d.finde) { clase += ' cerrado'; detalle = 'La clínica no abre'; }
    else if (d.estado) {
      const e = ESTADOS_CALENDARIO[d.estado];
      clase += ` ${e?.clase || ''}`;
      detalle = e?.etiqueta || d.estado;
      if (d.nota) detalle += ` — ${d.nota}`;
    } else if (d.futuro) { clase += ' futuro'; detalle = 'Todavía no pasó'; }
    else clase += ' sinreg';

    if (d.iso === fechaActual) clase += ' hoy';
    return `<i class="${clase}" title="${esc(`${formatearFecha(d.iso)} · ${detalle}`)}"></i>`;
  }).join('');

  const { resumen } = calendario;
  return `${celdas}<b class="m-pct" title="${resumen.presentes} de ${resumen.registrados} días con registro">${resumen.pct}%</b>`;
}

// Calendario + resumen + referencia de colores.
// `calendario` es lo que devuelve armarCalendario().
export function renderCalendario(calendario) {
  const { semanas, resumen, anio, mes } = calendario;

  const encabezado = DIAS_SEMANA
    .map((d, i) => `<div class="cal-dow${i >= 5 ? ' finde' : ''}">${d}</div>`)
    .join('');

  const celdas = semanas.flat().map(d => {
    if (!d) return `<div class="cal-dia vacia"></div>`;

    // Orden de prioridad para pintar: fin de semana (cerrado) > estado
    // registrado > día futuro > hábil sin registro.
    let clase = 'cal-dia';
    let titulo = formatearFecha(d.iso);
    let marca = '';

    if (d.finde) {
      clase += ' cerrado';
      titulo += ' · La clínica no abre';
    } else if (d.estado) {
      const e = ESTADOS_CALENDARIO[d.estado];
      clase += ` ${e?.clase || ''}`;
      titulo += ` · ${e?.etiqueta || d.estado}`;
      if (d.nota) titulo += ` — ${d.nota}`;
      // Los fichajes de profesional muestran el horario dentro del día.
      if (d.entrada || d.salida) {
        const hhmm = (t) => (t ? String(t).slice(0, 5) : '—');
        marca = `<small>${hhmm(d.entrada)}–${hhmm(d.salida)}</small>`;
        titulo += ` · ${hhmm(d.entrada)} a ${hhmm(d.salida)}`;
      } else if (d.nota) {
        marca = `<small title="${esc(d.nota)}">✎</small>`;
      }
    } else if (d.futuro) {
      clase += ' futuro';
    } else {
      clase += ' sinreg';
      titulo += ' · Sin registro';
    }

    return `<div class="${clase}" title="${esc(titulo)}"><b>${d.dia}</b>${marca}</div>`;
  }).join('');

  return `
    <div class="cal-resumen">
      <div><div class="n" style="color:var(--teal-600)">${resumen.presentes}</div><small>Presentes</small></div>
      <div><div class="n" style="color:var(--red-600)">${resumen.ausentes}</div><small>Ausentes</small></div>
      <div><div class="n" style="color:var(--amber-600)">${resumen.avisados}</div><small>Con aviso</small></div>
      <div><div class="n">${resumen.sinRegistro}</div><small>Sin registro</small></div>
      <div><div class="n">${resumen.pct}%</div><small>Asistencia</small></div>
    </div>
    <div class="cal-grid" data-mes="${anio}-${String(mes).padStart(2, '0')}">
      ${encabezado}
      ${celdas}
    </div>
    <div class="cal-ref">
      <span><i class="cal-ok"></i>Asistió</span>
      <span><i class="cal-bad"></i>No asistió</span>
      <span><i class="cal-avi"></i>Ausente con aviso / licencia</span>
      <span><i class="cal-enf"></i>Enfermedad</span>
      <span><i class="cerrado"></i>Fin de semana (la clínica no abre)</span>
      <span><i class="sinreg"></i>Sin registro</span>
    </div>`;
}
