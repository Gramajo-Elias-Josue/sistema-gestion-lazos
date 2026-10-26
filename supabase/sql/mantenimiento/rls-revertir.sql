-- =====================================================================
-- REVERTIR la RLS por rol (acceso libre, pero SOLO con sesión iniciada)
-- ---------------------------------------------------------------------
-- Red de seguridad de la Fase C. Si tras aplicar `supabase/sql/04-seguridad-rls.sql` algo
-- queda bloqueado de más (listas vacías, error 42501 "row-level security
-- policy"), corré ESTE script en el SQL Editor: cualquier usuario LOGUEADO
-- vuelve a poder leer y escribir todo. Sin sesión (anon) sigue sin entrar:
-- antes este script reabría la base también a anon, y eso dejaba los datos
-- de los pacientes a la vista de cualquiera con la URL del proyecto.
--
-- Ojo: al revertir se pierde el control por rol en la base (el gating del
-- front sigue, pero es sólo cosmético). Es para destrabar y diagnosticar,
-- no para dejarlo así. Para volver a la seguridad por rol, correr de nuevo
-- 04-seguridad-rls.sql (borra solo estas políticas "emergencia_*").
-- =====================================================================

-- 1) Tablas: borrar las políticas por rol y recrear la abierta.
do $$
declare t text;
begin
  foreach t in array array[
    'pacientes','contactos_emergencia','profesionales',
    'documentos','asistencias','asignaciones',
    'admision_documentos','turnos','asistencias_profesionales','evaluaciones'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);

    -- Políticas creadas por supabase/sql/04-seguridad-rls.sql
    execute format('drop policy if exists "rol_select" on public.%I;', t);
    execute format('drop policy if exists "rol_escritura" on public.%I;', t);
    execute format('drop policy if exists "turnos_select" on public.%I;', t);
    execute format('drop policy if exists "turnos_insert" on public.%I;', t);
    execute format('drop policy if exists "turnos_update" on public.%I;', t);
    execute format('drop policy if exists "turnos_delete" on public.%I;', t);
    execute format('drop policy if exists "turnos_escritura" on public.%I;', t);
    execute format('drop policy if exists "eval_select" on public.%I;', t);
    execute format('drop policy if exists "eval_insert" on public.%I;', t);
    execute format('drop policy if exists "eval_update" on public.%I;', t);
    execute format('drop policy if exists "eval_delete" on public.%I;', t);
    execute format('drop policy if exists "doc_select" on public.%I;', t);
    execute format('drop policy if exists "doc_insert" on public.%I;', t);
    execute format('drop policy if exists "doc_update" on public.%I;', t);
    execute format('drop policy if exists "doc_delete" on public.%I;', t);

    -- Política abierta, solo para usuarios logueados.
    execute format('drop policy if exists "acceso_anon" on public.%I;', t);
    execute format('drop policy if exists "emergencia_logueados" on public.%I;', t);
    execute format($f$
      create policy "emergencia_logueados" on public.%I
        for all to authenticated
        using (true) with check (true);
    $f$, t);
  end loop;
end $$;

-- 2) Storage: bucket "documentos" abierto, solo para usuarios logueados.
drop policy if exists "rol_doc_select" on storage.objects;
drop policy if exists "rol_doc_insert" on storage.objects;
drop policy if exists "rol_doc_delete" on storage.objects;
drop policy if exists "acceso_doc_select" on storage.objects;
drop policy if exists "acceso_doc_insert" on storage.objects;
drop policy if exists "acceso_doc_delete" on storage.objects;
drop policy if exists "emergencia_doc_select" on storage.objects;
drop policy if exists "emergencia_doc_insert" on storage.objects;
drop policy if exists "emergencia_doc_delete" on storage.objects;

create policy "emergencia_doc_select" on storage.objects
  for select to authenticated using (bucket_id = 'documentos');

create policy "emergencia_doc_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'documentos');

create policy "emergencia_doc_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'documentos');

-- =====================================================================
-- Listo: acceso abierto para usuarios logueados. Las tablas `perfiles` y los roles del
-- front no se tocan (siguen funcionando).
-- =====================================================================
