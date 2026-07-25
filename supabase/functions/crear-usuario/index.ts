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
// =====================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Respuesta JSON con los headers de CORS.
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  // Preflight de CORS.
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // 1) Verificar que QUIEN llama sea director (con su propio JWT).
    const authHeader = req.headers.get('Authorization') ?? '';
    const clienteCaller = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await clienteCaller.auth.getUser();
    const caller = userData?.user;
    if (!caller) return json({ error: 'No autenticado.' }, 401);

    const { data: perfilCaller } = await clienteCaller
      .from('perfiles').select('rol').eq('id', caller.id).maybeSingle();
    if (perfilCaller?.rol !== 'director') {
      return json({ error: 'Sólo el director puede crear usuarios.' }, 403);
    }

    // 2) Datos del nuevo usuario.
    const { email, password, nombre, rol, secciones } = await req.json();
    if (!email || !password || !rol) {
      return json({ error: 'Faltan email, contraseña o rol.' }, 400);
    }
    if (!['director', 'secretaria', 'profesional'].includes(rol)) {
      return json({ error: 'Rol inválido.' }, 400);
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
