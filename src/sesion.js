// =====================================================================
// SESIÓN: perfil y rol del usuario logueado (Etapa 2 · Fase B)
// ---------------------------------------------------------------------
// Guarda en memoria el perfil (y por lo tanto el rol) del usuario actual,
// para que el router y las vistas sepan qué mostrar. Se completa al iniciar
// sesión (app.js) y se limpia al cerrarla.
// =====================================================================

let _perfil = null;

export function setPerfil(perfil) {
  _perfil = perfil;
}

export function perfilActual() {
  return _perfil;
}

// Rol del usuario actual ('director' | 'secretaria' | 'profesional'), o
// null si todavía no se cargó el perfil.
export function rolActual() {
  return _perfil?.rol || null;
}
