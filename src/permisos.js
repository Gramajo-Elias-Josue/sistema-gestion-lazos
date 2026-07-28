// =====================================================================
// PERMISOS: qué secciones ve cada usuario (Etapa 2 · Fase B)
// ---------------------------------------------------------------------
// Funciones PURAS (sin DOM ni base). Modelo de permisos POR USUARIO:
//   - Cada rol tiene un set de secciones POR DEFECTO.
//   - Cada perfil puede tener sus PROPIAS secciones (las que el director
//     le tildó en la pantalla "Usuarios"); si no tiene, usa las del rol.
//   - El DIRECTOR siempre ve TODO (no se le puede recortar).
//   - "inicio" siempre está disponible (para que nadie quede sin pantalla).
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
  { clave: 'estadisticas',   etiqueta: 'Estadísticas' },
  { clave: 'administracion', etiqueta: 'Administración' },
];

const TODAS = SECCIONES.map(s => s.clave);

// Secciones por defecto de cada rol (al crear el usuario y como fallback).
const POR_DEFECTO = {
  director:    TODAS,
  secretaria:  ['inicio', 'admision', 'pacientes', 'agenda', 'asistencia', 'profesionales'],
  profesional: ['inicio', 'pacientes', 'agenda'],
};

// Rol por defecto si el perfil no se pudo cargar (nunca da acceso de director).
const ROL_FALLBACK = 'secretaria';

const ETIQUETAS = { director: 'Director', secretaria: 'Secretaría', profesional: 'Profesional' };

// Lista de secciones por defecto de un rol.
export function seccionesPorDefecto(rol) {
  return POR_DEFECTO[rol] || POR_DEFECTO[ROL_FALLBACK];
}

// Secciones EFECTIVAS de un perfil (lo que realmente puede ver):
//   - director  -> todo.
//   - resto     -> sus secciones propias, o las del rol si no tiene.
//   - "inicio" siempre incluido, para que nadie quede sin pantalla.
export function seccionesEfectivas(perfil) {
  if (perfil?.rol === 'director') return [...TODAS];
  const rol = perfil?.rol || ROL_FALLBACK;
  const propias = Array.isArray(perfil?.secciones) ? perfil.secciones.filter(Boolean) : [];
  const base = propias.length ? propias : seccionesPorDefecto(rol);
  return base.includes('inicio') ? base : ['inicio', ...base];
}

// ¿El perfil puede ver/navegar esa sección?
export function puedeVer(perfil, seccion) {
  return seccionesEfectivas(perfil).includes(seccion);
}

// ¿Puede OPERAR (crear/editar/eliminar) lo administrativo? Director y
// secretaría sí; el profesional no (él sólo consulta y carga informes).
// Es el espejo en el front de puede_operar() de la base (ver supabase-rls.sql).
export function puedeOperar(perfil) {
  return perfil?.rol === 'director' || perfil?.rol === 'secretaria';
}

// Etiqueta legible del rol ('Director', 'Secretaría', …).
export function etiquetaRol(rol) {
  return ETIQUETAS[rol] || 'Usuario';
}
