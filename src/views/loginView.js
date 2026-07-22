// =====================================================================
// VISTA: Login (Etapa 2 · Fase A)
// ---------------------------------------------------------------------
// CAPA VISTA. Arma el HTML de la pantalla de inicio de sesión. Es una
// función PURA (devuelve un string, sin tocar el DOM ni la base), así se
// puede testear igual que el resto de las vistas.
//
// Diseño: pantalla partida en DOS paneles —a la izquierda la MARCA (logo
// Lazos sobre el degradé de la casa), a la derecha el FORMULARIO—, con un
// botón para cambiar entre modo claro y oscuro desde el propio login.
// En pantallas angostas los paneles se apilan.
// =====================================================================

import { esc } from '../utils/ui.js';
import { CLINICA } from '../config/clinica.js';

// Iconos sol/luna del toggle de tema (mismos que el encabezado; el CSS
// muestra uno u otro según el tema activo).
const ICONOS_TEMA = `
  <svg class="ic-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
  <svg class="ic-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`;

// Pantalla completa de login. Ocupa toda la ventana (overlay) hasta que
// el usuario inicia sesión. El controlador conecta el formulario y el
// botón de tema.
export function renderLogin() {
  return `
    <div class="login-wrap">
      <div class="login-split">

        <!-- Panel de MARCA (izquierda): logo + nombre sobre el degradé. -->
        <aside class="login-side">
          <div class="login-logo">
            <img src="${esc(CLINICA.logo)}" alt="${esc(CLINICA.nombre)}"
                 onerror="this.replaceWith(document.createTextNode('Lz'))">
          </div>
          <h2 class="login-side-name">${esc(CLINICA.nombre)}</h2>
          <p class="login-side-sub">${esc(CLINICA.subtitulo)}</p>
        </aside>

        <!-- Panel de FORMULARIO (derecha). -->
        <div class="login-main">
          <!-- Toggle de tema (claro / oscuro) del propio login. -->
          <button class="theme-toggle login-theme" id="login-theme" type="button"
                  title="Cambiar a modo oscuro" aria-label="Cambiar a modo oscuro">${ICONOS_TEMA}</button>

          <form class="login-form" id="form-login" autocomplete="on">
            <h1 class="login-title">Iniciar sesión</h1>
            <p class="login-sub">Ingresá con tu cuenta para acceder al sistema.</p>

            <label class="login-field">
              <span>Email</span>
              <input type="email" name="email" id="login-email" required autocomplete="username"
                     placeholder="tu@correo.com" autofocus>
            </label>

            <label class="login-field">
              <span>Contraseña</span>
              <input type="password" name="password" id="login-password" required
                     autocomplete="current-password" placeholder="••••••••">
            </label>

            <!-- Mensaje de error (oculto hasta que haga falta). -->
            <p class="login-error" id="login-error" role="alert" hidden></p>

            <button type="submit" class="btn login-btn" id="btn-login">Acceder</button>
          </form>
        </div>

      </div>
    </div>`;
}
