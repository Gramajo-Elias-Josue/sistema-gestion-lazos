-- =====================================================================
-- RLS por rol — Etapa 2 · Fase C (seguridad REAL, en la base)
-- ---------------------------------------------------------------------
-- Pegá y ejecutá en: Supabase → SQL Editor.
--
-- Hasta ahora las políticas eran ABIERTAS (`acceso_anon`: cualquiera, con
-- o sin sesión, leía y escribía todo). Este script las reemplaza por
-- políticas atadas al ROL del usuario logueado. A partir de acá el control
-- NO depende del frontend: aunque alguien llame a la API a mano, la base
-- rechaza lo que su rol no permite.
--
-- MATRIZ (decidida con la dirección):
--   director    -> todo.
--   secretaria  -> todo lo operativo (pacientes, admisión, turnos,
--                  asistencia, profesionales, documentos).
--   profesional -> LEE todo (historia clínica, agenda), y sólo ESCRIBE lo
--                  suyo: informes (evaluaciones) y los documentos que
--                  adjunta. La AGENDA es de la secretaría: el profesional
--                  no crea turnos ni los marca "Atendido".
--   anon (sin sesión) -> NADA. Ahora hay que iniciar sesión.
--
-- ⚠️ Si algo queda bloqueado de más, corré `supabase/sql/mantenimiento/rls-revertir.sql`
--    para volver a las políticas abiertas y avisá qué falló.
--
-- REQUISITO: haber corrido antes `supabase/sql/01-roles-y-perfiles.sql` (crea `perfiles` y
-- la función `rol_actual()`), y que cada usuario tenga su fila en
-- `perfiles`. Un usuario SIN perfil queda sin permisos de escritura.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Helpers de rol (se apoyan en rol_actual(), que es security definer)
-- ---------------------------------------------------------------------
create or replace function public.es_director()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.rol_actual() = 'director', false);
$$;

-- "Puede operar" = director o secretaría (todo lo administrativo).
create or replace function public.puede_operar()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.rol_actual() in ('director','secretaria'), false);
$$;


-- ---------------------------------------------------------------------
-- 2) TABLAS OPERATIVAS
--    Lectura: cualquier usuario logueado.
--    Escritura: sólo director / secretaría.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'pacientes','contactos_emergencia','profesionales',
    'asistencias','asignaciones','admision_documentos',
    'asistencias_profesionales'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    -- Fuera las políticas abiertas anteriores (y las de este script, para
    -- poder re-ejecutarlo sin errores).
    execute format('drop policy if exists "acceso_anon" on public.%I;', t);
    execute format('drop policy if exists "etapa1_anon_all" on public.%I;', t);
    execute format('drop policy if exists "rol_select" on public.%I;', t);
    execute format('drop policy if exists "rol_escritura" on public.%I;', t);

    execute format($f$
      create policy "rol_select" on public.%I
        for select to authenticated using (true);
    $f$, t);

    execute format($f$
      create policy "rol_escritura" on public.%I
        for all to authenticated
        using (public.puede_operar())
        with check (public.puede_operar());
    $f$, t);
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- 3) TURNOS — la agenda es de la secretaría
--    El profesional puede CONSULTAR la agenda, pero no crear turnos, no
--    eliminarlos y no cambiar su estado: marcar "Atendido" lo hace la
--    secretaría (que además lleva la planilla de asistencia).
--    Flujo: la secretaría marca el turno como atendido -> recién entonces
--    el profesional puede cargar el informe de ese paciente.
-- ---------------------------------------------------------------------
alter table public.turnos enable row level security;
drop policy if exists "acceso_anon" on public.turnos;
drop policy if exists "etapa1_anon_all" on public.turnos;
drop policy if exists "turnos_select" on public.turnos;
drop policy if exists "turnos_insert" on public.turnos;
drop policy if exists "turnos_update" on public.turnos;
drop policy if exists "turnos_delete" on public.turnos;
drop policy if exists "turnos_escritura" on public.turnos;

create policy "turnos_select" on public.turnos
  for select to authenticated using (true);

-- Crear, editar (incluido el estado) y eliminar: sólo director / secretaría.
create policy "turnos_escritura" on public.turnos
  for all to authenticated
  using (public.puede_operar())
  with check (public.puede_operar());


-- ---------------------------------------------------------------------
-- 4) EVALUACIONES (informes profesionales)
--    Es lo que el profesional SÍ produce: puede crear y editar informes.
--    Borrar queda para director / secretaría.
-- ---------------------------------------------------------------------
alter table public.evaluaciones enable row level security;
drop policy if exists "acceso_anon" on public.evaluaciones;
drop policy if exists "etapa1_anon_all" on public.evaluaciones;
drop policy if exists "eval_select" on public.evaluaciones;
drop policy if exists "eval_insert" on public.evaluaciones;
drop policy if exists "eval_update" on public.evaluaciones;
drop policy if exists "eval_delete" on public.evaluaciones;

create policy "eval_select" on public.evaluaciones
  for select to authenticated using (true);

create policy "eval_insert" on public.evaluaciones
  for insert to authenticated with check (true);

create policy "eval_update" on public.evaluaciones
  for update to authenticated using (true) with check (true);

create policy "eval_delete" on public.evaluaciones
  for delete to authenticated using (public.puede_operar());


-- ---------------------------------------------------------------------
-- 5) DOCUMENTOS (historia clínica)
--    El profesional necesita INSERTAR: al guardar un informe, el PDF se
--    adjunta como documento de la historia clínica. Editar y borrar
--    documentos queda para director / secretaría.
-- ---------------------------------------------------------------------
alter table public.documentos enable row level security;
drop policy if exists "acceso_anon" on public.documentos;
drop policy if exists "etapa1_anon_all" on public.documentos;
drop policy if exists "doc_select" on public.documentos;
drop policy if exists "doc_insert" on public.documentos;
drop policy if exists "doc_update" on public.documentos;
drop policy if exists "doc_delete" on public.documentos;

create policy "doc_select" on public.documentos
  for select to authenticated using (true);

create policy "doc_insert" on public.documentos
  for insert to authenticated with check (true);

create policy "doc_update" on public.documentos
  for update to authenticated using (public.puede_operar()) with check (public.puede_operar());

create policy "doc_delete" on public.documentos
  for delete to authenticated using (public.puede_operar());


-- ---------------------------------------------------------------------
-- 6) STORAGE (bucket "documentos")
--    Sin sesión ya no se accede a los archivos. Subir puede cualquiera
--    logueado (el profesional adjunta el PDF del informe); borrar, no.
-- ---------------------------------------------------------------------
drop policy if exists "acceso_doc_select" on storage.objects;
drop policy if exists "acceso_doc_insert" on storage.objects;
drop policy if exists "acceso_doc_delete" on storage.objects;
drop policy if exists "etapa1_doc_select" on storage.objects;
drop policy if exists "etapa1_doc_insert" on storage.objects;
drop policy if exists "etapa1_doc_delete" on storage.objects;
drop policy if exists "rol_doc_select" on storage.objects;
drop policy if exists "rol_doc_insert" on storage.objects;
drop policy if exists "rol_doc_delete" on storage.objects;

create policy "rol_doc_select" on storage.objects
  for select to authenticated using (bucket_id = 'documentos');

create policy "rol_doc_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'documentos');

create policy "rol_doc_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'documentos' and public.puede_operar());


-- =====================================================================
-- Listo. A partir de acá el permiso lo hace cumplir la BASE, no el front.
--
-- PROBAR (importante, en este orden):
--   1) Con el DIRECTOR: recorrer todo. Debe seguir funcionando igual.
--   2) Con una SECRETARÍA: todo lo operativo; no ve Administración.
--   3) Con un PROFESIONAL: ve pacientes y agenda, marca "Atendido" y
--      carga un informe con su PDF adjunto; NO puede dar de alta
--      pacientes ni profesionales.
--
-- Si algo queda bloqueado de más: `supabase/sql/mantenimiento/rls-revertir.sql`.
-- =====================================================================
