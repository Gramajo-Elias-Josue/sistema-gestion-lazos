// =====================================================================
// VISTA: Calendario de asistencia (ficha grande de una persona)
// ---------------------------------------------------------------------
// CAPA VISTA. Arma el modal con el calendario mensual de UN paciente o
// UN profesional: verde los días que asistió, rojo los que faltó, gris
// los fines de semana (la clínica no abre). Sirve para los dos casos
// porque solo recibe días ya clasificados por utils/calendario.js.
// =====================================================================

import { esc } from '../utils/ui.js';
import { iniciales, formatearFecha, fechaLarga } from '../utils/fechas.js';
import { DIAS_SEMANA, ESTADOS_CALENDARIO, etiquetaMes, etiquetaOrigen, tieneSegundoTramo } from '../utils/calendario.js';

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

// Mini calendario en TIRA para la fila de la planilla diaria: los 5 días
// HÁBILES de una semana (la clínica no abre sábado ni domingo, así que
// mostrarlos era espacio perdido), con los mismos colores que la ficha
// grande y flechas para moverse semana a semana sin salir del mes.
//   fechaActual   -> el día que se está registrando (se resalta)
//   semanaVisible -> índice de la semana a mostrar (ver semanaDeFecha)
//   pacienteId, nombre -> para el botón que abre la ficha completa
// Inicial de lunes a viernes.
const INICIALES_DIA = ['L', 'M', 'M', 'J', 'V'];

export function renderMiniCalendario(calendario, { fechaActual = null, semanaVisible = 0, pacienteId = '', nombre = '' } = {}) {
  if (!calendario) return `<span class="mini-cal vacia">—</span>`;

  const totalSemanas = calendario.semanas.length;
  const indice = Math.max(0, Math.min(semanaVisible, totalSemanas - 1));
  // Las semanas de armarCalendario siempre van Lun→Dom: nos quedamos solo
  // con los primeros 5 (hábiles), sábado y domingo quedan afuera.
  const semana = (calendario.semanas[indice] || []).slice(0, 5);

  const celdas = semana.map((d, i) => {
    if (!d) return `<i class="m-dia relleno"></i>`; // relleno fuera del mes (1ª/última semana)

    let clase = 'm-dia';
    let detalle = 'Sin registro';

    if (d.estado) {
      const e = ESTADOS_CALENDARIO[d.estado];
      clase += ` ${e?.clase || ''}`;
      detalle = e?.etiqueta || d.estado;
      if (d.nota) detalle += ` — ${d.nota}`;
    } else if (d.futuro) { clase += ' futuro'; detalle = 'Todavía no pasó'; }
    else clase += ' sinreg';

    if (d.iso === fechaActual) clase += ' hoy';
    return `<i class="${clase}" title="${esc(`${formatearFecha(d.iso)} · ${detalle}`)}">${INICIALES_DIA[i]}</i>`;
  }).join('');

  const { resumen } = calendario;
  const prevOff = indice <= 0 ? 'disabled' : '';
  const nextOff = indice >= totalSemanas - 1 ? 'disabled' : '';

  return `
    <button class="sem-nav" data-semana-prev title="Semana anterior" ${prevOff}>‹</button>
    <button class="mini-cal-dias" data-ficha="${pacienteId}" title="Ver la ficha de asistencia del mes de ${esc(nombre)}">${celdas}</button>
    <button class="sem-nav" data-semana-sig title="Semana siguiente" ${nextOff}>›</button>
    <b class="m-pct" title="${resumen.presentes} de ${resumen.registrados} días con registro">${resumen.pct}%</b>`;
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
      // El horario no va dentro del día (queda chico y amontonado): se ve
      // tocando el día, en el detalle de abajo. Solo se marca si hay nota.
      if (d.nota) marca = `<small title="${esc(d.nota)}">✎</small>`;
    } else if (d.futuro) {
      clase += ' futuro';
    } else {
      clase += ' sinreg';
      titulo += ' · Sin registro';
    }

    // Cada día es un botón: al tocarlo se ve su detalle debajo del mes.
    return `<button type="button" class="${clase}" data-dia="${d.iso}" title="${esc(titulo)}"><b>${d.dia}</b>${marca}</button>`;
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
    </div>
    <div class="cal-detalle" data-cal-detalle>${renderDetalleDia(null)}</div>`;
}

// Detalle de UN día (al tocarlo en el calendario): estado, horario del
// fichaje con quién lo cargó y la nota. `dia` es una celda de
// armarCalendario(); null = todavía no se tocó ninguno.
export function renderDetalleDia(dia) {
  if (!dia) return `<span class="cal-detalle-ayuda">Tocá un día para ver el detalle.</span>`;

  const fecha = `<b>${esc(fechaLarga(dia.iso))}</b>`;
  if (dia.finde) return `${fecha}<span>La clínica no abre.</span>`;
  if (!dia.estado) return `${fecha}<span>${dia.futuro ? 'Todavía no pasó.' : 'Sin registro.'}</span>`;

  const hhmm = (t) => (t ? String(t).slice(0, 5) : '—');
  const origen = (por, dist) => {
    if (!por) return '';
    const metros = por === 'ubicacion' && Number.isFinite(dist) ? `, a ${dist} m del centro` : '';
    return ` <small>(${esc(etiquetaOrigen(por))}${metros})</small>`;
  };
  const estado = ESTADOS_CALENDARIO[dia.estado]?.etiqueta || dia.estado;
  const par = (ent, entPor, entDist, sal, salPor, salDist) => `
    <span>Entrada: <b>${hhmm(ent)}</b>${origen(ent && entPor, entDist)}</span>
    <span>Salida: <b>${hhmm(sal)}</b>${origen(sal && salPor, salDist)}</span>`;
  let horas = '';
  if (tieneSegundoTramo(dia)) {
    // Doble turno: un renglón por turno (mañana / tarde).
    horas = `
      <div class="cal-tramo cal-t-manana">☀️ <b>Mañana</b>${par(dia.entrada, dia.entradaPor, dia.entradaDist, dia.salida, dia.salidaPor, dia.salidaDist)}</div>
      <div class="cal-tramo cal-t-tarde">🌇 <b>Tarde</b>${par(dia.entrada2, dia.entrada2Por, dia.entrada2Dist, dia.salida2, dia.salida2Por, dia.salida2Dist)}</div>`;
  } else if (dia.entrada || dia.salida) {
    horas = par(dia.entrada, dia.entradaPor, dia.entradaDist, dia.salida, dia.salidaPor, dia.salidaDist);
  }
  const nota = dia.nota ? `<span>Observaciones: ${esc(dia.nota)}</span>` : '';
  return `${fecha}<span>${esc(estado)}</span>${horas}${nota}`;
}
