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
import { obtenerPerfil } from './perfil.js';
import { setPerfil, perfilActual, rolActual } from './sesion.js';
import { seccionesEfectivas, etiquetaRol } from './permisos.js';
import { montarLogin, montarNuevaContrasena } from './controllers/loginController.js';
import { abrirPerfil, pintarAvatar } from './controllers/perfilController.js';
import { conectarNotificaciones, cargarNotificaciones } from './controllers/notificacionesController.js';
import { iniciarInicio } from './controllers/inicioController.js';
import { iniciarAdmision } from './controllers/admisionController.js';
import { iniciarPacientes } from './controllers/pacientesController.js';
import { iniciarTurnos } from './controllers/turnosController.js';
import { iniciarAsistencia } from './controllers/asistenciaController.js';
import { iniciarProfesionales } from './controllers/profesionalesController.js';
import { iniciarGaleria } from './controllers/galeriaController.js';
import { iniciarConvenios } from './controllers/conveniosController.js';
import { iniciarFacturacion } from './controllers/facturacionController.js';
import { iniciarGastos } from './controllers/gastosController.js';
import { iniciarAdministracion } from './controllers/administracionController.js';

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
// Sesión vigente. Se guarda aparte porque los listeners se conectan una
// sola vez: si usaran la sesión del closure, tras un logout + login
// quedarían apuntando al usuario anterior.
let sesionActual = null;

// Conecta cada sección con su controlador (solo la primera vez).
function registrarControladores() {
  registrarControlador('inicio', iniciarInicio);
  registrarControlador('admision', iniciarAdmision);
  registrarControlador('pacientes', iniciarPacientes);
  registrarControlador('agenda', iniciarTurnos);
  registrarControlador('asistencia', iniciarAsistencia);
  registrarControlador('profesionales', iniciarProfesionales);
  registrarControlador('galeria', iniciarGaleria);
  registrarControlador('convenios', iniciarConvenios);
  registrarControlador('facturacion', iniciarFacturacion);
  registrarControlador('gastos', iniciarGastos);
  registrarControlador('administracion', iniciarAdministracion);
}

// Muestra la app y arranca la navegación (idempotente).
async function arrancarApp(sesion) {
  sesionActual = sesion;
  loginRoot.innerHTML = '';
  appEl.classList.remove('hidden');
  mostrarUsuario(sesion);

  // Cargar el perfil (rol) del usuario ANTES de arrancar el router, para
  // poder mostrar/ocultar las secciones según el rol desde el primer render.
  const perfil = await obtenerPerfil(sesion);
  setPerfil(perfil);
  aplicarPermisos(perfilActual());
  mostrarRol(rolActual());
  refrescarAvatar();
  cargarNotificaciones();

  if (appIniciada) return;
  appIniciada = true;
  registrarControladores();
  iniciarSidebar();
  conectarLogout();
  conectarPerfil();
  conectarNotificaciones();
  iniciarRouter();
}

// Pinta el avatar del usuario en el encabezado (predefinido, foto o iniciales).
function refrescarAvatar() {
  const email = sesionActual?.user?.email || '';
  const perfil = perfilActual();
  pintarAvatar(document.getElementById('who-av'), perfil, perfil?.nombre || email);
}

// Tocar los datos del usuario en el encabezado abre su perfil (avatar).
function conectarPerfil() {
  const btn = document.getElementById('btn-perfil');
  if (!btn) return;
  btn.addEventListener('click', () => {
    abrirPerfil(sesionActual?.user?.email || '', refrescarAvatar);
  });
}

// Muestra la pantalla de login y oculta la app. Limpia el perfil anterior.
function mostrarLogin() {
  setPerfil(null);
  appEl.classList.add('hidden');
  montarLogin(loginRoot, (sesion) => arrancarApp(sesion));
}

// Muestra la pantalla "elegí una contraseña nueva" (link del mail de
// recuperación) en vez de arrancar la app directo, aunque ya haya una
// sesión (temporal): no tendría sentido guardar la contraseña vieja de
// nuevo sin cambiarla primero.
function mostrarRecuperacion(sesion) {
  setPerfil(null);
  appEl.classList.add('hidden');
  montarNuevaContrasena(loginRoot, () => arrancarApp(sesion));
}

// Aplica los permisos del rol: oculta del menú las secciones que no puede
// ver y, si está parado en una sección no permitida, lo manda a Inicio.
function aplicarPermisos(perfil) {
  const permitidas = seccionesEfectivas(perfil);
  document.querySelectorAll('#nav button[data-v]').forEach(b => {
    // Se usa style.display inline (no la clase .hidden) porque el botón del
    // nav tiene su propio display por CSS con más especificidad, que le
    // ganaría a .hidden y no lo ocultaría.
    b.style.display = permitidas.includes(b.dataset.v) ? '' : 'none';
  });
  const actual = location.hash.slice(1);
  if (actual && !permitidas.includes(actual)) location.hash = 'inicio';
}

// Muestra el rol del usuario en el encabezado (debajo del email).
function mostrarRol(rol) {
  const subEl = document.getElementById('who-sub');
  if (subEl) subEl.textContent = etiquetaRol(rol);
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
// volver al login; si se inicia, entrar a la app. 'PASSWORD_RECOVERY' es
// el caso especial: el usuario tocó el link del mail de recuperación, así
// que en vez de entrar directo se le pide elegir la contraseña nueva.
alCambiarSesion((sesion, evento) => {
  if (evento === 'PASSWORD_RECOVERY') mostrarRecuperacion(sesion);
  else if (sesion) arrancarApp(sesion);
  else mostrarLogin();
});
