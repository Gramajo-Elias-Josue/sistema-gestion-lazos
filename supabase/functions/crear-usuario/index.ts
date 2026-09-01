// =====================================================================
// EDGE FUNCTION: crear-usuario (Etapa 2 · Fase B — alta de usuarios)
// ---------------------------------------------------------------------
// Crea la CUENTA (email + contraseña) de un usuario nuevo y su fila en
// `perfiles`. Corre en el servidor de Supabase, así que puede usar la
// SERVICE ROLE KEY (llave de admin) sin exponerla al navegador.
//
// SEGURIDAD: sólo el DIRECTOR puede crear usuarios. La función lo verifica
// leyendo el perfil de quien llama (con su propio JWT) antes de crear nada.
//
// Deploy (sin CLI): Supabase → Edge Functions → "Deploy a new function",
// nombre exacto `crear-usuario`, pegá este archivo y Deploy. Las variables
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY ya vienen
// disponibles solas; no hay que cargar secretos.
//
// IMPORTANTE — "Verify JWT" debe estar DESACTIVADO en los ajustes de esta
// función. Si está activo, el gateway rechaza el preflight OPTIONS (que va
// sin Authorization) y el navegador falla con error de CORS. La función NO
// queda abierta: verifica ella misma que quien llama sea director (paso 1).
// =====================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// Respuesta JSON con los headers de CORS.
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  // Preflight de CORS: se responde SIEMPRE con 204 y sin tocar nada más.
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // 1) Verificar que QUIEN llama sea director o secretaría (con su
    //    propio JWT). La pantalla de Administración (crear cualquier rol)
    //    la ve solo el director; la secretaría llega hasta acá por el
    //    alta rápida desde Profesionales, y ahí queda limitada más abajo
    //    a crear solo cuentas de "profesional".
    const authHeader = req.headers.get('Authorization') ?? '';
    const clienteCaller = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await clienteCaller.auth.getUser();
    const caller = userData?.user;
    if (!caller) return json({ error: 'No autenticado.' }, 401);

    const { data: perfilCaller } = await clienteCaller
      .from('perfiles').select('rol').eq('id', caller.id).maybeSingle();
    const rolCaller = perfilCaller?.rol;
    if (!['director', 'secretaria'].includes(rolCaller ?? '')) {
      return json({ error: 'No tenés permiso para crear usuarios.' }, 403);
    }

    // 2) Datos del nuevo usuario. profesionalId es OPCIONAL: se manda cuando
    //    el usuario se crea junto con un profesional (desde la sección
    //    Profesionales), para vincular perfiles.profesional_id de una.
    const { email, password, nombre, rol, secciones, profesionalId } = await req.json();
    if (!email || !password || !rol) {
      return json({ error: 'Faltan email, contraseña o rol.' }, 400);
    }
    // 'cm' = community manager: solo entra a la galería del trabajo.
    if (!['director', 'secretaria', 'profesional', 'cm'].includes(rol)) {
      return json({ error: 'Rol inválido.' }, 400);
    }
    // La secretaría NO puede crear director/secretaria/cm (ni a sí misma
    // con más permisos): solo cuentas de profesional, que es el único
    // caso que necesita desde su pantalla.
    if (rolCaller === 'secretaria' && rol !== 'profesional') {
      return json({ error: 'La secretaría solo puede crear cuentas de profesional.' }, 403);
    }

    // 3) Crear la cuenta con la service key (admin), ya confirmada.
    const admin = createClient(url, service);
    const { data: creado, error: errCrear } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (errCrear || !creado?.user) {
      return json({ error: errCrear?.message ?? 'No se pudo crear la cuenta.' }, 400);
    }

    // 4) Insertar el perfil. Si falla, se borra la cuenta para no dejarla huérfana.
    const { error: errPerfil } = await admin.from('perfiles').insert({
      id: creado.user.id,
      nombre: nombre ?? null,
      rol,
      secciones: Array.isArray(secciones) && secciones.length ? secciones : null,
      email,
      profesional_id: profesionalId ?? null,
    });
    if (errPerfil) {
      await admin.auth.admin.deleteUser(creado.user.id);
      return json({ error: errPerfil.message }, 400);
    }

    return json({ ok: true, id: creado.user.id, email });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
