// =====================================================================
// VISTA: Profesionales
// ---------------------------------------------------------------------
// CAPA VISTA. Arma la tabla del equipo, el formulario de alta/edición y
// la pestaña "Profesiones" (los sectores: mismos que las columnas de la
// Grilla de atención, y lo que cada profesional elige de un desplegable
// al darse de alta — antes se agregaban/quitaban desde la Grilla).
// =====================================================================

import { iniciales } from '../utils/fechas.js';
import { esc, pill } from '../utils/ui.js';
import { areaDelProfesional } from '../utils/areas.js';
import { TURNOS_CENTRO, rangoTurno, textoTurnos } from '../utils/turnosCentro.js';

// Estructura base: pestañas Equipo / Profesiones.
export function renderEstructura() {
  return `
    <div class="tabs" id="prof-tabs">
      <button class="tab active" data-tab="equipo">Equipo</button>
      <button class="tab" data-tab="sectores">Profesiones</button>
    </div>
    <div id="prof-pane-equipo">
      <div class="seccion-intro">
        <p>Equipo interdisciplinario. Podés crear, editar o dar de baja un profesional.</p>
        <button class="btn" id="btn-nuevo-prof">+ Nuevo profesional</button>
      </div>
      <div id="prof-tabla"></div>
    </div>
    <div id="prof-pane-sectores" class="hidden">
      <div class="seccion-intro">
        <p>Profesiones del centro: son las columnas de la Grilla de atención y lo que cada profesional elige al darse de alta.</p>
        <button class="btn" id="btn-nuevo-sector">+ Nueva profesión</button>
      </div>
      <div id="sectores-tabla"></div>
    </div>`;
}

// Tabla de profesiones/sectores.
export function renderListaSectores(sectores) {
  if (!sectores.length) {
    return `<div class="tablewrap"><div class="state">No hay profesiones cargadas. Usá "+ Nueva profesión".</div></div>`;
  }
  const filas = sectores.map(s => `
    <tr>
      <td><b>${esc(s.etiqueta)}</b></td>
      <td style="white-space:nowrap;text-align:right">
        <button class="btn ghost btn-quitar-sector" data-id="${esc(s.id)}" data-clave="${esc(s.clave)}" data-etiqueta="${esc(s.etiqueta)}" style="padding:6px 12px;color:var(--red-600)">Quitar</button>
      </td>
    </tr>`).join('');

  return `
    <div class="tablewrap">
      <table>
        <thead><tr><th>Profesión / sector</th><th></th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </div>`;
}

// Modal para agregar una profesión/sector nuevo.
export function renderModalSector() {
  return `
    <div class="overlay" id="overlay-sector">
      <div class="modal" style="max-width:420px">
        <div class="modal-h">
          <h2>Nueva profesión</h2>
          <button class="x" data-cerrar aria-label="Cerrar">×</button>
        </div>
        <form id="form-sector">
          <div class="modal-b">
            <div class="form-field full">
              <label>Nombre *</label>
              <input name="etiqueta" required placeholder="Ej: Musicoterapia" autocomplete="off">
              <small style="color:var(--ink-faint)">Se puede elegir al crear un profesional, y aparece como columna en la Grilla de atención.</small>
            </div>
          </div>
          <div class="modal-f">
            <button type="button" class="btn ghost" data-cerrar>Cancelar</button>
            <button type="submit" class="btn">Agregar</button>
          </div>
        </form>
      </div>
    </div>`;
}

// Tabla del listado de profesionales. Arriba lleva un buscador (lo
// maneja el controlador escondiendo filas). En escritorio es una tabla;
// en celular el CSS (.tabla-cards) la convierte en tarjetas.
// `sectores` (en el orden de la pestaña "Profesiones") da el color de
// cada uno: el mismo que su tarjeta en la Grilla de atención.
export function renderTabla(profesionales, sectores = []) {
  if (!profesionales.length) {
    return `<div class="tablewrap"><div class="state">No hay profesionales cargados todavía.</div></div>`;
  }

  const filas = profesionales.map(p => {
    // El conteo de pacientes viene embebido como asignaciones: [{ count: N }].
    const cantPacientes = Array.isArray(p.asignaciones) && p.asignaciones[0]
      ? p.asignaciones[0].count
      : 0;
    const activo = p.estado === 'activo';
    // Para las iniciales del avatar, sacamos el título (Lic./Prof./Dr./Dra.).
    const nombreSinTitulo = (p.nombre_completo || '').replace(/^(Lic\.|Prof\.|Dra\.|Dr\.)\s/, '');
    const especialidad = p.especialidad || p.profesion || '';
    // Texto por el que filtra el buscador: nombre, email, especialidad y matrícula.
    const buscar = `${p.nombre_completo || ''} ${p.email || ''} ${especialidad} ${p.matricula || ''}`.toLowerCase();
    const dias = (p.dias_trabajo && p.dias_trabajo.length
      ? esc(p.dias_trabajo.map(d => d.slice(0, 3)).join(', '))
      : 'Sin días asignados')
      + ' · ' + esc(textoTurnos(p) || 'Sin turno');

    // Mismo cálculo que la grilla: posición del sector en la lista; sin
    // sector conocido, el gris (5).
    const iSector = sectores.findIndex(s => s.clave === areaDelProfesional(p));
    const tono = iSector >= 0 ? iSector % 8 : 5;

    return `
      <tr class="tono-${tono}" data-buscar="${esc(buscar)}" style="cursor:default${activo ? '' : ';opacity:.55'}">
        <td class="tc-nombre">
          <div class="pname">
            <div class="pav">${esc(iniciales(nombreSinTitulo))}</div>
            <div>
              <b>${esc(p.nombre_completo)}</b><br>
              <small>${esc(p.email || '')}</small>
              <div style="font-size:11px;color:var(--ink-soft);margin-top:2px">🗓️ ${dias}</div>
            </div>
          </div>
        </td>
        <td data-t="Especialidad">${esc(especialidad || '—')}</td>
        <td data-t="Matrícula">${esc(p.matricula || '—')}</td>
        <td data-t="Pacientes">${cantPacientes} asignados</td>
        <td data-t="Estado">${activo ? pill('ok', 'Activo') : pill('bad', 'Inactivo')}</td>
        <td class="tc-acciones">
          <button class="btn ghost btn-editar-prof destacado" data-id="${p.id}" style="padding:6px 12px">Editar</button>
          <button class="btn ghost btn-baja-prof${activo ? ' peligro' : ''}" data-id="${p.id}" data-estado="${esc(p.estado || '')}" data-nombre="${esc(p.nombre_completo)}" style="padding:6px 12px;color:${activo ? 'var(--red-600)' : 'var(--teal-700)'}">${activo ? 'Desactivar' : 'Activar'}</button>
        </td>
      </tr>`;
  }).join('');

  return `
    <div class="lista-toolbar">
      <input id="prof-buscar" type="search" autocomplete="off"
             placeholder="🔎 Buscar por nombre, email o especialidad…">
      <span class="lista-contador" id="prof-contador"></span>
    </div>
    <div class="tablewrap tabla-cards">
      <table>
        <thead>
          <tr><th>Profesional</th><th>Especialidad</th><th>Matrícula</th><th>Pacientes</th><th>Estado</th><th></th></tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
    <div class="state" id="prof-sin-resultados" hidden>Ningún profesional coincide con la búsqueda.</div>`;
}

// Formulario (modal) de alta/edición de profesional.
// `permiteCrearUsuario` = el que abre el form es director o secretaría:
// al crearlo, se le crea también su usuario de acceso automáticamente
// (solo tiene sentido al CREAR, no al editar uno ya existente).
// `sectores` = profesiones cargadas (pestaña "Profesiones"), para el
// desplegable que lo enlaza con su columna de la Grilla de atención.
export function renderFormProfesional(prof = {}, { permiteCrearUsuario = false, sectores = [] } = {}) {
  const v = (k) => esc(prof[k] ?? '');
  const esEdicion = !!prof.id;
  const ofrecerUsuario = !esEdicion && permiteCrearUsuario;
  const opcionesSector = sectores.map(s =>
    `<option value="${esc(s.clave)}" ${prof.sector === s.clave ? 'selected' : ''}>${esc(s.etiqueta)}</option>`).join('');
  // Obligatorio solo al CREAR (no se le exige de nuevo a uno ya cargado
  // que le falte algún dato, para no bloquearle una edición por eso).
  const req = esEdicion ? '' : 'required';
  const marca = esEdicion ? '' : ' *';
  return `
    <div class="overlay" id="overlay-prof">
      <div class="modal" style="max-width:580px">
        <div class="modal-h">
          <h2>${esEdicion ? 'Editar profesional' : 'Nuevo profesional'}</h2>
          <button class="x" data-cerrar>×</button>
        </div>
        <form id="form-prof">
          <div class="modal-b">
            <div class="form-grid">
              <div class="form-field full"><label>Nombre completo *</label><input name="nombre_completo" required value="${v('nombre_completo')}"></div>
              <div class="form-field"><label>DNI${marca}</label><input name="dni" ${req} value="${v('dni')}"></div>
              <div class="form-field"><label>Fecha de nacimiento${marca}</label><input type="date" name="fecha_nacimiento" ${req} value="${v('fecha_nacimiento')}"></div>
              <div class="form-field"><label>Matrícula <small style="color:var(--ink-faint);font-weight:400">(opcional)</small></label><input name="matricula" value="${v('matricula')}" placeholder="M.P. 1234"></div>
              <div class="form-field"><label>Profesión${marca} <small style="color:var(--ink-faint);font-weight:400">(título, libre)</small></label><input name="profesion" ${req} value="${v('profesion')}" placeholder="Psicología, Fonoaudiología…"></div>
              <div class="form-field"><label>Sector${marca} <small style="color:var(--ink-faint);font-weight:400">(columna de la grilla)</small></label>
                <select name="sector" ${req}>
                  <option value="" ${esEdicion ? '' : 'disabled'}>${esEdicion ? 'Sin asignar' : 'Elegí uno…'}</option>
                  ${opcionesSector}
                </select>
              </div>
              <div class="form-field"><label>Especialidad${marca}</label><input name="especialidad" ${req} value="${v('especialidad')}"></div>
              <div class="form-field"><label>Teléfono${marca}</label><input name="telefono" ${req} value="${v('telefono')}"></div>
              <div class="form-field"><label>Teléfono 2 <small style="color:var(--ink-faint);font-weight:400">(opcional)</small></label><input name="telefono2" value="${v('telefono2')}"></div>
              <div class="form-field full"><label>Email${marca}</label><input type="email" name="email" id="prof-email" ${req} value="${v('email')}"></div>
              ${ofrecerUsuario ? `
              <div class="form-field full" style="background:var(--teal-50);border:1px solid var(--teal-100);border-radius:10px;padding:12px 14px">
                <b>Le vamos a crear su usuario de acceso.</b>
                <br><small style="color:var(--ink-faint)">Apenas lo guardes, le mandamos un mail a ese email para que elija su propia contraseña. Necesita el email completo.</small>
              </div>` : ''}
              <div class="form-field full"><label>Dirección${marca}</label><input name="direccion" ${req} value="${v('direccion')}"></div>
              <div class="form-field full">
                <label>Turno *</label>
                <div style="display:flex;flex-wrap:wrap;gap:14px;margin-top:8px">
                  ${TURNOS_CENTRO.map(t => {
                    const checked = Array.isArray(prof.turnos_trabajo) && prof.turnos_trabajo.includes(t.clave) ? 'checked' : '';
                    return `
                      <label style="display:flex;align-items:center;gap:6px;font-weight:normal;cursor:pointer">
                        <input type="checkbox" name="turnos_trabajo" value="${t.clave}" ${checked} style="width:auto">
                        <span>${esc(t.etiqueta)} <small style="color:var(--ink-faint)">(${esc(rangoTurno(t))})</small></span>
                      </label>`;
                  }).join('')}
                </div>
                <small style="color:var(--ink-faint)">Si trabaja en los dos, tildá los dos: aparece en ambos turnos de la grilla.</small>
              </div>
              <div class="form-field full">
                <label>Días de trabajo${marca}</label>
                <div style="display:flex;flex-wrap:wrap;gap:14px;margin-top:8px">
                  ${['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(d => {
                    const checked = Array.isArray(prof.dias_trabajo) && prof.dias_trabajo.includes(d) ? 'checked' : '';
                    return `
                      <label style="display:flex;align-items:center;gap:6px;font-weight:normal;cursor:pointer">
                        <input type="checkbox" name="dias_trabajo" value="${d}" ${checked}> ${d}
                      </label>
                    `;
                  }).join('')}
                </div>
                <!-- Sin required nativo: en un grupo de checkboxes exigiría
                     tildar TODOS, no "al menos uno". Se valida en JS
                     (validarProfesional). -->
              </div>
              <!-- El campo estado (activo/inactivo) NO se pide acá: es estado
                   interno del sistema. El profesional nace activo y solo cambia
                   con "Desactivar" / "Activar" desde el listado. -->
            </div>
          </div>
          <div class="modal-f">
            <button type="button" class="btn ghost" data-cerrar>Cancelar</button>
            <button type="submit" class="btn" id="btn-guardar-prof">${esEdicion ? 'Guardar cambios' : 'Crear profesional'}</button>
          </div>
        </form>
      </div>
    </div>`;
}
