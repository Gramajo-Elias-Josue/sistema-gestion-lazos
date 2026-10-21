-- =====================================================================
-- Evaluación / certificado (ocasional) — también para pacientes casuales
-- ---------------------------------------------------------------------
-- Pegá y ejecutá en: Supabase → SQL Editor. Es idempotente.
-- Requiere antes supabase-migracion-turnos-casuales.sql.
--
-- La "Evaluación / certificado" es un documento que se hace cuando
-- alguien lo pide (no es periódico como el informe mensual). Se guarda en
-- `evaluaciones` con tipo 'certificado':
--   - paciente habitual (con legajo): con su paciente_id, como un informe.
--   - paciente casual (sin legajo): SIN paciente, atado a su TURNO de la
--     agenda (turno_id). Va en `evaluaciones` y no en `turnos` porque es
--     el profesional quien la escribe, y la RLS solo le deja escribir acá.
-- =====================================================================

-- El certificado de un casual no tiene paciente cargado.
alter table public.evaluaciones alter column paciente_id drop not null;

-- Pero siempre es de alguien: de un paciente o de un turno.
alter table public.evaluaciones drop constraint if exists evaluaciones_de_quien_check;
alter table public.evaluaciones add constraint evaluaciones_de_quien_check
  check (paciente_id is not null or turno_id is not null);

-- Un solo certificado por turno casual (se edita, no se duplica).
create unique index if not exists evaluaciones_certificado_turno_uniq
  on public.evaluaciones (turno_id, tipo)
  where paciente_id is null;

-- Verificación: paciente_id tiene que figurar como nullable = YES.
select column_name, is_nullable
  from information_schema.columns
 where table_schema = 'public' and table_name = 'evaluaciones' and column_name = 'paciente_id';
