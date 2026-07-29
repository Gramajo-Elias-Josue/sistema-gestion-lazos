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

const BUCKET_AVATARES = 'avatares';

// Guarda el avatar del usuario logueado. Se hace por una función de la base
// (`actualizar_mi_avatar`) que sólo toca esa columna: así el usuario no
// puede cambiarse el rol ni sus permisos al editar su perfil.
export async function guardarAvatar(valor) {
  const { error } = await supabase.rpc('actualizar_mi_avatar', { nuevo: valor });
  if (error) throw error;
}

// Sube la foto de perfil al bucket "avatares" y devuelve su ruta.
// `upsert:true` permite reemplazar una foto anterior con el mismo nombre.
export async function subirFotoAvatar(ruta, archivo) {
  const { error } = await supabase
    .storage.from(BUCKET_AVATARES)
    .upload(ruta, archivo, { cacheControl: '3600', upsert: true });
  if (error) throw error;
  return ruta;
}

// URL temporal firmada para mostrar una foto de perfil (el bucket es privado).
export async function urlAvatar(ruta, segundos = 3600) {
  const { data, error } = await supabase
    .storage.from(BUCKET_AVATARES)
    .createSignedUrl(ruta, segundos);
  if (error) throw error;
  return data.signedUrl;
}
