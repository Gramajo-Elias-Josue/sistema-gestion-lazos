// =====================================================================
// APP: Punto de entrada
// ---------------------------------------------------------------------
// GUARD DE SESIÓN (Etapa 2 · Fase A):
//   - Sin sesión  -> se muestra la pantalla de login y NO se arranca la app.
//   - Con sesión  -> se arranca la app (router + controladores).
//   - Se escuchan los cambios de sesión (login / logout) para alternar
//     entre el login y la app sin recargar.
//
// Registra la función de arranque de cada controlador en el router y pone
// en marcha la navegación una vez autenticado.
// =====================================================================

import { iniciarRouter, registrarControlador } from './router.js';
import { iniciarSidebar } from './sidebar.js';
import { iniciarTema } from './tema.js';
import { obtenerSesion, cerrarSesion, alCambiarSesion } from './auth.js';
import { montarLogin } from './controllers/loginController.js';
import { iniciarInicio } from './controllers/inicioController.js';
import { iniciarAdmision } from './controllers/admisionController.js';
import { iniciarPacientes } from './controllers/pacientesController.js';
import { iniciarTurnos } from './controllers/turnosController.js';
import { iniciarAsistencia } from './controllers/asistenciaController.js';
import { iniciarProfesionales } from './controllers/profesionalesController.js';

// El tema (claro/oscuro) es independiente de la sesión: se aplica siempre.
iniciarTema();

// --- Elementos del shell ---
const appEl = document.querySelector('.app');

// Contenedor donde se monta el login (se crea una vez, fuera de .app).
let loginRoot = document.getElementById('login-root');
if (!loginRoot) {
  loginRoot = document.createElement('div');
  loginRoot.id = 'login-root';
  document.body.appendChild(loginRoot);
}

// Se arranca la parte "interna" de la app una sola vez, aunque la sesión
// cambie varias veces (p. ej. logout + login sin recargar).
let appIniciada = false;

// Conecta cada sección con su controlador (solo la primera vez).
function registrarControladores() {
  registrarControlador('inicio', iniciarInicio);
  registrarControlador('admision', iniciarAdmision);
  registrarControlador('pacientes', iniciarPacientes);
  registrarControlador('agenda', iniciarTurnos);
  registrarControlador('asistencia', iniciarAsistencia);
  registrarControlador('profesionales', iniciarProfesionales);
}

// Muestra la app y arranca la navegación (idempotente).
function arrancarApp(sesion) {
  loginRoot.innerHTML = '';
  appEl.classList.remove('hidden');
  mostrarUsuario(sesion);

  if (appIniciada) return;
  appIniciada = true;
  registrarControladores();
  iniciarSidebar();
  conectarLogout();
  iniciarRouter();
}

// Muestra la pantalla de login y oculta la app.
function mostrarLogin() {
  appEl.classList.add('hidden');
  montarLogin(loginRoot, (sesion) => arrancarApp(sesion));
}

// Escribe el email del usuario logueado en el encabezado.
function mostrarUsuario(sesion) {
  const email = sesion?.user?.email || '';
  const nombreEl = document.getElementById('who-nombre');
  const subEl = document.getElementById('who-sub');
  const avEl = document.getElementById('who-av');
  if (nombreEl) nombreEl.textContent = email || 'Usuario';
  if (subEl) subEl.textContent = 'Lazos';
  if (avEl) avEl.textContent = (email.slice(0, 2) || 'US').toUpperCase();
}

// Conecta el botón "Cerrar sesión" del encabezado (una sola vez).
function conectarLogout() {
  const btn = document.getElementById('btn-logout');
  if (btn) btn.addEventListener('click', () => cerrarSesion());
}

// --- Guard: al cargar, decidir login o app según la sesión ---
obtenerSesion().then((sesion) => {
  if (sesion) arrancarApp(sesion);
  else mostrarLogin();
});

// Mantener la UI en sincronía con la sesión: si se cierra (o expira),
// volver al login; si se inicia, entrar a la app.
alCambiarSesion((sesion) => {
  if (sesion) arrancarApp(sesion);
  else mostrarLogin();
});
