// =====================================================================
// VISTA: Grilla de atención (paciente × sector)
// ---------------------------------------------------------------------
// CAPA VISTA. Arma la planilla del centro, la misma que se lleva en
// papel:
//   - FILAS: los pacientes activos (salen solos del sistema).
//   - COLUMNAS: los sectores (Psicología, Fonoaudiología, T.O., …), más
//     la columna "Hs de asist" (turno del paciente).
//   - CELDA: el nombre del profesional que lo atiende. Se escribe a
//     mano, como en una planilla de Excel.
//
// Los sectores (columnas) se agregan/quitan desde Profesionales → pestaña
// "Profesiones", no desde acá: acá solo se muestran.
//
// La vista no guarda nada: solo dibuja lo que le da el controlador.
// =====================================================================

import { esc } from '../utils/ui.js';
import { iniciales } from '../utils/fechas.js';
import { areaDeProfesion, etiquetaArea } from '../utils/areas.js';

// Turnos del paciente (la columna "HS DE ASIST" de la planilla).
export const TURNOS_PACIENTE = [
  { valor: 'mañana', etiqueta: 'Mañana' },
  { valor: 'tarde',  etiqueta: 'Tarde' },
];

// Clave de una celda: identifica el cruce paciente × sector.
export function claveCelda(pacienteId, sector) {
  return `${pacienteId}|${sector}`;
}

// Nombre a mostrar en una celda: el profesional del sistema si está
// vinculado, o lo que se escribió a mano.
export function nombreDeCelda(asignacion) {
  if (!asignacion) return null;
  return asignacion.profesionales?.nombre_completo || asignacion.profesional_nombre || null;
}

// Sugerencias para escribir en las celdas. Es un <datalist>: se puede
// elegir de la lista o escribir cualquier nombre, como en Excel.
export function renderListaProfesionales(profesionales = []) {
  const opciones = profesionales.map(p => {
    const area = etiquetaArea(areaDeProfesion(p.profesion)) || p.profesion || '';
    return `<option value="${esc(p.nombre_completo)}">${esc(area)}</option>`;
  }).join('');
  return `<datalist id="ga-profesionales">${opciones}</datalist>`;
}

// La celda en modo edición: un campo de texto y nada más.
export function renderInputCelda(valor = '') {
  return `<input class="ga-input" list="ga-profesionales" value="${esc(valor)}" autocomplete="off" spellcheck="false">`;
}

// Contenido de una celda ya cargada (o vacía).
export function contenidoCelda(asignacion) {
  const nombre = nombreDeCelda(asignacion);
  if (!nombre) return '';
  // "X" es la marca de la planilla de papel: ese sector no le corresponde.
  if (nombre.trim().toUpperCase() === 'X') return `<span class="ga-equis">X</span>`;
  return `<span class="ga-nombre">${esc(nombre)}</span>`;
}

// La grilla completa.
//   pacientes -> filas
//   sectores  -> columnas [{ clave, etiqueta }]
//   celdas    -> { 'pacienteId|sector': asignación }
//   editable  -> false = solo lectura (perfil sin permiso de operar)
export function renderGrilla({ pacientes = [], sectores = [], celdas = {}, editable = true, profesionales = [] }) {
  if (!pacientes.length) {
    return `<div class="state">No hay pacientes activos. Cargalos desde <b>Pacientes</b> y aparecen acá solos.</div>`;
  }
  if (!sectores.length) {
    return `<div class="state">No hay sectores cargados. Agregá el primero con el botón <b>+ Sector</b>.</div>`;
  }

  const encabezados = sectores.map(s => `
    <th class="ga-col-sector">
      <span class="ga-sector-nombre">${esc(s.etiqueta)}</span>
    </th>`).join('');

  const filas = pacientes.map(pac => {
    const celdasFila = sectores.map(s => {
      const a = celdas[claveCelda(pac.id, s.clave)];
      return `
        <td class="ga-celda${editable ? '' : ' bloqueada'}"
            data-paciente="${pac.id}" data-sector="${esc(s.clave)}"
            ${a?.id ? `data-asignacion="${a.id}"` : ''}
            title="${esc(pac.nombre_completo)} · ${esc(s.etiqueta)}">
          ${contenidoCelda(a)}
        </td>`;
    }).join('');

    const opcionesTurno = TURNOS_PACIENTE.map(t =>
      `<option value="${t.valor}" ${pac.turno === t.valor ? 'selected' : ''}>${t.etiqueta}</option>`).join('');

    // Texto plano de la fila (paciente + todos sus profesionales) para
    // que el buscador filtre por cualquiera de los dos.
    const buscable = [
      pac.nombre_completo,
      ...sectores.map(s => nombreDeCelda(celdas[claveCelda(pac.id, s.clave)])),
    ].filter(Boolean).join(' ').toLowerCase();

    return `
      <tr data-buscar="${esc(buscable)}">
        <th class="ga-col-pac" scope="row">
          <span class="pav">${esc(iniciales(pac.nombre_completo))}</span>
          <span class="ga-pac-nombre"><b>${esc(pac.nombre_completo)}</b></span>
        </th>
        ${celdasFila}
        <td class="ga-col-turno">
          <select class="ga-turno" data-paciente="${pac.id}" ${editable ? '' : 'disabled'}>
            <option value="">—</option>
            ${opcionesTurno}
          </select>
        </td>
      </tr>`;
  }).join('');

  return `
    ${renderListaProfesionales(profesionales)}
    <div class="ga-toolbar">
      <input id="ga-buscar" type="search" autocomplete="off"
             placeholder="🔎 Buscar paciente o profesional…">
      <span class="ga-contador" id="ga-contador"></span>
    </div>
    <div class="ga-scroll">
      <table class="ga-tabla">
        <thead>
          <tr>
            <th class="ga-col-pac ga-esquina">Pacientes</th>
            ${encabezados}
            <th class="ga-col-turno">Hs de asist</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>`;
}
