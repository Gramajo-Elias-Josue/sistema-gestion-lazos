// =====================================================================
// VISTA: Mi perfil (avatar)
// ---------------------------------------------------------------------
// CAPA VISTA. Panel donde el usuario elige su avatar: uno de los
// predefinidos o una foto propia. Función pura: devuelve HTML; el
// controlador conecta los eventos.
// =====================================================================

import { esc } from '../utils/ui.js';
import { etiquetaRol } from '../permisos.js';
import { AVATARES, parseAvatar } from '../utils/avatar.js';

// Panel de perfil. `perfil` = fila de `perfiles` del usuario logueado;
// `email` = su email (viene de la sesión).
export function renderPerfil(perfil = {}, email = '') {
  const actual = parseAvatar(perfil.avatar);
  const nombre = perfil.nombre || email || 'Usuario';

  // Avatares disponibles (archivos de src/assets/avatares/). Si todavía no
  // hay ninguno, se avisa en vez de mostrar un hueco vacío.
  // Sin "title": no se quiere el tooltip nativo del navegador al pasar el
  // mouse (queda el aria-label para lectores de pantalla, que no se ve).
  const opciones = AVATARES.length
    ? AVATARES.map(a => `
        <button type="button" class="av-opcion ${actual.tipo === 'preset' && actual.preset.clave === a.clave ? 'sel' : ''}"
          data-avatar="${esc(a.clave)}" aria-label="${esc(a.nombre)}">
          <img src="${esc(a.url)}" alt="">
        </button>`).join('')
    : `<small style="color:var(--ink-faint)">Todavía no hay avatares cargados. Se agregan poniendo los archivos en <code>src/assets/avatares/</code>.</small>`;

  return `
    <div class="overlay" id="overlay-perfil">
      <div class="modal" style="max-width:480px">
        <div class="modal-h">
          <h2>Mi perfil</h2>
          <button class="x" data-cerrar>×</button>
        </div>

        <div class="modal-b">
          <!-- Vista previa + datos del usuario -->
          <div class="perfil-cab">
            <div class="perfil-av" id="perfil-preview"></div>
            <div>
              <b>${esc(nombre)}</b>
              <small>${esc(email)}</small>
              <small>${esc(etiquetaRol(perfil.rol))}</small>
            </div>
          </div>

          <div class="form-field full">
            <label>Elegí un avatar</label>
            <div class="av-grid" id="av-opciones">${opciones}</div>
          </div>

          <div class="form-field full" style="margin-top:6px">
            <label>…o subí una foto</label>
            <input type="file" id="perfil-foto" accept="image/*">
            <small style="color:var(--ink-faint)">Imagen cuadrada, hasta 2 MB. Se guarda en tu carpeta privada.</small>
          </div>

          <p class="login-error" id="perfil-error" role="alert" hidden></p>
        </div>

        <div class="modal-f">
          <button type="button" class="btn ghost" id="btn-quitar-avatar">Usar mis iniciales</button>
          <button type="button" class="btn ghost" data-cerrar>Cancelar</button>
          <button type="button" class="btn" id="btn-guardar-perfil">Guardar</button>
        </div>
      </div>
    </div>`;
}
