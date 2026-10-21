-- =====================================================================
-- Limpiar la agenda: turnos de pacientes fijos + evaluaciones diarias
-- ---------------------------------------------------------------------
-- Pegá y ejecutá en: Supabase → SQL Editor, DESPUÉS de
-- supabase-migracion-turnos-casuales.sql.
--
-- ⚠️  ACCIÓN IRREVERSIBLE. Borra:
--   1) Los turnos de la agenda que apuntan a un paciente CARGADO (con
--      legajo). Desde ahora la agenda es solo para casuales sin legajo;
--      los fijos están en la Grilla de atención.
--   2) TODAS las evaluaciones DIARIAS.
--
-- NO toca: los informes (mensual, anual, evolución, admisión), los
-- turnos casuales nuevos, la grilla, la asistencia ni los pacientes.
--
-- Primero corré SOLO el bloque "0) Vista previa" para ver cuánto se va a
-- borrar; si está bien, corré el resto.
-- =====================================================================

-- 0) Vista previa (no borra nada).
select
  (select count(*) from public.turnos where paciente_id is not null)  as turnos_a_borrar,
  (select count(*) from public.evaluaciones where tipo = 'diaria')    as evaluaciones_diarias_a_borrar,
  (select count(*) from public.evaluaciones where tipo <> 'diaria')   as informes_que_quedan;

begin;

-- 1) Evaluaciones diarias.
delete from public.evaluaciones where tipo = 'diaria';

-- 2) Turnos de pacientes cargados. (Si algún informe quedara apuntando
--    a uno de esos turnos, `turno_id` pasa a null solo: "on delete set
--    null". El informe se conserva.)
delete from public.turnos where paciente_id is not null;

commit;

-- Verificación: los dos primeros en 0.
select
  (select count(*) from public.turnos where paciente_id is not null)  as turnos_de_pacientes_fijos,
  (select count(*) from public.evaluaciones where tipo = 'diaria')    as evaluaciones_diarias,
  (select count(*) from public.evaluaciones where tipo <> 'diaria')   as informes;
