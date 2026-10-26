-- =====================================================================
-- Storage y activación de la seguridad (RLS)
-- ---------------------------------------------------------------------
-- Pegá y ejecutá en: Supabase → SQL Editor. Es re-ejecutable.
--
-- Crea el bucket privado "documentos" y ACTIVA la seguridad por fila en
-- las tablas. NO crea políticas: las que deciden quién puede qué están
-- todas en 04-seguridad-rls.sql (por rol, solo usuarios logueados).
--
-- Antes este script creaba políticas abiertas ("acceso_anon": cualquiera,
-- con o sin sesión, leía y escribía todo), de la época en que el sistema
-- no tenía login. Se sacaron: si se lo volvía a correr después del 04,
-- reabría toda la base, porque en Postgres las políticas se SUMAN.
-- =====================================================================

-- 1) TABLAS: seguridad por fila activada. Sin políticas, nadie accede por
--    la API hasta que el 04 cree las de cada rol.
do $$
declare t text;
begin
  foreach t in array array[
    'pacientes','contactos_emergencia','profesionales',
    'documentos','asistencias','asignaciones','sectores',
    'fotos_trabajo',
    'admision_documentos','turnos','asistencias_profesionales','evaluaciones'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security;', t);
    end if;
  end loop;
end $$;

-- 2) STORAGE: bucket "documentos" (privado). Ahí van los archivos de la
--    historia clínica, los PDF de los informes y las fotos de la galería.
--    Los archivos se ven con enlaces firmados que vencen.
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;

-- 3) Días de trabajo del profesional (columna agregada después).
alter table public.profesionales add column if not exists dias_trabajo text[] default array[]::text[];
