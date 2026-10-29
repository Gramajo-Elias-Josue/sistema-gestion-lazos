// =====================================================================
// PERMISOS: qué secciones ve cada usuario (Etapa 2 · Fase B)
// ---------------------------------------------------------------------
// Funciones PURAS (sin DOM ni base). Modelo de permisos POR USUARIO:
//   - Cada rol tiene un set de secciones POR DEFECTO.
//   - Cada perfil puede tener sus PROPIAS secciones (las que el director
//     le tildó en la pantalla "Usuarios"); si no tiene, usa las del rol.
//   - El DIRECTOR siempre ve TODO (no se le puede recortar).
//   - "inicio" siempre está disponible (para que nadie quede sin pantalla),
//     salvo para el CM: Inicio es el panel de la dirección (grilla con
//     pacientes, alertas), y el CM entra directo a Galería.
//
// La seguridad REAL la pone la RLS por rol en la base (Fase C); esto es la
// capa de UX del front.
// =====================================================================

// Todas las secciones gateables, en orden, con su etiqueta legible. Se usa
// para el menú y para los checkboxes de la pantalla "Usuarios".
export const SECCIONES = [
  { clave: 'inicio',         etiqueta: 'Inicio' },
  { clave: 'admision',       etiqueta: 'Admisión' },
  { clave: 'pacientes',      etiqueta: 'Pacientes' },
  { clave: 'agenda',         etiqueta: 'Turnos' },
  { clave: 'asistencia',     etiqueta: 'Asistencia' },
  { clave: 'profesionales',  etiqueta: 'Profesionales' },
  { clave: 'galeria',        etiqueta: 'Galería' },
  // Convenios está OCULTA por ahora (el código sigue en el proyecto).
  // Para volver a mostrarla: descomentar esta línea y sumarla a los
  // defaults de secretaría.
  // { clave: 'convenios',      etiqueta: 'Convenios' },
  { clave: 'facturacion',    etiqueta: 'Facturación' },
  { clave: 'gastos',         etiqueta: 'Gastos' },
  { clave: 'estadisticas',   etiqueta: 'Estadísticas' },
  { clave: 'administracion', etiqueta: 'Administración' },
];

const TODAS = SECCIONES.map(s => s.clave);

// Secciones por defecto de cada rol (al crear el usuario y como fallback).
const POR_DEFECTO = {
  director:    TODAS,
  // Facturación/gastos son gestión de los dueños (info financiera de la
  // sociedad), pero la secretaría las opera igual que el resto de lo
  // administrativo; y ve las estadísticas, que resumen todo eso.
  secretaria:  ['inicio', 'admision', 'pacientes', 'agenda', 'asistencia', 'profesionales', 'facturacion', 'gastos', 'estadisticas'],
  // El profesional entra a Galería porque es donde SUBE la foto de su
  // trabajo del mes (el informe lo carga en la historia clínica).
  profesional: ['inicio', 'pacientes', 'agenda', 'galeria'],
  // CM (contenido / difusión): ve SOLO la galería. No tiene por qué
  // entrar a pacientes ni a nada clínico (tampoco a Inicio, que muestra
  // la grilla con los pacientes).
  cm:          ['galeria'],
};

// "Mi fichaje" es solo del PROFESIONAL (ficha con su ubicación): no está
// en SECCIONES, así no aparece para tildar en Administración ni la recibe
// el director (que no ficha). Se le agrega siempre al rol profesional.
const SOLO_PROFESIONAL = ['fichaje'];

// Roles que NO reciben Inicio de regalo (ver seccionesEfectivas).
const SIN_INICIO = ['cm'];

// Rol por defecto si el perfil no se pudo cargar (nunca da acceso de director).
const ROL_FALLBACK = 'secretaria';

const ETIQUETAS = {
  director: 'Director', secretaria: 'Secretaría',
  profesional: 'Profesional', cm: 'Contenido (CM)',
};

// Lista de secciones por defecto de un rol.
export function seccionesPorDefecto(rol) {
  return POR_DEFECTO[rol] || POR_DEFECTO[ROL_FALLBACK];
}

// Secciones EFECTIVAS de un perfil (lo que realmente puede ver):
//   - director  -> todo.
//   - resto     -> sus secciones propias, o las del rol si no tiene.
//   - "inicio" siempre incluido, para que nadie quede sin pantalla
//     (menos el CM, que no lo tiene: ver SIN_INICIO).
//   - Las propias se filtran contra SECCIONES: una sección oculta o
//     quitada del sistema no reaparece aunque el usuario la tenga guardada.
export function seccionesEfectivas(perfil) {
  if (perfil?.rol === 'director') return [...TODAS];
  const rol = perfil?.rol || ROL_FALLBACK;
  const propias = Array.isArray(perfil?.secciones) ? perfil.secciones.filter(s => TODAS.includes(s)) : [];
  const base = propias.length ? propias : seccionesPorDefecto(rol);
  const conInicio = (base.includes('inicio') || SIN_INICIO.includes(rol)) ? base : ['inicio', ...base];
  return rol === 'profesional' ? [...conInicio, ...SOLO_PROFESIONAL] : conInicio;
}

// Sección a la que se entra al iniciar sesión (o a la que se vuelve si
// pide una que no puede ver): Inicio, o la primera que tenga si no lo ve.
export function seccionInicial(perfil) {
  const permitidas = seccionesEfectivas(perfil);
  return permitidas.includes('inicio') ? 'inicio' : permitidas[0];
}

// ¿El perfil puede ver/navegar esa sección?
export function puedeVer(perfil, seccion) {
  return seccionesEfectivas(perfil).includes(seccion);
}

// ¿Puede OPERAR (crear/editar/eliminar) lo administrativo? Director y
// secretaría sí; el profesional no (él sólo consulta y carga informes).
// Es el espejo en el front de puede_operar() de la base (ver supabase/sql/04-seguridad-rls.sql).
export function puedeOperar(perfil) {
  return perfil?.rol === 'director' || perfil?.rol === 'secretaria';
}

// Etiqueta legible del rol ('Director', 'Secretaría', …).
export function etiquetaRol(rol) {
  return ETIQUETAS[rol] || 'Usuario';
}
