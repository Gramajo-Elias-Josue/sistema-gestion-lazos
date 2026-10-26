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
--    (deja todo libre solo para usuarios logueados) y avisá qué falló.
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


-- ---------------------------------------------------------------------
-- 7) SECTORES, GALERÍA y tabla vieja
-- ---------------------------------------------------------------------
-- Profesional vinculado al usuario logueado (o null). Security definer
-- por la misma razón que rol_actual(): lee `perfiles` sin chocar con su RLS.
create or replace function public.mi_profesional_id()
returns uuid language sql stable security definer set search_path = public as $$
  select profesional_id from public.perfiles where id = auth.uid();
$$;

-- Sectores (profesiones / columnas de la grilla): todos los ven; los
-- agregan y quitan director / secretaría.
alter table public.sectores enable row level security;
drop policy if exists "acceso_anon" on public.sectores;
drop policy if exists "rol_select" on public.sectores;
drop policy if exists "rol_escritura" on public.sectores;
create policy "rol_select" on public.sectores
  for select to authenticated using (true);
create policy "rol_escritura" on public.sectores
  for all to authenticated
  using (public.puede_operar())
  with check (public.puede_operar());

-- Galería: la ven todos los logueados (incluido el CM); cada profesional
-- sube y borra SOLO sus fotos. Director / secretaría pueden borrar
-- cualquiera (la limpieza automática de las de más de 3 meses).
alter table public.fotos_trabajo enable row level security;
drop policy if exists "acceso_anon" on public.fotos_trabajo;
drop policy if exists "fotos_select" on public.fotos_trabajo;
drop policy if exists "fotos_insert" on public.fotos_trabajo;
drop policy if exists "fotos_delete" on public.fotos_trabajo;
create policy "fotos_select" on public.fotos_trabajo
  for select to authenticated using (true);
create policy "fotos_insert" on public.fotos_trabajo
  for insert to authenticated
  with check (profesional_id = public.mi_profesional_id() or public.puede_operar());
create policy "fotos_delete" on public.fotos_trabajo
  for delete to authenticated
  using (profesional_id = public.mi_profesional_id() or public.puede_operar());

-- El archivo de la foto vive en documentos/galeria/<periodo>/<profesional>/…:
-- el profesional puede borrar el SUYO (el resto de los archivos, no).
drop policy if exists "galeria_delete_propia" on storage.objects;
create policy "galeria_delete_propia" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documentos'
         and (storage.foldername(name))[1] = 'galeria'
         and (storage.foldername(name))[3] = public.mi_profesional_id()::text);

-- Tabla vieja sin uso (de una versión anterior de los informes): si
-- existe, queda cerrada (RLS sin políticas = nadie accede por la API).
do $$
begin
  if to_regclass('public.informes_profesional') is not null then
    execute 'alter table public.informes_profesional enable row level security';
    execute 'drop policy if exists "acceso_anon" on public.informes_profesional';
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 8) RED DE SEGURIDAD: que no quede NADA abierto
-- ---------------------------------------------------------------------
-- Si alguna vez se volvió a correr un script viejo (o se creó una
-- política desde el panel), las políticas abiertas se SUMAN a las de rol
-- y dejan pasar todo: en Postgres alcanza con que UNA política permita.
-- Esto borra cualquier política abierta que haya quedado: "acceso_anon" /
-- "etapa1_*" en las tablas, las "emergencia_*" de rls-revertir.sql, y toda
-- política del Storage que le dé acceso al rol anon (sin sesión).
do $$
declare p record;
begin
  for p in
    select tablename, policyname from pg_policies
     where schemaname = 'public'
       and (policyname = 'acceso_anon' or policyname like 'etapa1_%' or policyname like 'emergencia_%')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;

  for p in
    select policyname from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and ('anon' = any(roles) or policyname like 'emergencia_%')
  loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- 9) FUNCIONES: solo para usuarios logueados
-- ---------------------------------------------------------------------
-- Por defecto Postgres deja ejecutar cualquier función a todos (rol
-- PUBLIC, que incluye a anon). Estas solo tienen sentido con sesión.
do $$
declare f text;
begin
  foreach f in array array['rol_actual()', 'es_director()', 'puede_operar()', 'mi_profesional_id()', 'actualizar_mi_avatar(text)']
  loop
    if to_regprocedure('public.' || f) is not null then
      execute format('revoke execute on function public.%s from public, anon', f);
      execute format('grant execute on function public.%s to authenticated', f);
    end if;
  end loop;
end $$;

-- La función de los triggers updated_at, con search_path fijo (que nadie
-- pueda colarle otra función "now" cambiando el search_path).
do $$
begin
  if to_regprocedure('public.update_updated_at_column()') is not null then
    execute 'alter function public.update_updated_at_column() set search_path = public';
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 10) VERIFICACIÓN: tiene que dar 0 filas (ninguna política para anon)
-- ---------------------------------------------------------------------
select schemaname, tablename, policyname
  from pg_policies
 where 'anon' = any(roles) or policyname = 'acceso_anon';


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
