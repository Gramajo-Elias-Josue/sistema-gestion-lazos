// =====================================================================
// CONTROLADOR: Login (Etapa 2 · Fase A)
// ---------------------------------------------------------------------
// CAPA CONTROLADOR. Monta la pantalla de login en un contenedor, conecta
// el formulario y maneja el estado de carga y los errores. Al iniciar
// sesión con éxito, llama al callback `onExito` (app.js decide qué hacer:
// ocultar el login y arrancar la app).
// =====================================================================

import { renderLogin } from '../views/loginView.js';
import { iniciarSesion } from '../auth.js';

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
        btn.textContent = 'Entrar';
        return;
      }
      // Éxito: app.js se encarga de mostrar la app. No reactivamos el botón
      // porque el login está por desaparecer de la pantalla.
      onExito(data.session);
    } catch (err) {
      console.error('Error inesperado al iniciar sesión:', err);
      mostrarError(mensajeAuth(err));
      btn.disabled = false;
      btn.textContent = 'Entrar';
    }
  });
}
