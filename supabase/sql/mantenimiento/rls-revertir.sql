-- =====================================================================
-- REVERTIR la RLS por rol (vuelve a las políticas abiertas)
-- ---------------------------------------------------------------------
-- Red de seguridad de la Fase C. Si tras aplicar `supabase/sql/04-seguridad-rls.sql` algo
-- queda bloqueado de más (listas vacías, error 42501 "row-level security
-- policy"), corré ESTE script en el SQL Editor y todo vuelve a como estaba
-- antes: acceso abierto para anon y authenticated.
--
-- Ojo: al revertir se pierde el control por rol en la base (el gating del
-- front sigue, pero es sólo cosmético). Es para destrabar y diagnosticar,
-- no para dejarlo así.
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

    -- Política abierta original.
    execute format('drop policy if exists "acceso_anon" on public.%I;', t);
    execute format($f$
      create policy "acceso_anon" on public.%I
        for all to anon, authenticated
        using (true) with check (true);
    $f$, t);
  end loop;
end $$;

-- 2) Storage: volver a las políticas abiertas del bucket "documentos".
drop policy if exists "rol_doc_select" on storage.objects;
drop policy if exists "rol_doc_insert" on storage.objects;
drop policy if exists "rol_doc_delete" on storage.objects;
drop policy if exists "acceso_doc_select" on storage.objects;
drop policy if exists "acceso_doc_insert" on storage.objects;
drop policy if exists "acceso_doc_delete" on storage.objects;

create policy "acceso_doc_select" on storage.objects
  for select to anon, authenticated using (bucket_id = 'documentos');

create policy "acceso_doc_insert" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'documentos');

create policy "acceso_doc_delete" on storage.objects
  for delete to anon, authenticated using (bucket_id = 'documentos');

-- =====================================================================
-- Listo: acceso abierto de nuevo. Las tablas `perfiles` y los roles del
-- front no se tocan (siguen funcionando).
-- =====================================================================
