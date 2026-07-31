-- =====================================================================
-- CET Aguilares — Vaciar la base (datos de prueba)
-- ---------------------------------------------------------------------
-- Borra TODOS los datos de pacientes y del equipo, dejando las tablas
-- vacías para volver a cargar. NO borra las tablas ni las columnas.
--
-- Pegá y ejecutá en: Supabase → SQL Editor.
--
-- ⚠️  ACCIÓN IRREVERSIBLE. Borra pacientes, profesionales, documentos,
--     asistencias, turnos, informes, contactos y asignaciones.
--
-- ✅ NO toca los USUARIOS del sistema: las cuentas (auth.users) y sus
--    roles y permisos (perfiles) quedan intactos. Después de limpiar
--    entrás con el mismo usuario de siempre.
--
--    OJO: no uses `truncate … cascade` sobre `profesionales`. Como
--    `perfiles.profesional_id` la referencia, CASCADE arrastraría la
--    tabla `perfiles` y borraría los roles: con la RLS activa te quedás
--    sin permisos y sin poder arreglarlo desde la app. Por eso los
--    profesionales se borran con DELETE, que sí respeta el
--    "on delete set null" del perfil.
-- =====================================================================

-- 1) Desvincular los perfiles de sus profesionales (los usuarios quedan).
update public.perfiles set profesional_id = null;

-- 2) Vaciar los datos del centro. Estas tablas son todas "hijas" entre sí
--    y de pacientes; `restart identity` reinicia los contadores.
truncate table
  public.evaluaciones,
  public.asistencias_profesionales,
  public.turnos,
  public.admision_documentos,
  public.asistencias,
  public.documentos,
  public.contactos_emergencia,
  public.asignaciones,
  public.pacientes
restart identity cascade;

-- 3) Profesionales al final y con DELETE (ver la advertencia de arriba).
delete from public.profesionales;

-- 4) Verificación: todo en 0, y al menos un usuario con rol director.
select
  (select count(*) from public.pacientes)     as pacientes,
  (select count(*) from public.profesionales) as profesionales,
  (select count(*) from public.turnos)        as turnos,
  (select count(*) from public.perfiles)      as usuarios_conservados,
  (select count(*) from public.perfiles where rol = 'director') as directores;

-- =====================================================================
-- Los ARCHIVOS subidos no se borran desde acá. Si querés dejarlo todo
-- limpio, vaciá a mano los buckets en Storage:
--   · "documentos" — adjuntos de la historia clínica e informes en PDF
--   · "avatares"   — fotos de perfil de los usuarios
-- =====================================================================
