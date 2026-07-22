// =====================================================================
// VISTA: Profesionales
// ---------------------------------------------------------------------
// CAPA VISTA. Arma la tabla del equipo y el formulario de alta/edición.
// =====================================================================

import { iniciales } from '../utils/fechas.js';
import { esc, pill } from '../utils/ui.js';

// Estructura base: encabezado con botón "nuevo" + contenedor de la tabla.
export function renderEstructura() {
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
      <p style="color:var(--ink-soft);font-size:15px">Equipo interdisciplinario. Podés crear, editar o dar de baja un profesional.</p>
      <button class="btn" id="btn-nuevo-prof">+ Nuevo profesional</button>
    </div>
    <div id="prof-tabla"></div>`;
}

// Tabla del listado de profesionales.
export function renderTabla(profesionales) {
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

    return `
      <tr style="cursor:default">
        <td>
          <div class="pname">
            <div class="pav">${esc(iniciales(nombreSinTitulo))}</div>
            <div>
              <b>${esc(p.nombre_completo)}</b><br>
              <small>${esc(p.email || '')}</small>
              <div style="font-size:11px;color:var(--ink-soft);margin-top:2px">
                🗓️ ${p.dias_trabajo && p.dias_trabajo.length ? esc(p.dias_trabajo.map(d => d.slice(0, 3)).join(', ')) : 'Sin días asignados'}
              </div>
            </div>
          </div>
        </td>
        <td>${esc(p.especialidad || p.profesion || '—')}</td>
        <td>${esc(p.matricula || '—')}</td>
        <td>${cantPacientes} asignados</td>
        <td>${activo ? pill('ok', 'Activo') : pill('bad', 'Inactivo')}</td>
        <td style="white-space:nowrap;text-align:right">
          <button class="btn ghost btn-editar-prof" data-id="${p.id}" style="padding:6px 12px">Editar</button>
          <button class="btn ghost btn-baja-prof" data-id="${p.id}" data-estado="${esc(p.estado || '')}" data-nombre="${esc(p.nombre_completo)}" style="padding:6px 12px;color:${activo ? 'var(--red-600)' : 'var(--teal-700)'}">${activo ? 'Dar de baja' : 'Reactivar'}</button>
        </td>
      </tr>`;
  }).join('');

  return `
    <div class="tablewrap">
      <table>
        <thead>
          <tr><th>Profesional</th><th>Especialidad</th><th>Matrícula</th><th>Pacientes</th><th>Estado</th><th></th></tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>`;
}

// Formulario (modal) de alta/edición de profesional.
export function renderFormProfesional(prof = {}) {
  const v = (k) => esc(prof[k] ?? '');
  const esEdicion = !!prof.id;
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
              <div class="form-field"><label>DNI</label><input name="dni" value="${v('dni')}"></div>
              <div class="form-field"><label>Matrícula <small style="color:var(--ink-faint);font-weight:400">(opcional)</small></label><input name="matricula" value="${v('matricula')}" placeholder="M.P. 1234"></div>
              <div class="form-field"><label>Profesión</label><input name="profesion" value="${v('profesion')}" placeholder="Psicología, Fonoaudiología…"></div>
              <div class="form-field"><label>Especialidad</label><input name="especialidad" value="${v('especialidad')}"></div>
              <div class="form-field"><label>Teléfono</label><input name="telefono" value="${v('telefono')}"></div>
              <div class="form-field"><label>Teléfono 2</label><input name="telefono2" value="${v('telefono2')}"></div>
              <div class="form-field full"><label>Email</label><input type="email" name="email" value="${v('email')}"></div>
              <div class="form-field full"><label>Dirección</label><input name="direccion" value="${v('direccion')}"></div>
              <div class="form-field"><label>Horario de entrada</label><input type="time" name="horario_entrada" value="${v('horario_entrada')}"></div>
              <div class="form-field"><label>Horario de salida</label><input type="time" name="horario_salida" value="${v('horario_salida')}"></div>
              <div class="form-field full">
                <label>Días de trabajo</label>
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
              </div>
              <!-- El campo estado (activo/inactivo) NO se pide acá: es estado
                   interno del sistema. El profesional nace activo y solo cambia
                   con "Dar de baja" / "Reactivar" desde el listado. -->
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
