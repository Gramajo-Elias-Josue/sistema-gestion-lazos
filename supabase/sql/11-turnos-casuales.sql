-- =====================================================================
-- Agenda de turnos = SOLO pacientes casuales
-- ---------------------------------------------------------------------
-- Pegá y ejecutá en: Supabase → SQL Editor. Es idempotente.
--
-- Los pacientes fijos se organizan en la Grilla de atención (todos los
-- días a la misma hora). La sección Turnos queda para las consultas
-- sueltas de personas que NO tienen legajo: no pasan por Admisión, así
-- que su nombre, teléfono y DNI se anotan en el mismo turno.
-- =====================================================================

-- El turno casual no apunta a un paciente cargado.
alter table public.turnos alter column paciente_id drop not null;

alter table public.turnos add column if not exists paciente_nombre   text;
alter table public.turnos add column if not exists paciente_telefono text;
alter table public.turnos add column if not exists paciente_dni      text;

-- Todo turno tiene que decir de quién es: o un paciente cargado (los
-- viejos, hasta que se limpien) o el nombre de la persona casual.
alter table public.turnos drop constraint if exists turnos_quien_check;
alter table public.turnos add constraint turnos_quien_check
  check (paciente_id is not null or nullif(btrim(paciente_nombre), '') is not null);

-- Verificación: tienen que aparecer las tres columnas nuevas.
select column_name, is_nullable
  from information_schema.columns
 where table_schema = 'public' and table_name = 'turnos'
   and column_name in ('paciente_id', 'paciente_nombre', 'paciente_telefono', 'paciente_dni');
