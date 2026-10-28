// =====================================================================
// CONTROLADOR: Login (Etapa 2 · Fase A)
// ---------------------------------------------------------------------
// CAPA CONTROLADOR. Monta la pantalla de login en un contenedor, conecta
// el formulario y maneja el estado de carga y los errores. Al iniciar
// sesión con éxito, llama al callback `onExito` (app.js decide qué hacer:
// ocultar el login y arrancar la app).
// =====================================================================

import { renderLogin, renderPedirRecuperacion, renderNuevaContrasena } from '../views/loginView.js';
import { iniciarSesion, pedirRecuperacion, establecerContrasena } from '../auth.js';
import { conectarToggleTema } from '../tema.js';

// Traduce los errores típicos de Supabase Auth (vienen en inglés) a un
// mensaje claro en español. Si no se reconoce, se usa un texto genérico.
function mensajeAuth(error) {
  const m = (error?.message || '').toLowerCase();
  if (m.includes('invalid login credentials')) return 'Email o contraseña incorrectos.';
  if (m.includes('email not confirmed')) return 'Tu email todavía no está confirmado.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Demasiados intentos. Esperá un momento y probá de nuevo.';
  if (m.includes('network') || m.includes('fetch')) return 'No hay conexión con el servidor. Revisá tu internet.';
  return 'No se pudo iniciar sesión. Intentá de nuevo.';
}

// Monta el login en `contenedor` y conecta el formulario.
// `onExito(sesion)` se llama cuando el login es correcto.
export function montarLogin(contenedor, onExito) {
  contenedor.innerHTML = renderLogin();

  // El login tiene su propio toggle de tema (claro / oscuro).
  conectarToggleTema(document.getElementById('login-theme'));

  const form = document.getElementById('form-login');
  const cajaError = document.getElementById('login-error');
  const btn = document.getElementById('btn-login');

  const mostrarError = (texto) => {
    cajaError.textContent = texto;
    cajaError.hidden = false;
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    cajaError.hidden = true;

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
      mostrarError('Completá tu email y tu contraseña.');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Entrando…';
    try {
      const { data, error } = await iniciarSesion(email, password);
      if (error) {
        mostrarError(mensajeAuth(error));
        btn.disabled = false;
        btn.textContent = 'Acceder';
        return;
      }
      // Éxito: app.js se encarga de mostrar la app. No reactivamos el botón
      // porque el login está por desaparecer de la pantalla.
      onExito(data.session);
    } catch (err) {
      console.error('Error inesperado al iniciar sesión:', err);
      mostrarError(mensajeAuth(err));
      btn.disabled = false;
      btn.textContent = 'Acceder';
    }
  });

  document.getElementById('link-olvide').addEventListener('click', () => {
    montarPedirRecuperacion(contenedor, onExito);
  });
}

// ---------------------------------------------------------------------
// RECUPERAR CONTRASEÑA (paso 1): pide el email y manda el link
// ---------------------------------------------------------------------
function montarPedirRecuperacion(contenedor, onExito) {
  contenedor.innerHTML = renderPedirRecuperacion();
  conectarToggleTema(document.getElementById('login-theme'));

  document.getElementById('link-volver').addEventListener('click', () => montarLogin(contenedor, onExito));

  const form = document.getElementById('form-rec');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const cajaError = document.getElementById('rec-error');
    cajaError.hidden = true;

    const email = document.getElementById('rec-email').value.trim();
    if (!email) {
      cajaError.textContent = 'Completá tu email.';
      cajaError.hidden = false;
      return;
    }

    const btn = document.getElementById('btn-rec');
    btn.disabled = true;
    btn.textContent = 'Mandando…';
    try {
      const { error } = await pedirRecuperacion(email);
      // No se distingue "no existe" de "sí existe": si se avisara distinto,
      // cualquiera podría usar este form para saber qué emails están
      // registrados. Se muestra el mismo aviso siempre (salvo error real,
      // p. ej. de conexión).
      if (error && !/user not found/i.test(error.message || '')) {
        cajaError.textContent = mensajeAuth(error);
        cajaError.hidden = false;
        btn.disabled = false;
        btn.textContent = 'Mandar link';
        return;
      }
      contenedor.innerHTML = renderPedirRecuperacion({ enviado: true, email });
      conectarToggleTema(document.getElementById('login-theme'));
      document.getElementById('btn-volver-login').addEventListener('click', () => montarLogin(contenedor, onExito));
    } catch (err) {
      console.error('Error pidiendo la recuperación:', err);
      cajaError.textContent = mensajeAuth(err);
      cajaError.hidden = false;
      btn.disabled = false;
      btn.textContent = 'Mandar link';
    }
  });
}

// ---------------------------------------------------------------------
// RECUPERAR CONTRASEÑA (paso 2): elegir la nueva, al volver del mail
// ---------------------------------------------------------------------
// Se llama desde app.js cuando Supabase avisa 'PASSWORD_RECOVERY' (el
// usuario tocó el link del mail y ya tiene una sesión temporal para
// poder cambiar su contraseña). `onListo()` = app.js sigue como si
// hubiera iniciado sesión normal. `bienvenida` = es un usuario nuevo que
// llegó por el mail de bienvenida (cambia solo los textos).
export function montarNuevaContrasena(contenedor, onListo, { bienvenida = false } = {}) {
  contenedor.innerHTML = renderNuevaContrasena({ bienvenida });
  conectarToggleTema(document.getElementById('login-theme'));

  const form = document.getElementById('form-nueva-pass');
  const cajaError = document.getElementById('nueva-pass-error');
  const btn = document.getElementById('btn-nueva-pass');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    cajaError.hidden = true;

    const password = document.getElementById('nueva-pass').value;
    const password2 = document.getElementById('nueva-pass2').value;
    if (password.length < 6) {
      cajaError.textContent = 'La contraseña tiene que tener al menos 6 caracteres.';
      cajaError.hidden = false;
      return;
    }
    if (password !== password2) {
      cajaError.textContent = 'Las dos contraseñas no coinciden.';
      cajaError.hidden = false;
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Guardando…';
    try {
      const { error } = await establecerContrasena(password);
      if (error) {
        cajaError.textContent = mensajeAuth(error);
        cajaError.hidden = false;
        btn.disabled = false;
        btn.textContent = 'Guardar contraseña';
        return;
      }
      onListo();
    } catch (err) {
      console.error('Error guardando la contraseña nueva:', err);
      cajaError.textContent = mensajeAuth(err);
      cajaError.hidden = false;
      btn.disabled = false;
      btn.textContent = 'Guardar contraseña';
    }
  });
}
