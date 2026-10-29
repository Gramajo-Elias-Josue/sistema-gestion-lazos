// =====================================================================
// VISTA: Administración / Usuarios (Etapa 2 · Fase B)
// ---------------------------------------------------------------------
// CAPA VISTA. Pantalla del director para gestionar usuarios: ver la lista,
// dar de alta uno nuevo y asignarle rol y secciones (permisos) desde un
// panel dedicado. Funciones puras: devuelven HTML; el controlador conecta
// los eventos.
//
// El centro es una SOCIEDAD (varios socios), no un solo dueño: se puede
// crear más de un usuario Director desde "Nuevo usuario". Un director NO
// se edita después desde acá — acceso total, no recortable, no se le
// puede bajar el rol por la app (a propósito: nadie puede "des-socio" a
// otro con un clic; eso se hace a mano en la base si hace falta).
// =====================================================================

import { esc, pill } from '../utils/ui.js';
import { linkMapa } from '../utils/ubicacion.js';
import { SECCIONES, seccionesEfectivas, seccionesPorDefecto, etiquetaRol } from '../permisos.js';

// Secciones que el director puede TILDAR por usuario. "inicio" queda fuera
// (siempre está disponible) y "administracion" también (sólo el director).
const SECCIONES_ASIGNABLES = SECCIONES.filter(s => s.clave !== 'inicio' && s.clave !== 'administracion');

// Roles asignables al EDITAR un usuario existente. Director no está: un
// director no se toca desde acá (ver nota arriba).
const ROLES_ASIGNABLES = [
  { clave: 'secretaria',  etiqueta: 'Secretaría' },
  { clave: 'profesional', etiqueta: 'Profesional' },
  // Community manager: entra solo a la galería, a buscar material para
  // el contenido. No ve pacientes ni nada clínico.
  { clave: 'cm',          etiqueta: 'Contenido (CM)' },
];

// Roles elegibles al CREAR un usuario nuevo: los de arriba + Director,
// para sumar otro socio con acceso total.
const ROLES_ALTA = [
  { clave: 'director', etiqueta: 'Director (socio)' },
  ...ROLES_ASIGNABLES,
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
    <div id="usuarios-tabla"></div>
    <div id="adm-ubicacion" style="margin-top:22px"></div>`;
}

// Panel "Ubicación del centro": desde dónde se permite el fichaje por
// ubicación de los profesionales. `conf` = { latitud, longitud, radio_m }.
// Para cargarla, lo más cómodo es estar en el centro y tocar "Usar mi
// ubicación actual"; también se pueden pegar las coordenadas de Maps.
export function renderUbicacionCentro(conf = {}) {
  const val = (v) => (v === null || v === undefined) ? '' : esc(String(v));
  const cargada = conf.latitud != null && conf.longitud != null;
  return `
    <form class="panel" id="form-ubicacion">
      <div class="panel-h">
        <h2>Ubicación del centro</h2>
        <span class="cnt">fichaje de profesionales</span>
      </div>
      <div class="panel-b" style="padding:16px 18px">
        <p style="color:var(--ink-soft);margin-bottom:14px">
          Los profesionales fichan su entrada y salida desde el celular, solo si están
          dentro del radio de este punto.
          ${cargada ? '' : '<b>Todavía no está cargada: hasta entonces nadie puede fichar por ubicación.</b>'}
        </p>
        <div class="form-grid">
          <div class="form-field"><label>Latitud</label>
            <input name="latitud" id="ubi-lat" inputmode="decimal" value="${val(conf.latitud)}" placeholder="Ej: -27.4321"></div>
          <div class="form-field"><label>Longitud</label>
            <input name="longitud" id="ubi-lng" inputmode="decimal" value="${val(conf.longitud)}" placeholder="Ej: -65.6123"></div>
          <div class="form-field"><label>Radio permitido (metros)</label>
            <input name="radio" type="number" min="20" max="2000" step="1" value="${val(conf.radio_m ?? 100)}"></div>
        </div>
        <small id="ubi-precision" style="display:block;color:var(--ink-faint);margin-top:8px">
          Dentro de un edificio el GPS puede errar 30 a 80 m: por eso conviene un radio de 100 m o más.
        </small>
        <div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end;margin-top:14px">
          <button type="button" class="btn ghost" id="btn-ubi-actual">📍 Usar mi ubicación actual</button>
          ${cargada ? `<a class="btn ghost" id="lnk-ubi-mapa" href="${esc(linkMapa(conf.latitud, conf.longitud))}" target="_blank" rel="noopener">Ver en el mapa</a>` : ''}
          <button type="submit" class="btn" id="btn-ubi-guardar">Guardar ubicación</button>
        </div>
      </div>
    </form>`;
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
  const opcionesRol = ROLES_ALTA.map(r =>
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
              <div class="form-field full"><label>Rol *</label>
                <select name="rol">${opcionesRol}</select>
              </div>
              <div class="form-field full">
                <small style="color:var(--ink-faint)">Le llega un mail de bienvenida a ese email para que elija su propia contraseña. Al crearlo se abre el panel de permisos para ajustar sus secciones.</small>
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
