-- =====================================================================
-- Tablas base (para instalar el sistema desde cero)
-- ---------------------------------------------------------------------
-- Pegá y ejecutá en: Supabase → SQL Editor, en un proyecto NUEVO. Es
-- re-ejecutable ("if not exists").
--
-- Estas seis tablas se crearon al principio del proyecto desde el panel
-- de Supabase, por eso no estaban en ningún script. Este archivo se armó
-- leyendo el esquema REAL de la base (tipos, claves, restricciones,
-- índices y triggers) para que el sistema se pueda instalar de cero solo
-- con lo que está en el repositorio.
--
-- Va con las columnas ORIGINALES: las que se sumaron después las agregan
-- los scripts 02 a 12 (en orden). Así cada script cuenta su parte de la
-- historia y ninguno pisa al otro.
-- =====================================================================

-- updated_at automático: se actualiza solo en cada UPDATE.
create or replace function public.update_updated_at_column()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Pacientes (legajo)
-- ---------------------------------------------------------------------
create table if not exists public.pacientes (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz default now(),
  updated_at         timestamptz default now(),
  nombre_completo    text not null,
  dni                text not null unique,
  fecha_nacimiento   date,
  domicilio          text,
  telefono           text,
  escuela            text,
  referente_familiar text,
  diagnostico        text,
  obra_social        text,
  numero_afiliado    text,
  fecha_ingreso      date,
  estado             text default 'activo' check (estado in ('activo', 'inactivo', 'baja'))
);

-- ---------------------------------------------------------------------
-- Profesionales (equipo)
-- ---------------------------------------------------------------------
create table if not exists public.profesionales (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  nombre_completo text not null,
  profesion       text,
  matricula       text,
  especialidad    text,
  telefono        text,
  email           text,
  estado          text default 'activo' check (estado in ('activo', 'inactivo'))
);

-- ---------------------------------------------------------------------
-- Contactos de emergencia del paciente
-- ---------------------------------------------------------------------
create table if not exists public.contactos_emergencia (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  paciente_id uuid references public.pacientes(id) on delete cascade,
  nombre      text,
  vinculo     text,
  telefono    text
);

-- ---------------------------------------------------------------------
-- Documentos de la historia clínica (el archivo va al Storage)
-- ---------------------------------------------------------------------
create table if not exists public.documentos (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  paciente_id       uuid references public.pacientes(id) on delete cascade,
  tipo              text,
  nombre_archivo    text,
  storage_path      text,
  fecha_vencimiento date,
  observaciones     text
);
create index if not exists idx_documentos_fecha_vencimiento on public.documentos (fecha_vencimiento);

-- ---------------------------------------------------------------------
-- Asistencia de pacientes (una por paciente y día)
-- ---------------------------------------------------------------------
create table if not exists public.asistencias (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  paciente_id    uuid references public.pacientes(id) on delete cascade,
  fecha          date not null,
  estado         text check (estado in ('presente', 'ausente', 'ausente_con_aviso', 'enfermedad')),
  observaciones  text,
  registrado_por uuid references public.profesionales(id),
  unique (paciente_id, fecha)
);
create index if not exists idx_asistencias_fecha on public.asistencias (fecha);

-- ---------------------------------------------------------------------
-- Asignaciones (las celdas de la grilla; 02 y 09 le suman vigencia,
-- sector y la hora de la franja)
-- ---------------------------------------------------------------------
create table if not exists public.asignaciones (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  profesional_id uuid not null references public.profesionales(id) on delete cascade,
  paciente_id    uuid references public.pacientes(id) on delete cascade,
  duracion_min   integer not null default 30
);

-- ---------------------------------------------------------------------
-- Triggers de updated_at
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['pacientes','profesionales','contactos_emergencia','documentos','asistencias','asignaciones']
  loop
    execute format('drop trigger if exists update_%s_updated_at on public.%I', t, t);
    execute format('create trigger update_%s_updated_at before update on public.%I
                    for each row execute function public.update_updated_at_column()', t, t);
  end loop;
end $$;

-- Seguir con 01-roles-y-perfiles.sql.
