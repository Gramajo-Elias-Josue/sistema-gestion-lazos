-- =====================================================================
-- Quién puede CREAR y EDITAR informes y documentos
-- ---------------------------------------------------------------------
-- Pegá y ejecutá en: Supabase → SQL Editor. Es idempotente.
-- Requiere antes supabase/sql/13-cm-sin-datos-clinicos.sql.
--
-- Hasta acá cualquier usuario con sesión podía crear y editar informes
-- (`with check (true)`) y agregar documentos a una historia clínica.
-- Eso dejaba que el CM cargara informes o documentos, y que un
-- profesional firmara con el nombre de otro o reescribiera informes
-- viejos. Ahora:
--   - Informes (evaluaciones): dirección y secretaría, como antes. El
--     profesional, solo los SUYOS y solo los del DÍA (igual que la app,
--     que deja corregir únicamente el informe de hoy).
--   - Documentos: todos menos el CM (el profesional adjunta el PDF de su
--     informe a la historia clínica).
-- =====================================================================

-- Fecha de hoy en Argentina. current_date usa la hora del servidor
-- (UTC): después de las 21 h ya sería "mañana" y bloquearía al
-- profesional que corrige el informe del día a la noche.
create or replace function public.hoy_local()
returns date
language sql
stable
set search_path = public
as $$
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date;
$$;

-- ¿El usuario puede escribir ESTE informe? Gestión: cualquiera. El
-- profesional: el suyo, del día.
create or replace function public.puede_escribir_informe(prof uuid, fecha date)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.puede_operar()
      or (prof is not null and prof = public.mi_profesional_id() and fecha = public.hoy_local());
$$;

-- Solo tiene sentido con sesión: sin sesión no se puede ni llamar.
revoke execute on function public.puede_escribir_informe(uuid, date) from public, anon;
grant execute on function public.puede_escribir_informe(uuid, date) to authenticated;

drop policy if exists "eval_insert" on public.evaluaciones;
create policy "eval_insert" on public.evaluaciones
  for insert to authenticated
  with check (public.puede_escribir_informe(profesional_id, fecha));

drop policy if exists "eval_update" on public.evaluaciones;
create policy "eval_update" on public.evaluaciones
  for update to authenticated
  using (public.puede_escribir_informe(profesional_id, fecha))
  with check (public.puede_escribir_informe(profesional_id, fecha));

alter policy "doc_insert" on public.documentos
  with check (public.ve_datos_clinicos());
