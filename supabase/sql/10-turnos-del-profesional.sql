-- =====================================================================
-- Turnos del profesional: mañana (8 a 12) y/o tarde (14 a 18)
-- ---------------------------------------------------------------------
-- Pegá y ejecutá en: Supabase → SQL Editor. Es idempotente.
--
-- El centro trabaja en dos turnos fijos, como la clínica real. En vez de
-- un horario de entrada/salida libre, cada profesional tilda en qué turno
-- trabaja (uno o los dos). La Grilla de atención se separa en esas dos
-- pestañas, y el horario "habitual" del fichaje sale de acá.
--
-- `horario_entrada` / `horario_salida` quedan en la tabla (por si hay
-- algo cargado) pero la app ya no los usa.
-- =====================================================================

alter table public.profesionales
  add column if not exists turnos_trabajo text[] not null default '{}';

-- Backfill: a los que ya estaban cargados se les tilda el turno según su
-- horario viejo — si entraba antes del mediodía, mañana; si salía después
-- de las 14, tarde (los dos si cubría todo el día).
update public.profesionales
   set turnos_trabajo = array_remove(array[
         case when horario_entrada is not null and horario_entrada < '12:00' then 'manana' end,
         case when horario_salida  is not null and horario_salida  > '14:00' then 'tarde'  end
       ], null)
 where turnos_trabajo = '{}';

-- Verificación: los activos que quedaron sin turno (tildalo a mano desde
-- Profesionales → Editar; mientras tanto no aparecen en la grilla).
select nombre_completo, horario_entrada, horario_salida
  from public.profesionales
 where estado = 'activo' and turnos_trabajo = '{}';
