// =====================================================================
// VISTA: Grilla de atención (profesional × franja horaria)
// ---------------------------------------------------------------------
// CAPA VISTA. Arma la organización general de turnos del centro, como la
// planilla que se lleva en papel:
//   - Separada en los dos TURNOS del centro (pestañas mañana 8 a 12 /
//     tarde 14 a 18). En cada turno aparecen solo los profesionales que
//     trabajan en él; el que hace los dos aparece en ambas pestañas.
//   - UNA TARJETA por profesional, agrupadas y coloreadas por su sector
//     (Psicología, Fonoaudiología, T.O., …).
//   - Dentro de cada tarjeta, las FRANJAS HORARIAS de 30 minutos de ese
//     turno.
//   - En cada franja, el PACIENTE que tiene esa hora con ese profesional.
//     Se elige de los pacientes cargados (ya no se escribe libre).
//
// Las tarjetas van una al lado de la otra en pantalla ancha y en
// carrusel (una por vez, con flechas) en el celular — lo decide el CSS
// con un media query; acá se arma UNA sola vez el mismo markup para las
// dos pantallas.
//
// Los sectores (para agrupar y colorear) se agregan/quitan desde
// Profesionales → pestaña "Profesiones"; acá solo se muestran.
//
// La vista no guarda nada: solo dibuja lo que le da el controlador.
// =====================================================================

import { esc } from '../utils/ui.js';
import { iniciales } from '../utils/fechas.js';
import { areaDelProfesional } from '../utils/areas.js';
import { TURNOS_CENTRO, turnosDe, rangoTurno } from '../utils/turnosCentro.js';

// Cada franja dura 30 minutos: es lo que pidió el centro para poder
// ajustar los turnos sin que la planilla quede eterna de larga.
export const MINUTOS_FRANJA = 30;

// Clave de una celda: identifica el cruce profesional × franja horaria.
export function claveCelda(profesionalId, hora) {
  return `${profesionalId}|${hora}`;
}

// Las franjas de `minutos` entre dos horas 'HH:MM', en orden.
export function franjasEntre(desde, hasta, minutos = MINUTOS_FRANJA) {
  const [hD, mD] = desde.split(':').map(Number);
  const [hH, mH] = hasta.split(':').map(Number);
  const franjas = [];
  let cursor = hD * 60 + mD;
  const fin = hH * 60 + mH;
  while (cursor + minutos <= fin) {
    franjas.push(`${String(Math.floor(cursor / 60)).padStart(2, '0')}:${String(cursor % 60).padStart(2, '0')}`);
    cursor += minutos;
  }
  return franjas;
}

// Las franjas de 30 minutos de un profesional: las de sus turnos (o solo
// las de `clave` — 'manana' / 'tarde' — si se pide uno). Sin turnos
// cargados devuelve una lista vacía.
export function franjasDe(profesional, clave = null, minutos = MINUTOS_FRANJA) {
  return turnosDe(profesional)
    .filter(t => !clave || t.clave === clave)
    .flatMap(t => franjasEntre(t.desde, t.hasta, minutos));
}

// Paciente de una celda ya cargada (o null si está vacía).
export function pacienteDeCelda(asignacion) {
  return asignacion?.pacientes?.nombre_completo || null;
}

// Contenido de una celda: el nombre del paciente, o nada.
export function contenidoCelda(asignacion) {
  const nombre = pacienteDeCelda(asignacion);
  return nombre ? `<span class="ga-nombre">${esc(nombre)}</span>` : '';
}

// Sugerencias para escribir en las celdas: los pacientes cargados. Una
// sola lista para toda la grilla (cualquier paciente puede ir con
// cualquier profesional; ya no hay que filtrar por sector). Sigue siendo
// un <datalist>: se puede elegir o escribir cualquier nombre.
export function renderListaPacientes(pacientes = []) {
  const opciones = pacientes.map(p => `<option value="${esc(p.nombre_completo)}"></option>`).join('');
  return `<datalist id="ga-pacientes">${opciones}</datalist>`;
}

// La celda en modo edición: un campo de texto y nada más.
export function renderInputCelda(valor = '') {
  return `<input class="ga-input" list="ga-pacientes" value="${esc(valor)}" autocomplete="off" spellcheck="false">`;
}

// Agrupa los profesionales por su sector (para el color y el orden de
// las tarjetas), en el orden en que están las columnas de "Profesiones".
// Al que no se le conoce el sector (dato viejo sin migrar) va en un
// grupo aparte al final, gris, en vez de perderse.
function agruparPorSector(profesionales, sectores) {
  const grupos = sectores.map((s, indice) => ({
    ...s,
    indice,
    profesionales: profesionales.filter(p => areaDelProfesional(p) === s.clave),
  }));
  const yaAgrupados = new Set(grupos.flatMap(g => g.profesionales.map(p => p.id)));
  const sueltos = profesionales.filter(p => !yaAgrupados.has(p.id));
  if (sueltos.length) {
    grupos.push({ clave: '_sin-sector', etiqueta: 'Sin sector', indice: sectores.length, profesionales: sueltos });
  }
  return grupos.filter(g => g.profesionales.length);
}

// ---------------------------------------------------------------------
// TURNOS CASUALES DE HOY EN LA GRILLA (solo para ver)
// ---------------------------------------------------------------------
// Los turnos casuales (Agenda) se muestran en su franja SOLO el día del
// turno: no se guardan en la grilla, se leen de `turnos` con la fecha de
// hoy. Por eso al día siguiente desaparecen solos, sin borrar nada.

// Franja de 30 min en la que cae una hora: '09:15' -> '09:00'.
export function franjaDeHora(hora, minutos = MINUTOS_FRANJA) {
  const hhmm = String(hora || '').slice(0, 5);
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(':').map(Number);
  const total = Math.floor((h * 60 + m) / minutos) * minutos;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// Turnos de hoy -> { 'profesionalId|franja': turno } con los CASUALES (sin
// legajo) que no están cancelados.
export function casualesPorCelda(turnos = []) {
  const porCelda = {};
  turnos
    .filter(t => !t.paciente_id && t.estado !== 'cancelado' && t.hora && t.profesional_id)
    .forEach(t => {
      const clave = claveCelda(t.profesional_id, franjaDeHora(t.hora));
      if (!porCelda[clave]) porCelda[clave] = t;
    });
  return porCelda;
}

// Franja ocupada por un casual: se ve distinta y NO se puede tocar (no
// es la clase .ga-celda, así que el controlador no la abre para editar).
function celdaCasual(turno) {
  const nombre = turno.paciente_nombre || turno.pacientes?.nombre_completo || 'Paciente casual';
  return `
        <div class="ga-casual" title="Turno casual de hoy, cargado en Turnos. Mañana esta franja vuelve a estar libre.">
          <span class="ga-casual-tag">Casual</span>
          <span class="ga-nombre">${esc(nombre)}</span>
        </div>`;
}

// Texto de búsqueda de una tarjeta: el profesional, su sector y todos
// los pacientes que hoy tiene en alguna franja (fijos y casuales).
function textoBuscable(prof, grupo, franjas, celdas, casuales) {
  return [
    prof.nombre_completo,
    grupo.etiqueta,
    ...franjas.map(hora => pacienteDeCelda(celdas[claveCelda(prof.id, hora)])),
    ...franjas.map(hora => casuales[claveCelda(prof.id, hora)]?.paciente_nombre),
  ].filter(Boolean).join(' ').toLowerCase();
}

// Una tarjeta = un profesional, con las franjas del turno que se está
// viendo. Coloreada según su sector (`ga-area-N`, ver estilos) para
// identificarlo de un vistazo, como los colores de la planilla en papel.
// Si una franja está vacía en la grilla pero hoy tiene un turno casual,
// se muestra el casual (el paciente fijo siempre tiene prioridad).
function renderTarjetaProfesional(prof, grupo, celdas, editable, turno, casuales) {
  const franjas = franjasDe(prof, turno);
  const filas = franjas.map(hora => {
    const a = celdas[claveCelda(prof.id, hora)];
    const casual = !a && casuales[claveCelda(prof.id, hora)];
    return `
      <div class="ga-fila-horario">
        <span class="ga-hora">${hora}</span>${casual ? celdaCasual(casual) : `
        <div class="ga-celda${editable ? '' : ' bloqueada'}"
             data-profesional="${prof.id}" data-hora="${hora}"
             ${a?.id ? `data-asignacion="${a.id}"` : ''}>${contenidoCelda(a)}</div>`}
      </div>`;
  }).join('');

  return `
    <article class="ga-tarjeta ga-area-${grupo.indice % 8}"
             data-buscar="${esc(textoBuscable(prof, grupo, franjas, celdas, casuales))}">
      <header class="ga-tarjeta-h">
        <span class="pav">${esc(iniciales(prof.nombre_completo))}</span>
        <div class="ga-tarjeta-tit">
          <b>${esc(prof.nombre_completo)}</b>
          <small>${esc(grupo.etiqueta)}</small>
        </div>
      </header>
      <div class="ga-tarjeta-b">
        <div class="ga-fila-horario ga-encabezado-fila">
          <span class="ga-hora">HS</span>
          <span>PACIENTE</span>
        </div>
        ${filas}
      </div>
    </article>`;
}

// Pestañas de los dos turnos del centro, con cuántos profesionales
// trabajan en cada uno.
function renderPestanasTurno(profesionales, turno) {
  const botones = TURNOS_CENTRO.map(t => {
    const cuantos = profesionales.filter(p => turnosDe(p).some(x => x.clave === t.clave)).length;
    return `
      <button type="button" class="tab${t.clave === turno ? ' active' : ''}" data-turno="${t.clave}">
        ${esc(t.etiqueta)} <small>${esc(rangoTurno(t))} · ${cuantos}</small>
      </button>`;
  }).join('');
  return `<div class="tabs ga-turnos" id="ga-turnos">${botones}</div>`;
}

// La grilla completa.
//   profesionales -> activos; se muestran los que trabajan en `turno`
//   sectores      -> para agrupar y colorear las tarjetas [{ clave, etiqueta }]
//   pacientes     -> sugerencias para las celdas
//   celdas        -> { 'profesionalId|hora': asignación }
//   editable      -> false = solo lectura (perfil sin permiso de operar)
//   turno         -> 'manana' | 'tarde': la pestaña que se está viendo
//   casuales      -> { 'profesionalId|franja': turno } de HOY (casualesPorCelda)
export function renderGrilla({ profesionales = [], sectores = [], pacientes = [], celdas = {}, editable = true, turno = 'manana', casuales = {} }) {
  if (!profesionales.length) {
    return `<div class="state">No hay profesionales activos. Cargalos desde <b>Profesionales</b> y aparecen acá solos.</div>`;
  }
  if (!sectores.length) {
    return `<div class="state">No hay profesiones cargadas. Agregá la primera desde Profesionales → pestaña "Profesiones".</div>`;
  }

  const delTurno = profesionales.filter(p => turnosDe(p).some(t => t.clave === turno));
  const grupos = agruparPorSector(delTurno, sectores);
  const tarjetas = grupos
    .flatMap(g => g.profesionales.map(p => renderTarjetaProfesional(p, g, celdas, editable, turno, casuales)))
    .join('');

  // Los que no tienen ningún turno tildado no entran en ninguna pestaña:
  // se avisa para que no "desaparezcan" sin explicación.
  const sinTurno = profesionales.filter(p => !turnosDe(p).length);
  const avisoSinTurno = sinTurno.length ? `
    <div class="banner banner-alerta"><div>
      <b>Sin turno cargado:</b> ${esc(sinTurno.map(p => p.nombre_completo).join(' · '))}.
      Tildá su turno en <b>Profesionales</b> para verlos en la grilla.
    </div></div>` : '';

  const nombreTurno = TURNOS_CENTRO.find(t => t.clave === turno)?.etiqueta.toLowerCase() || 'este turno';
  const contenido = tarjetas || `<div class="state">Nadie trabaja en el ${esc(nombreTurno)}. Se tilda en <b>Profesionales</b>.</div>`;

  // El carrusel/flechas son solo para el celular (una tarjeta a la vez);
  // en pantalla ancha el mismo markup se ve como columnas lado a lado.
  // Lo decide el CSS; el controlador solo prende las flechas si hace
  // falta (ver actualizarCarrusel).
  return `
    ${renderListaPacientes(pacientes)}
    ${renderPestanasTurno(profesionales, turno)}
    ${avisoSinTurno}
    <div class="ga-toolbar">
      <input id="ga-buscar" type="search" autocomplete="off"
             placeholder="🔎 Buscar profesional o paciente…">
      <span class="ga-contador" id="ga-contador"></span>
    </div>
    <div class="ga-carrusel">
      <div class="ga-tarjetas" id="ga-tarjetas">${contenido}</div>
      <div class="ga-pager" id="ga-pager" hidden>
        <button type="button" class="btn ghost" id="ga-prev" aria-label="Profesional anterior">‹</button>
        <span class="ga-pager-info" id="ga-pager-info"></span>
        <button type="button" class="btn ghost" id="ga-next" aria-label="Profesional siguiente">›</button>
      </div>
    </div>`;
}
