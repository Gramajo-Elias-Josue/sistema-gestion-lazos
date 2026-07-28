// =====================================================================
// VISTA: Administración / Usuarios (Etapa 2 · Fase B)
// ---------------------------------------------------------------------
// CAPA VISTA. Pantalla del director para gestionar usuarios: ver la lista,
// dar de alta uno nuevo y asignarle rol y secciones (permisos) desde un
// panel dedicado. Funciones puras: devuelven HTML; el controlador conecta
// los eventos.
//
// El rol DIRECTOR no se asigna desde la app (se define en la base): es el
// dueño del sistema y tiene acceso total no editable.
// =====================================================================

import { esc, pill } from '../utils/ui.js';
import { SECCIONES, seccionesEfectivas, seccionesPorDefecto, etiquetaRol } from '../permisos.js';

// Secciones que el director puede TILDAR por usuario. "inicio" queda fuera
// (siempre está disponible) y "administracion" también (sólo el director).
const SECCIONES_ASIGNABLES = SECCIONES.filter(s => s.clave !== 'inicio' && s.clave !== 'administracion');

// Roles asignables desde la app (director NO: se define en la base).
const ROLES_ASIGNABLES = [
  { clave: 'secretaria',  etiqueta: 'Secretaría' },
  { clave: 'profesional', etiqueta: 'Profesional' },
];

// Etiqueta legible de una sección.
function etiquetaSeccion(clave) {
  return SECCIONES.find(s => s.clave === clave)?.etiqueta || clave;
}

// Estructura base: encabezado + botón "Nuevo usuario" + tabla.
export function renderEstructura() {
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:18px">
      <p style="color:var(--ink-soft);font-size:15px">Gestión de usuarios del sistema. Asigná el rol y las secciones a las que accede cada uno. El director siempre tiene acceso total.</p>
      <button class="btn" id="btn-nuevo-usuario" style="white-space:nowrap">+ Nuevo usuario</button>
    </div>
    <div id="usuarios-tabla"></div>`;
}

// Resumen de las secciones de un usuario, como chips (solo lectura).
function resumenSecciones(usuario) {
  const efectivas = seccionesEfectivas(usuario)
    .filter(c => c !== 'inicio' && c !== 'administracion');
  if (!efectivas.length) return `<small style="color:var(--ink-faint)">Solo Inicio</small>`;
  return `<div style="display:flex;flex-wrap:wrap;gap:6px">` +
    efectivas.map(c => `<span class="pill">${esc(etiquetaSeccion(c))}</span>`).join('') +
    `</div>`;
}

// Tabla de usuarios. Una fila por usuario con su rol, sus secciones y el
// botón para abrir el panel de permisos.
export function renderListaUsuarios(usuarios) {
  if (!usuarios.length) {
    return `<div class="tablewrap"><div class="state">No hay usuarios cargados.</div></div>`;
  }

  const filas = usuarios.map(u => {
    const esDirector = u.rol === 'director';
    const nombre = u.nombre || u.email || 'Usuario';

    return `
      <tr data-id="${esc(u.id)}">
        <td>
          <div class="pname">
            <div class="pav">${esc((nombre[0] || 'U').toUpperCase())}</div>
            <div><b>${esc(nombre)}</b><br><small>${esc(u.email || '')}</small></div>
          </div>
        </td>
        <td>${esDirector ? pill('ok', 'Director') : esc(etiquetaRol(u.rol))}</td>
        <td>${esDirector ? pill('ok', 'Acceso total') : resumenSecciones(u)}</td>
        <td style="text-align:right;white-space:nowrap">
          ${esDirector
            ? '<small style="color:var(--ink-faint)">No editable</small>'
            : `<button class="btn ghost btn-permisos" data-id="${esc(u.id)}" style="padding:7px 13px">Permisos</button>`}
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

// Panel de PERMISOS de un usuario: rol + checkboxes de secciones.
// Se abre al crear un usuario y al tocar "Permisos" en la lista.
export function renderModalPermisos(usuario) {
  const nombre = usuario.nombre || usuario.email || 'Usuario';
  const efectivas = seccionesEfectivas(usuario);

  const opcionesRol = ROLES_ASIGNABLES.map(r =>
    `<option value="${r.clave}" ${r.clave === usuario.rol ? 'selected' : ''}>${r.etiqueta}</option>`).join('');

  // Cada sección como una tarjeta clickeable (más cómoda que un checkbox suelto).
  const items = SECCIONES_ASIGNABLES.map(s => `
    <label class="perm-item">
      <input type="checkbox" class="usr-sec" data-sec="${s.clave}" ${efectivas.includes(s.clave) ? 'checked' : ''}>
      <span>${esc(s.etiqueta)}</span>
    </label>`).join('');

  return `
    <div class="overlay" id="overlay-permisos">
      <div class="modal" style="max-width:520px">
        <div class="modal-h">
          <h2>Permisos · ${esc(nombre)}</h2>
          <button class="x" data-cerrar>×</button>
        </div>
        <form id="form-permisos" data-id="${esc(usuario.id)}">
          <div class="modal-b">
            <div class="form-field full" style="margin-bottom:14px">
              <label>Rol</label>
              <select name="rol" id="perm-rol">${opcionesRol}</select>
              <small style="color:var(--ink-faint)">Al cambiar el rol se marcan sus secciones por defecto; después podés ajustarlas.</small>
            </div>

            <div class="form-field full">
              <label>Secciones que puede ver</label>
              <div class="perm-grid" id="perm-secciones">${items}</div>
              <small style="color:var(--ink-faint)">“Inicio” está siempre disponible. “Administración” es exclusiva del director.</small>
            </div>
          </div>
          <div class="modal-f">
            <button type="button" class="btn ghost" data-cerrar>Cancelar</button>
            <button type="submit" class="btn" id="btn-guardar-permisos">Guardar permisos</button>
          </div>
        </form>
      </div>
    </div>`;
}

// Marca en el panel las secciones por defecto de un rol (lo usa el
// controlador cuando se cambia el rol en el select).
export function seccionesDefaultDeRol(rol) {
  return seccionesPorDefecto(rol);
}

// Modal de alta de un usuario nuevo (cuenta + rol inicial).
export function renderFormUsuario() {
  const opcionesRol = ROLES_ASIGNABLES.map(r =>
    `<option value="${r.clave}">${r.etiqueta}</option>`).join('');

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
                <small style="color:var(--ink-faint)">Al crearlo se abre el panel de permisos para ajustar sus secciones.</small>
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
