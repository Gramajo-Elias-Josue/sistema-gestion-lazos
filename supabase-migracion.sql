-- =====================================================================
-- Lazos — Migración de esquema (módulos Pacientes, Profesionales,
-- Admisión, Turnos, Asistencia de profesionales y Evaluaciones)
-- ---------------------------------------------------------------------
-- Re-ejecutable (idempotente). Pegá y ejecutá en: Supabase → SQL Editor.
-- Las tablas base (pacientes, profesionales, asistencias, documentos,
-- contactos_emergencia, asignaciones) ya existen; acá se EXTIENDEN y se
-- CREAN las nuevas tablas del rediseño.
--
-- IMPORTANTE: los id de las tablas base son UUID, así que las claves
-- foráneas nuevas (paciente_id, profesional_id, turno_id) también son
-- uuid, y los id de las tablas nuevas son uuid (gen_random_uuid()).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) PACIENTES
-- ---------------------------------------------------------------------
-- El paciente se identifica por DNI (se elimina el legajo).
alter table public.pacientes
  drop column if exists numero_legajo;

-- "¿Tiene CUD?" como dato del paciente (sí / no). El archivo del CUD se
-- sube luego como documento en la historia clínica.
alter table public.pacientes
  add column if not exists tiene_cud boolean not null default false;

-- Estado de ADMISIÓN: el paciente entra 'en_admision', se controla la
-- documentación presentada y recién al aprobar pasa a 'admitido'.
-- (El campo `estado` activo/inactivo sigue siendo la baja lógica.)
alter table public.pacientes
  add column if not exists estado_admision text not null default 'en_admision';

-- Backfill: pacientes que ya existían se consideran admitidos.
update public.pacientes
   set estado_admision = 'admitido'
 where estado_admision is null or estado_admision = 'en_admision';

-- Si ya tenía un documento de CUD, lo marcamos como "tiene CUD".
update public.pacientes p
   set tiene_cud = true
 where exists (
   select 1 from public.documentos d
    where d.paciente_id = p.id and d.tipo = 'cud'
 );

-- El DNI es el identificador del paciente: no se puede repetir.
create unique index if not exists pacientes_dni_uniq
  on public.pacientes (dni)
  where dni is not null;


-- ---------------------------------------------------------------------
-- 2) PROFESIONALES — datos de contacto + horario habitual
-- ---------------------------------------------------------------------
-- (Ya existen: nombre_completo, profesion, especialidad, matricula,
--  telefono, email, estado.) La matrícula es OPCIONAL (se controla en la
--  app, sin restricción NOT NULL).
alter table public.profesionales add column if not exists dni text;
alter table public.profesionales add column if not exists direccion text;
alter table public.profesionales add column if not exists telefono2 text;
alter table public.profesionales add column if not exists horario_entrada time;
alter table public.profesionales add column if not exists horario_salida time;


-- ---------------------------------------------------------------------
-- 3) ADMISIÓN — checklist de documentación presentada por paciente
-- ---------------------------------------------------------------------
create table if not exists public.admision_documentos (
  id            uuid primary key default gen_random_uuid(),
  paciente_id   uuid not null references public.pacientes(id) on delete cascade,
  requisito     text not null,
  presentado    boolean not null default false,
  observaciones text,
  created_at    timestamptz not null default now(),
  unique (paciente_id, requisito)
);
create index if not exists admision_documentos_paciente_idx
  on public.admision_documentos (paciente_id);


-- ---------------------------------------------------------------------
-- 4) TURNOS — citas paciente ↔ profesional por fecha
-- ---------------------------------------------------------------------
create table if not exists public.turnos (
  id             uuid primary key default gen_random_uuid(),
  paciente_id    uuid not null references public.pacientes(id) on delete cascade,
  profesional_id uuid not null references public.profesionales(id) on delete cascade,
  fecha          date not null,
  hora           time,
  estado         text not null default 'programado',  -- programado|atendido|ausente|cancelado
  observaciones  text,
  created_at     timestamptz not null default now()
);
create index if not exists turnos_fecha_idx on public.turnos (fecha);
create index if not exists turnos_profesional_fecha_idx on public.turnos (profesional_id, fecha);


-- ---------------------------------------------------------------------
-- 5) ASISTENCIAS DE PROFESIONALES — fichaje de entrada / salida
-- ---------------------------------------------------------------------
create table if not exists public.asistencias_profesionales (
  id             uuid primary key default gen_random_uuid(),
  profesional_id uuid not null references public.profesionales(id) on delete cascade,
  fecha          date not null,
  hora_entrada   time,
  hora_salida    time,
  estado         text not null default 'presente',  -- presente|ausente|licencia
  observaciones  text,
  created_at     timestamptz not null default now(),
  unique (profesional_id, fecha)
);
create index if not exists asis_prof_fecha_idx on public.asistencias_profesionales (fecha);


-- ---------------------------------------------------------------------
-- 6) EVALUACIONES — evaluación diaria del paciente por el profesional
-- ---------------------------------------------------------------------
create table if not exists public.evaluaciones (
  id             uuid primary key default gen_random_uuid(),
  paciente_id    uuid not null references public.pacientes(id) on delete cascade,
  profesional_id uuid not null references public.profesionales(id) on delete cascade,
  fecha          date not null,
  contenido      text,
  turno_id       uuid references public.turnos(id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (paciente_id, profesional_id, fecha)
);
create index if not exists evaluaciones_prof_fecha_idx on public.evaluaciones (profesional_id, fecha);
create index if not exists evaluaciones_pac_fecha_idx on public.evaluaciones (paciente_id, fecha);


-- ---------------------------------------------------------------------
-- 7) DOCUMENTOS — columnas usadas por la historia clínica (por si la
--    base es vieja). fecha_emision + numero.
-- ---------------------------------------------------------------------
alter table public.documentos add column if not exists fecha_emision date;
alter table public.documentos add column if not exists numero text;

-- El tipo de documento ya se valida en la app (el <select> tiene opciones
-- fijas). El CHECK de la base tenía una lista vieja que NO incluía 'informe'
-- (el PDF de los informes profesionales) y rechazaba el INSERT. Se recrea el
-- constraint con la lista completa y vigente de tipos.
alter table public.documentos drop constraint if exists documentos_tipo_check;
alter table public.documentos add constraint documentos_tipo_check
  check (tipo in (
    'cud', 'dni', 'certificado_medico', 'autorizacion_os', 'informe_escolar',
    'evaluacion', 'informe', 'estudios', 'consentimiento', 'otro'
  ));

-- =====================================================================
-- Después de esta migración, ejecutá supabase-setup.sql para habilitar
-- el acceso anónimo (RLS) sobre las tablas NUEVAS.
-- =====================================================================
