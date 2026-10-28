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

// Escucha cambios de sesión (login / logout / refresco del token, y el
// caso especial "recuperar contraseña") y llama al callback con la sesión
// nueva (o null) y el EVENTO de Supabase. Devuelve la suscripción por si
// se quiere desconectar. Es lo que mantiene la UI en sincronía si la
// sesión cambia (por ejemplo, al expirar o cerrar sesión en otra pestaña).
export function alCambiarSesion(callback) {
  const { data } = supabase.auth.onAuthStateChange((evento, sesion) => callback(sesion, evento));
  return data.subscription;
}

// ---------------------------------------------------------------------
// RECUPERAR CONTRASEÑA
// ---------------------------------------------------------------------
// 1) pedirRecuperacion(email): manda un mail con un link. Al tocarlo, el
//    usuario vuelve a esta misma app con una sesión TEMPORAL de
//    recuperación; Supabase avisa de eso disparando el evento
//    'PASSWORD_RECOVERY' en alCambiarSesion (lo escucha app.js).
// 2) establecerContrasena(password): pone la contraseña nueva. Sirve
//    tanto para esa sesión temporal como para un usuario ya logueado que
//    quiere cambiarla.
//
// redirectTo: a dónde vuelve el link del mail. Tiene que estar cargado en
// Supabase → Authentication → URL Configuration → Redirect URLs, si no
// Supabase rechaza el link (paso manual, no se hace desde acá).
export async function pedirRecuperacion(email) {
  return supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
}

// Además apaga la marca `elegir_contrasena` del usuario invitado (ver
// debeElegirContrasena): con la contraseña puesta ya entra normal.
export async function establecerContrasena(password) {
  return supabase.auth.updateUser({ password, data: { elegir_contrasena: false } });
}

// ---------------------------------------------------------------------
// BIENVENIDA (usuario nuevo)
// ---------------------------------------------------------------------
// Al crear un usuario, la Edge Function `crear-usuario` le manda un mail
// de bienvenida y lo marca con `elegir_contrasena: true`. Al tocar el
// link entra con una sesión pero SIN contraseña propia: mientras tenga la
// marca, app.js le muestra "Elegí tu contraseña" en vez de la app. Se lee
// de la sesión (no del link), así sirve aunque recargue la página.
export function debeElegirContrasena(sesion) {
  return sesion?.user?.user_metadata?.elegir_contrasena === true;
}
