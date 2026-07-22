// =====================================================================
// VISTA: Login (Etapa 2 · Fase A)
// ---------------------------------------------------------------------
// CAPA VISTA. Arma el HTML de la pantalla de inicio de sesión. Es una
// función PURA (devuelve un string, sin tocar el DOM ni la base), así se
// puede testear igual que el resto de las vistas.
// =====================================================================

import { esc } from '../utils/ui.js';
import { CLINICA } from '../config/clinica.js';

// Pantalla completa de login. Ocupa toda la ventana (overlay) hasta que
// el usuario inicia sesión. El controlador conecta el formulario.
export function renderLogin() {
  return `
    <div class="login-wrap">
      <form class="login-card" id="form-login" autocomplete="on">
        <div class="login-brand">
          <div class="login-logo">
            <img src="${esc(CLINICA.logo)}" alt="${esc(CLINICA.nombre)}"
                 onerror="this.replaceWith(document.createTextNode('Lz'))">
          </div>
          <div>
            <b>${esc(CLINICA.nombre)}</b>
            <small>${esc(CLINICA.subtitulo)}</small>
          </div>
        </div>

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

        <button type="submit" class="btn login-btn" id="btn-login">Entrar</button>
      </form>
    </div>`;
}
