// =====================================================================
// ROUTER: Navegación entre secciones
// ---------------------------------------------------------------------
// Maneja la navegación sin recargar la página usando el hash de la URL
// (#inicio, #pacientes, …). Así se puede recargar o compartir un enlace
// directo a una sección. Por cada sección guarda su título, su subtítulo
// y la función de arranque de su controlador.
// =====================================================================

import { fechaLarga } from './utils/fechas.js';
import { perfilActual, rolActual } from './sesion.js';
import { puedeVer, seccionInicial } from './permisos.js';

// Metadatos de cada sección. `iniciar` se completa con registrarControlador().
const SECCIONES = {
  // El Inicio del profesional es "Mi día" (su grilla), no el panel de la dirección.
  inicio:        { titulo: () => rolActual() === 'profesional' ? 'Mi día' : 'Panel de Dirección', sub: () => fechaLarga(), iniciar: null },
  fichaje:       { titulo: 'Mi fichaje',          sub: () => fechaLarga(),                    iniciar: null },
  admision:      { titulo: 'Admisión',            sub: () => 'Ingreso y documentación',       iniciar: null },
  pacientes:     { titulo: 'Pacientes',           sub: () => 'Legajos y documentación',       iniciar: null },
  agenda:        { titulo: 'Turnos',              sub: () => 'Pacientes casuales (sin legajo)', iniciar: null },
  asistencia:    { titulo: 'Asistencia del día',  sub: () => 'Registro diario de concurrencia', iniciar: null },
  profesionales: { titulo: 'Profesionales',       sub: () => 'Equipo interdisciplinario',     iniciar: null },
  galeria:       { titulo: 'Galería',             sub: () => 'Fotos del trabajo del mes',     iniciar: null },
  convenios:     { titulo: 'Convenios',           sub: () => 'Obras sociales',                iniciar: null },
  facturacion:   { titulo: 'Facturación',         sub: () => 'Control de facturación y cobros', iniciar: null },
  gastos:        { titulo: 'Gastos',              sub: () => 'Rendición de cuentas',          iniciar: null },
  estadisticas:  { titulo: 'Estadísticas',        sub: () => 'Indicadores del centro',        iniciar: null },
  administracion:{ titulo: 'Administración',       sub: () => 'Usuarios y permisos',           iniciar: null },
};

// Registra la función de arranque del controlador de una sección.
// La llama app.js al inicializar.
export function registrarControlador(nombre, fn) {
  if (SECCIONES[nombre]) SECCIONES[nombre].iniciar = fn;
}

// Muestra una sección y dispara su controlador.
async function mostrar(nombre) {
  // Hash inválido, o una sección que el usuario no puede ver (aunque haya
  // forzado el hash): se lo manda a su sección inicial (Inicio, o Galería
  // para el CM, que no tiene Inicio).
  if (!SECCIONES[nombre] || !puedeVer(perfilActual(), nombre)) nombre = seccionInicial(perfilActual());

  // Resalta el botón activo en la barra lateral.
  document.querySelectorAll('#nav button[data-v]').forEach(b =>
    b.classList.toggle('active', b.dataset.v === nombre));

  // Muestra solo la sección elegida.
  document.querySelectorAll('.view').forEach(s => s.classList.add('hidden'));
  const sec = document.getElementById('v-' + nombre);
  sec.classList.remove('hidden');

  // Reinicia la animación de entrada de la sección.
  sec.style.animation = 'none';
  void sec.offsetWidth;
  sec.style.animation = '';

  // Actualiza el encabezado.
  const meta = SECCIONES[nombre];
  document.getElementById('ttl').textContent = typeof meta.titulo === 'function' ? meta.titulo() : meta.titulo;
  document.getElementById('sub').textContent = meta.sub();

  // Arranca el controlador de la sección (si está registrado).
  if (typeof meta.iniciar === 'function') await meta.iniciar();
}

// Inicializa el router: escucha clicks del nav y cambios del hash.
export function iniciarRouter() {
  // Click en un botón del nav -> cambia el hash (dispara 'hashchange').
  document.getElementById('nav').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-v]');
    if (!b) return;
    location.hash = b.dataset.v;
  });

  // Cambio de hash -> muestra la sección correspondiente.
  window.addEventListener('hashchange', () => mostrar(location.hash.slice(1)));

  // Sección inicial (según el hash actual o la de entrada del usuario).
  mostrar(location.hash.slice(1) || seccionInicial(perfilActual()));
}
