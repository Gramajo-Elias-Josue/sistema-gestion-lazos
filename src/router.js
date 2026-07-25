// =====================================================================
// ROUTER: Navegación entre secciones
// ---------------------------------------------------------------------
// Maneja la navegación sin recargar la página usando el hash de la URL
// (#inicio, #pacientes, …). Así se puede recargar o compartir un enlace
// directo a una sección. Por cada sección guarda su título, su subtítulo
// y la función de arranque de su controlador.
// =====================================================================

import { fechaLarga } from './utils/fechas.js';
import { perfilActual } from './sesion.js';
import { puedeVer } from './permisos.js';

// Metadatos de cada sección. `iniciar` se completa con registrarControlador().
const SECCIONES = {
  inicio:        { titulo: 'Panel de Dirección',  sub: () => fechaLarga(),                    iniciar: null },
  admision:      { titulo: 'Admisión',            sub: () => 'Ingreso y documentación',       iniciar: null },
  pacientes:     { titulo: 'Pacientes',           sub: () => 'Legajos y documentación',       iniciar: null },
  agenda:        { titulo: 'Turnos',              sub: () => 'Turnos paciente · profesional', iniciar: null },
  asistencia:    { titulo: 'Asistencia del día',  sub: () => 'Registro diario de concurrencia', iniciar: null },
  profesionales: { titulo: 'Profesionales',       sub: () => 'Equipo interdisciplinario',     iniciar: null },
};

// Registra la función de arranque del controlador de una sección.
// La llama app.js al inicializar.
export function registrarControlador(nombre, fn) {
  if (SECCIONES[nombre]) SECCIONES[nombre].iniciar = fn;
}

// Muestra una sección y dispara su controlador.
async function mostrar(nombre) {
  if (!SECCIONES[nombre]) nombre = 'inicio'; // fallback ante un hash inválido
  // Guard por rol: si el usuario no puede ver esa sección (aunque haya
  // forzado el hash), se lo manda a Inicio.
  if (!puedeVer(perfilActual(), nombre)) nombre = 'inicio';

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
  document.getElementById('ttl').textContent = meta.titulo;
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

  // Sección inicial (según el hash actual o 'inicio' por defecto).
  mostrar(location.hash.slice(1) || 'inicio');
}
