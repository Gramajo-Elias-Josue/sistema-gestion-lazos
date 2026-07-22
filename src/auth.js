// =====================================================================
// AUTENTICACIÓN (Etapa 2 · Fase A)
// ---------------------------------------------------------------------
// Wrapper fino sobre supabase.auth. Concentra acá el manejo de la sesión
// para que el resto de la app no dependa directo del SDK.
//
// Fase A = SOLO autenticación (¿quién sos?). Todavía NO hay roles ni RLS
// por rol: cualquier usuario logueado ve todo. Los roles llegan en las
// fases B (menú según rol) y C (RLS en la base).
//
// La autenticación usa el MISMO cliente (la publishable key): Supabase
// firma cada pedido con la sesión del usuario. Nada de esto expone la
// secret key.
// =====================================================================

import { supabase } from './config/supabaseClient.js';

// Devuelve la sesión actual (o null si nadie está logueado). Supabase la
// guarda en localStorage, así que sobrevive a recargar la página.
export async function obtenerSesion() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// Inicia sesión con email y contraseña. Devuelve { data, error }: el
// controlador decide qué mostrar. NO lanza excepción (el error viene en
// el objeto), para poder mostrar un mensaje claro en el formulario.
export async function iniciarSesion(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

// Cierra la sesión del usuario actual.
export async function cerrarSesion() {
  return supabase.auth.signOut();
}

// Escucha cambios de sesión (login / logout / refresco del token) y llama
// al callback con la sesión nueva (o null). Devuelve la suscripción por si
// se quiere desconectar. Es lo que mantiene la UI en sincronía si la
// sesión cambia (por ejemplo, al expirar o cerrar sesión en otra pestaña).
export function alCambiarSesion(callback) {
  const { data } = supabase.auth.onAuthStateChange((_evento, sesion) => callback(sesion));
  return data.subscription;
}
