-- =====================================================================
-- MIGRACIÓN: Grilla de atención por horario (columna = profesional)
-- ---------------------------------------------------------------------
-- Cambio de fondo en la Grilla de atención: deja de ser "paciente en
-- fila × sector en columna, con el profesional escrito a mano" y pasa a
-- ser "profesional en columna × franja horaria de 30 min en fila, con el
-- paciente asignado a esa franja" — como la planilla de organización de
-- turnos en papel que usa el centro.
--
-- Con esto:
--   - La celda ahora es el cruce (profesional_id, hora), no (paciente_id,
--     sector). Un profesional no puede tener dos pacientes en la misma
--     franja horaria.
--   - La columna deja de aceptar un profesional "escrito a mano": ahora
--     ES un profesional real cargado en el sistema (con su horario propio
--     en `profesionales.horario_entrada` / `horario_salida`, que ya
--     existía). Las filas viejas con `profesional_id` null (nombres
--     libres, "X") quedan como historia; no se tocan, simplemente ya no
--     aparecen en la grilla nueva.
--   - El paciente también deja de escribirse libre: se elige de los
--     cargados en el sistema.
--   - El campo `pacientes.turno` ("Hs de asist" mañana/tarde y, después,
--     una hora suelta) queda sin uso: ahora la hora vive en cada celda,
--     que puede ser distinta con cada profesional. No se borra la
--     columna (por si hay algo cargado), simplemente no la usa más nada.
--
-- Ejecutar UNA vez en el SQL Editor de Supabase.
-- =====================================================================

-- 1) La hora de la celda: el inicio de la franja de 30 minutos.
alter table public.asignaciones add column if not exists hora time;

-- 2) La celda vigente vieja era ÚNICA por (paciente, sector); ahora tiene
--    que ser única por (profesional, hora) — nadie puede atender a dos
--    pacientes en la misma franja. Se reemplaza el índice.
drop index if exists public.asignaciones_celda_vigente;

create unique index if not exists asignaciones_celda_vigente_horario
  on public.asignaciones (profesional_id, hora)
  where vigente_hasta is null and profesional_id is not null and hora is not null;

-- 3) Constraint vieja de la Etapa 1 (de antes de que existiera la
--    vigencia): UNIQUE(profesional_id, paciente_id) sin "where vigente_hasta
--    is null", o sea que valía para SIEMPRE, no solo mientras la celda
--    estuviera vigente. Con el modelo de reprogramar (cerrar la celda vieja
--    y crear una nueva cuando el paciente cambia de horario) esa pareja se
--    repite en el historial, y esta constraint lo rechaza con 409 aunque
--    la celda vieja ya esté cerrada. El índice nuevo (parcial, punto 2) ya
--    hace el trabajo real de "no duplicar mientras está vigente".
alter table public.asignaciones
  drop constraint if exists asignaciones_profesional_id_paciente_id_key;

-- Verificación rápida: tiene que aparecer la columna `hora`, el índice
-- nuevo (y ni el viejo `asignaciones_celda_vigente` ni la constraint
-- `asignaciones_profesional_id_paciente_id_key` deberían listarse más).
select column_name from information_schema.columns
  where table_schema = 'public' and table_name = 'asignaciones' and column_name = 'hora';
select indexname from pg_indexes
  where schemaname = 'public' and tablename = 'asignaciones';
