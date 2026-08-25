-- =====================================================================
-- Cumpleaños de profesionales (notificaciones de Inicio)
-- ---------------------------------------------------------------------
-- Pegá y ejecutá en: Supabase → SQL Editor. Es idempotente.
--
-- Los pacientes ya tienen fecha_nacimiento (se usa para calcular la edad
-- en el legajo). A los profesionales les falta esa columna: sin ella no
-- se puede avisar de su cumpleaños en el panel de Inicio.
-- =====================================================================

alter table public.profesionales add column if not exists fecha_nacimiento date;
