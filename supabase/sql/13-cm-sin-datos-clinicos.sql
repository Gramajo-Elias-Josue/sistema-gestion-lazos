-- =====================================================================
-- El CM (contenido / difusión) no lee datos clínicos
-- ---------------------------------------------------------------------
-- Pegá y ejecutá en: Supabase → SQL Editor. Es idempotente.
-- Requiere antes supabase/sql/04-seguridad-rls.sql (y los siguientes).
--
-- Hasta acá, las políticas de LECTURA de las tablas clínicas dejaban leer
-- a cualquier usuario con sesión (`using (true)`). El CM no ve esas
-- secciones en la app, pero con su sesión igual podía pedir los datos a
-- la base. Ahora solo los leen dirección, secretaría y profesionales.
--
-- El CM sigue leyendo lo que usa la Galería: profesionales, sectores,
-- fotos_trabajo y, en el almacenamiento, solo la carpeta `galeria/`.
-- =====================================================================

-- ¿El usuario actual puede leer datos clínicos? (todos menos el CM, y
-- nadie sin perfil). security definer: lee perfiles sin depender de RLS.
create or replace function public.ve_datos_clinicos()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.rol_actual() in ('director', 'secretaria', 'profesional'), false);
$$;

-- Solo tiene sentido con sesión: sin sesión no se puede ni llamar.
revoke execute on function public.ve_datos_clinicos() from public, anon;
grant execute on function public.ve_datos_clinicos() to authenticated;

-- Tablas clínicas: se cambia SOLO quién puede leer (las de escritura ya
-- eran de director/secretaría y no cambian).
alter policy rol_select  on public.pacientes                 using (public.ve_datos_clinicos());
alter policy rol_select  on public.contactos_emergencia      using (public.ve_datos_clinicos());
alter policy rol_select  on public.asignaciones              using (public.ve_datos_clinicos());
alter policy rol_select  on public.asistencias               using (public.ve_datos_clinicos());
alter policy rol_select  on public.asistencias_profesionales using (public.ve_datos_clinicos());
alter policy rol_select  on public.admision_documentos       using (public.ve_datos_clinicos());
alter policy doc_select  on public.documentos                using (public.ve_datos_clinicos());
alter policy eval_select on public.evaluaciones              using (public.ve_datos_clinicos());
alter policy turnos_select on public.turnos                  using (public.ve_datos_clinicos());

-- Almacenamiento (bucket `documentos`): los archivos clínicos (DNI,
-- informes, estudios) y las fotos de la galería viven en el mismo bucket.
-- El CM solo puede leer y subir dentro de `galeria/`.
alter policy rol_doc_select on storage.objects
  using (bucket_id = 'documentos'
         and (public.ve_datos_clinicos() or (storage.foldername(name))[1] = 'galeria'));
alter policy rol_doc_insert on storage.objects
  with check (bucket_id = 'documentos'
              and (public.ve_datos_clinicos() or (storage.foldername(name))[1] = 'galeria'));
