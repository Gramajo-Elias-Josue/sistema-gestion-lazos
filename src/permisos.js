// =====================================================================
// PERMISOS: qué secciones ve cada rol (Etapa 2 · Fase B)
// ---------------------------------------------------------------------
// Funciones PURAS (sin DOM ni base). Definen la matriz de acceso por rol.
// El front las usa para mostrar/ocultar secciones del menú y bloquear la
// navegación. La seguridad REAL la pone la RLS por rol en la base (Fase C);
// esto es la capa de comodidad/UX.
//
// Roles:
//   director    -> todo, incluidos estadísticas y administración/usuarios.
//   secretaria  -> operativo casi completo, SIN estadísticas ni usuarios.
//   profesional -> entra por el paciente (ver + informes) y su agenda.
// =====================================================================

// Secciones que cada rol puede VER (navegar). Se incluyen ya las secciones
// futuras (estadisticas, administracion) para cuando existan en el menú.
const ACCESO = {
  director:    ['inicio', 'admision', 'pacientes', 'agenda', 'asistencia', 'profesionales', 'estadisticas', 'administracion'],
  secretaria:  ['inicio', 'admision', 'pacientes', 'agenda', 'asistencia', 'profesionales'],
  profesional: ['inicio', 'pacientes', 'agenda'],
};

// Rol por defecto si el perfil no se pudo cargar (p. ej. sin conexión).
// Se usa 'secretaria' para no dejar la app inutilizable mientras la RLS
// (Fase C) todavía no está enforcando; nunca da acceso de director.
const ROL_FALLBACK = 'secretaria';

// Etiqueta legible del rol (para mostrar en el encabezado).
const ETIQUETAS = { director: 'Director', secretaria: 'Secretaría', profesional: 'Profesional' };

// Lista de secciones permitidas para un rol (con fallback conservador).
export function seccionesDe(rol) {
  return ACCESO[rol] || ACCESO[ROL_FALLBACK];
}

// ¿El rol puede ver/navegar esa sección?
export function puedeVer(rol, seccion) {
  return seccionesDe(rol).includes(seccion);
}

// Etiqueta legible del rol ('Director', 'Secretaría', …).
export function etiquetaRol(rol) {
  return ETIQUETAS[rol] || 'Usuario';
}
