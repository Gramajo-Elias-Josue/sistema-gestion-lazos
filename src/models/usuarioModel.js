// =====================================================================
// MODELO: Usuarios (Etapa 2 · Fase B — pantalla "Administración")
// ---------------------------------------------------------------------
// CAPA MODELO. Gestiona los usuarios del sistema a través de la tabla
// `perfiles`. Sólo el director tiene acceso (lo garantiza la RLS de
// perfiles: perfil_director_all).
//
// El ALTA de la cuenta (email + contraseña) NO se hace directo desde acá:
// necesita la service key, que vive del lado servidor. Por eso `crearUsuario`
// llama a la Edge Function `crear-usuario`.
// =====================================================================

import { supabase } from '../config/supabaseClient.js';

const TABLA = 'perfiles';

// Lista todos los usuarios (perfiles) ordenados por rol y nombre.
export async function listarUsuarios() {
  const { data, error } = await supabase
    .from(TABLA)
    .select('id, nombre, email, rol, secciones, creado_en')
    .order('rol', { ascending: true })
    .order('nombre', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data || [];
}

// Actualiza el rol y/o las secciones de un usuario. `secciones` = arreglo
// de claves (o null para volver al default del rol).
export async function actualizarPermisos(id, { rol, secciones }) {
  const cambios = {};
  if (rol !== undefined) cambios.rol = rol;
  if (secciones !== undefined) cambios.secciones = (secciones && secciones.length) ? secciones : null;

  const { data, error } = await supabase
    .from(TABLA)
    .update(cambios)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Crea un usuario nuevo (cuenta + perfil) vía la Edge Function `crear-usuario`.
// Devuelve { ok } o lanza un error con el mensaje del servidor.
export async function crearUsuario({ email, password, nombre, rol, secciones }) {
  const { data, error } = await supabase.functions.invoke('crear-usuario', {
    body: { email, password, nombre, rol, secciones },
  });
  // La invocación puede fallar por red (error) o por lógica (data.error).
  if (error) {
    // Si el server respondió con un cuerpo de error, se intenta leerlo.
    let msg = error.message || 'No se pudo crear el usuario.';
    try {
      const ctx = await error.context?.json?.();
      if (ctx?.error) msg = ctx.error;
    } catch { /* sin cuerpo legible */ }
    // "Failed to send a request" = no se llegó a ejecutar la función. Suele
    // ser que no está deployada o que tiene "Verify JWT" activo (rechaza el
    // preflight CORS). Se traduce a algo accionable.
    if (/failed to send a request|fetch/i.test(msg)) {
      msg = 'No se pudo contactar la función "crear-usuario". Verificá que esté deployada y con "Verify JWT" desactivado.';
    }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
