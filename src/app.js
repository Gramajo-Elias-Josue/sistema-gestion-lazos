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
import { obtenerSesion, cerrarSesion, alCambiarSesion, debeElegirContrasena } from './auth.js';
import { obtenerPerfil } from './perfil.js';
import { setPerfil, perfilActual, rolActual } from './sesion.js';
import { seccionesEfectivas, seccionInicial, etiquetaRol } from './permisos.js';
import { montarLogin, montarNuevaContrasena, montarLinkDelMail } from './controllers/loginController.js';
import { leerLinkDelMail } from './utils/linkMail.js';
import { abrirPerfil, pintarAvatar } from './controllers/perfilController.js';
import { conectarNotificaciones, cargarNotificaciones } from './controllers/notificacionesController.js';
import { iniciarInicio } from './controllers/inicioController.js';
import { iniciarFichaje } from './controllers/fichajeController.js';
import { iniciarAdmision } from './controllers/admisionController.js';
import { iniciarPacientes } from './controllers/pacientesController.js';
import { iniciarTurnos } from './controllers/turnosController.js';
import { iniciarAsistencia } from './controllers/asistenciaController.js';
import { iniciarProfesionales } from './controllers/profesionalesController.js';
import { iniciarGaleria } from './controllers/galeriaController.js';
import { iniciarConvenios } from './controllers/conveniosController.js';
import { iniciarFacturacion } from './controllers/facturacionController.js';
import { iniciarGastos } from './controllers/gastosController.js';
import { iniciarEstadisticas } from './controllers/estadisticasController.js';
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
  registrarControlador('fichaje', iniciarFichaje);
  registrarControlador('admision', iniciarAdmision);
  registrarControlador('pacientes', iniciarPacientes);
  registrarControlador('agenda', iniciarTurnos);
  registrarControlador('asistencia', iniciarAsistencia);
  registrarControlador('profesionales', iniciarProfesionales);
  registrarControlador('galeria', iniciarGaleria);
  registrarControlador('convenios', iniciarConvenios);
  registrarControlador('facturacion', iniciarFacturacion);
  registrarControlador('gastos', iniciarGastos);
  registrarControlador('estadisticas', iniciarEstadisticas);
  registrarControlador('administracion', iniciarAdministracion);
}

// Muestra la app y arranca la navegación (idempotente). Un usuario recién
// invitado que todavía no eligió su contraseña ve antes la bienvenida.
async function arrancarApp(sesion) {
  if (debeElegirContrasena(sesion)) return mostrarBienvenida(sesion);
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
// Al terminar se pide la sesión de nuevo: la de antes todavía tiene la
// marca de "elegir contraseña" que establecerContrasena acaba de apagar.
function mostrarRecuperacion(sesion) {
  setPerfil(null);
  appEl.classList.add('hidden');
  montarNuevaContrasena(loginRoot, async () => arrancarApp(await obtenerSesion() || sesion));
}

// Pantalla del botón de un mail (ver utils/linkMail.js). Cuando el link
// sirve, sigue como si Supabase hubiera avisado la sesión: recuperar →
// contraseña nueva; bienvenida → arrancarApp, que muestra la bienvenida.
function mostrarLinkDelMail(link) {
  setPerfil(null);
  appEl.classList.add('hidden');
  const salir = async () => {
    esperandoLink = false;
    const sesion = await obtenerSesion();
    if (sesion) arrancarApp(sesion);
    else mostrarLogin();
  };
  montarLinkDelMail(loginRoot, link, {
    onListo: (sesion, tipo) => {
      esperandoLink = false;
      if (tipo === 'recovery') mostrarRecuperacion(sesion);
      else arrancarApp(sesion);
    },
    onVolver: salir,
    onExito: (sesion) => { esperandoLink = false; arrancarApp(sesion); },
  });
}

// Bienvenida de un usuario nuevo: llegó por el link del mail de
// bienvenida y todavía no tiene contraseña propia. Es la misma pantalla
// de "elegir contraseña", con el texto de primer ingreso. Si ya está
// abierta no se vuelve a pintar (Supabase avisa varias veces de la
// sesión y se borraría lo que la persona está escribiendo).
function mostrarBienvenida(sesion) {
  if (document.getElementById('form-nueva-pass')) return;
  setPerfil(null);
  appEl.classList.add('hidden');
  montarNuevaContrasena(loginRoot, async () => arrancarApp(await obtenerSesion() || sesion), { bienvenida: true });
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
  if (actual && !permitidas.includes(actual)) location.hash = seccionInicial(perfil);
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
// Si la página se abrió desde el botón de un mail (bienvenida o recuperar
// contraseña), primero va la pantalla de ese link, aunque ya hubiera otra
// sesión abierta en este navegador. Mientras esté, `esperandoLink` hace
// que los avisos de sesión de abajo no la tapen.
const linkDelMail = leerLinkDelMail(window.location.search, window.location.hash);
let esperandoLink = !!linkDelMail;
if (linkDelMail) {
  // Se saca el código (o el error) de la dirección: no queda en el
  // historial y el router no lo confunde con una sección.
  history.replaceState(null, '', window.location.pathname);
  mostrarLinkDelMail(linkDelMail);
} else {
  obtenerSesion().then((sesion) => {
    if (sesion) arrancarApp(sesion);
    else mostrarLogin();
  });
}

// Mantener la UI en sincronía con la sesión: si se cierra (o expira),
// volver al login; si se inicia, entrar a la app. 'PASSWORD_RECOVERY' es
// el caso especial: el usuario tocó el link del mail de recuperación, así
// que en vez de entrar directo se le pide elegir la contraseña nueva.
alCambiarSesion((sesion, evento) => {
  if (esperandoLink) return;
  if (evento === 'PASSWORD_RECOVERY') mostrarRecuperacion(sesion);
  else if (sesion) arrancarApp(sesion);
  else mostrarLogin();
});
