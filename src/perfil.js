// =====================================================================
// PERFIL: lee el perfil (rol) del usuario desde la base (Etapa 2 · Fase B)
// ---------------------------------------------------------------------
// Consulta la tabla `perfiles` para saber el rol del usuario logueado.
// Es resiliente: si falla (sin conexión, sin fila), devuelve null y el
// front usa un rol por defecto conservador (ver permisos.js).
// =====================================================================

import { supabase } from './config/supabaseClient.js';

// Devuelve el perfil del usuario de la sesión ({ id, nombre, rol, ... }) o
// null si no hay usuario o no se pudo leer.
export async function obtenerPerfil(sesion) {
  const uid = sesion?.user?.id;
  if (!uid) return null;

  try {
    const { data, error } = await supabase
      .from('perfiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();
    if (error) {
      console.error('No se pudo cargar el perfil (rol):', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('Error inesperado al cargar el perfil:', err);
    return null;
  }
}
