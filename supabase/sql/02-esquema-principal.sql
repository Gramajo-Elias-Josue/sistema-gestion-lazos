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

  -- ---------------------------------------------------------------------
  -- 8) GRILLA DE ATENCIÓN — paciente × sector → profesional y hora
  -- ---------------------------------------------------------------------
  -- Es la planilla del centro, la misma que se lleva en papel:
  --   - FILAS: los pacientes activos (salen solos de `pacientes`).
  --   - COLUMNAS: los SECTORES (Psicología, Fonoaudiología, T.O., …), que
  --     se pueden ampliar desde la app si aparece uno nuevo.
  --   - CELDA: el nombre del profesional que lo atiende. Se escribe A MANO,
  --     como en una planilla de Excel.
  -- La organización es fija y se repite todos los días, como el horario de
  -- una escuela.

  -- Los sectores son datos, no código: así se agrega una columna nueva sin
  -- tocar el sistema. Los cinco de siempre se cargan en el primer arranque.
  create table if not exists public.sectores (
    id       uuid primary key default gen_random_uuid(),
    clave    text not null unique,   -- psicologia, fono, to, …
    etiqueta text not null,          -- lo que se lee en la cabecera
    orden    int  not null default 0,
    activo   boolean not null default true
  );
  insert into public.sectores (clave, etiqueta, orden) values
    ('psicologia',     'Psicología',     1),
    ('fono',           'Fonoaudiología', 2),
    ('to',             'T.O.',           3),
    ('kinesiologia',   'Kinesiología',   4),
    ('psicopedagogia', 'Psicopedagogía', 5)
  on conflict (clave) do nothing;

  -- `asignaciones` (paciente ↔ profesional) pasa a ser la CELDA.
  alter table public.asignaciones
    add column if not exists sector             text,   -- columna de la grilla
    add column if not exists profesional_nombre text,   -- si se escribió a mano
    add column if not exists vigente_desde      date not null default current_date,
    add column if not exists vigente_hasta      date,   -- null = vigente hoy
    add column if not exists motivo_cierre      text;

  -- El profesional puede NO estar cargado en el sistema (se escribe el
  -- nombre libre, como en la planilla de papel), así que deja de ser
  -- obligatorio. Si está cargado se guarda el vínculo real.
  alter table public.asignaciones alter column profesional_id drop not null;

  -- Una sola celda vigente por paciente y sector (las cerradas no cuentan).
  create unique index if not exists asignaciones_celda_vigente
    on public.asignaciones (paciente_id, sector) where vigente_hasta is null;

  -- Al cambiar de profesional NO se edita la fila: se le pone vigente_hasta
  -- a la vieja y se crea una nueva. Así no se pierde con quién se atendía
  -- antes, y sus turnos y evaluaciones siguen apuntando a ese profesional.
  create index if not exists asignaciones_vigentes_idx
    on public.asignaciones (profesional_id) where vigente_hasta is null;

  -- Turno del paciente ("HS DE ASIST" en la planilla): mañana | tarde.
  alter table public.pacientes add column if not exists turno text;

  -- ---------------------------------------------------------------------
  -- 9) EVALUACIONES: SEPARAR LA DIARIA DE LOS INFORMES
  -- ---------------------------------------------------------------------
  -- Las dos cosas viven en `evaluaciones`, pero son distintas:
  --   - la evaluación DIARIA (opcional, texto suelto, la carga Evoluciones);
  --   - los INFORMES mensual / anual / evolución / admisión (obligatorios,
  --     JSON con título y cuerpo, los carga la historia clínica).
  --
  -- El único índice era (paciente, profesional, fecha), así que si un
  -- profesional cargaba la diaria y después el informe del MISMO paciente
  -- el MISMO día, el segundo PISABA al primero. Con `tipo` en la clave,
  -- cada cosa tiene su lugar y no se entreveran.
  alter table public.evaluaciones
    add column if not exists tipo text not null default 'diaria';

  -- Las evaluaciones ya cargadas: las que guardan JSON son informes (traen
  -- su tipo adentro); el resto es la evaluación diaria.
  update public.evaluaciones
    set tipo = coalesce(nullif((contenido::jsonb ->> 'tipo'), ''), 'diaria')
  where tipo = 'diaria'
    and contenido is not null
    and left(btrim(contenido), 1) = '{';

  -- Se reemplaza el índice viejo por uno que incluye el tipo.
  alter table public.evaluaciones
    drop constraint if exists evaluaciones_paciente_id_profesional_id_fecha_key;
  drop index if exists public.evaluaciones_unicas_idx;
  create unique index if not exists evaluaciones_unicas_idx
    on public.evaluaciones (paciente_id, profesional_id, fecha, tipo);
  create index if not exists evaluaciones_tipo_fecha_idx
    on public.evaluaciones (tipo, fecha);

  -- ---------------------------------------------------------------------
  -- 10) FOTOS DEL TRABAJO (galería para difusión) + rol CM
  -- ---------------------------------------------------------------------
  -- Rol nuevo 'cm' (community manager): entra SOLO a la galería, a buscar
  -- material para el contenido. No ve pacientes ni nada clínico.
  alter table public.perfiles drop constraint if exists perfiles_rol_check;
  alter table public.perfiles add constraint perfiles_rol_check
    check (rol in ('director','secretaria','profesional','cm'));

  -- Fotos del trabajo del mes. No cuelgan del paciente a propósito: son
  -- material de difusión, no historia clínica.
  -- Se borran solas a los 3 meses (ver utils/periodos.js): el material
  -- sirve para el contenido del momento y no tiene por qué acumularse.
  create table if not exists public.fotos_trabajo (
    id             uuid primary key default gen_random_uuid(),
    profesional_id uuid not null references public.profesionales(id) on delete cascade,
    periodo        text not null,            -- '2026-08': el mes que cubre
    storage_path   text not null,            -- archivo en el bucket 'documentos'
    nombre_archivo text,
    descripcion    text,
    created_at     timestamptz not null default now()
  );
  create index if not exists fotos_trabajo_periodo_idx on public.fotos_trabajo (periodo);
  create index if not exists fotos_trabajo_creada_idx  on public.fotos_trabajo (created_at);

  -- =====================================================================
  -- Después de esta migración, ejecutá supabase/sql/03-storage-y-acceso.sql para habilitar
  -- el acceso anónimo (RLS) sobre las tablas NUEVAS.
  -- =====================================================================
