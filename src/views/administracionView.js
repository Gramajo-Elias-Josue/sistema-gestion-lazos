// =====================================================================
// VISTA: Administración / Usuarios (Etapa 2 · Fase B)
// ---------------------------------------------------------------------
// CAPA VISTA. Pantalla del director para gestionar usuarios: ver la lista,
// asignar rol y secciones (permisos) por usuario, y dar de alta uno nuevo.
// Funciones puras: devuelven HTML; el controlador conecta los eventos.
// =====================================================================

import { esc, pill } from '../utils/ui.js';
import { SECCIONES, seccionesEfectivas, etiquetaRol } from '../permisos.js';

// Secciones que el director puede TILDAR por usuario. "inicio" queda fuera
// (siempre está disponible) y "administracion" también (reservada al director).
const SECCIONES_ASIGNABLES = SECCIONES.filter(s => s.clave !== 'inicio' && s.clave !== 'administracion');

const ROLES = [
  { clave: 'secretaria',  etiqueta: 'Secretaría' },
  { clave: 'profesional', etiqueta: 'Profesional' },
  { clave: 'director',    etiqueta: 'Director' },
];

// Estructura base: encabezado + botón "Nuevo usuario" + tabla.
export function renderEstructura() {
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
      <p style="color:var(--ink-soft);font-size:15px">Gestión de usuarios del sistema. Asigná el rol y las secciones a las que accede cada uno. El director siempre tiene acceso total.</p>
      <button class="btn" id="btn-nuevo-usuario">+ Nuevo usuario</button>
    </div>
    <div id="usuarios-tabla"></div>`;
}

// Fila de checkboxes de secciones para un usuario (según sus permisos efectivos).
function checkboxesSecciones(usuario) {
  const efectivas = seccionesEfectivas(usuario);
  const esDirector = usuario.rol === 'director';
  return SECCIONES_ASIGNABLES.map(s => `
    <label style="display:inline-flex;align-items:center;gap:5px;font-weight:normal;font-size:13.5px;white-space:nowrap">
      <input type="checkbox" class="usr-sec" data-sec="${s.clave}"
        ${efectivas.includes(s.clave) ? 'checked' : ''} ${esDirector ? 'disabled' : ''}>
      ${esc(s.etiqueta)}
    </label>`).join('');
}

// Tabla de usuarios. Una fila por usuario con su rol (select) y secciones.
export function renderListaUsuarios(usuarios) {
  if (!usuarios.length) {
    return `<div class="tablewrap"><div class="state">No hay usuarios cargados.</div></div>`;
  }

  const filas = usuarios.map(u => {
    const esDirector = u.rol === 'director';
    const nombre = u.nombre || u.email || 'Usuario';
    const opcionesRol = ROLES.map(r =>
      `<option value="${r.clave}" ${r.clave === u.rol ? 'selected' : ''}>${r.etiqueta}</option>`).join('');

    return `
      <tr data-id="${esc(u.id)}">
        <td>
          <div class="pname">
            <div class="pav">${esc((nombre[0] || 'U').toUpperCase())}</div>
            <div><b>${esc(nombre)}</b><br><small>${esc(u.email || '')}</small></div>
          </div>
        </td>
        <td>
          <select class="usr-rol" ${esDirector ? 'disabled' : ''}
            style="font-family:var(--body);font-size:14px;padding:7px 9px;border:1px solid var(--line);border-radius:8px;background:var(--card-2);color:var(--ink)">${opcionesRol}</select>
        </td>
        <td>
          ${esDirector
            ? pill('ok', 'Acceso total')
            : `<div style="display:flex;flex-wrap:wrap;gap:8px 14px">${checkboxesSecciones(u)}</div>`}
        </td>
        <td style="text-align:right;white-space:nowrap">
          ${esDirector ? '' : `<button class="btn btn-guardar-usr" data-id="${esc(u.id)}" style="padding:7px 13px">Guardar</button>`}
        </td>
      </tr>`;
  }).join('');

  return `
    <div class="tablewrap">
      <table>
        <thead>
          <tr><th>Usuario</th><th>Rol</th><th>Secciones que puede ver</th><th></th></tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>`;
}

// Modal de alta de un usuario nuevo.
export function renderFormUsuario() {
  const opcionesRol = ROLES.filter(r => r.clave !== 'director')
    .map(r => `<option value="${r.clave}">${r.etiqueta}</option>`).join('');

  return `
    <div class="overlay" id="overlay-usuario">
      <div class="modal" style="max-width:460px">
        <div class="modal-h"><h2>Nuevo usuario</h2><button class="x" data-cerrar>×</button></div>
        <form id="form-usuario">
          <div class="modal-b">
            <div class="form-grid">
              <div class="form-field full"><label>Nombre</label><input name="nombre" placeholder="Ej: Ana Gómez"></div>
              <div class="form-field full"><label>Email *</label><input type="email" name="email" required placeholder="usuario@correo.com"></div>
              <div class="form-field full"><label>Contraseña *</label><input type="text" name="password" required minlength="6" placeholder="mínimo 6 caracteres"></div>
              <div class="form-field full"><label>Rol *</label>
                <select name="rol">${opcionesRol}</select>
              </div>
              <div class="form-field full">
                <small style="color:var(--ink-faint)">El usuario arranca con las secciones por defecto de su rol; después las ajustás desde la lista.</small>
              </div>
            </div>
          </div>
          <div class="modal-f">
            <button type="button" class="btn ghost" data-cerrar>Cancelar</button>
            <button type="submit" class="btn" id="btn-guardar-usuario">Crear usuario</button>
          </div>
        </form>
      </div>
    </div>`;
}
