-- =====================================================================
-- CET Aguilares — Vaciar la base (datos de prueba)
-- ---------------------------------------------------------------------
-- Borra TODOS los datos de las tablas, dejándolas vacías para volver a
-- cargar a mano. NO borra las tablas ni las columnas: solo las filas.
--
-- Pegá y ejecutá en: Supabase → SQL Editor.
--
-- ⚠️  ACCIÓN IRREVERSIBLE. Borra pacientes, profesionales, documentos,
--     asistencias, contactos y asignaciones. Asegurate de querer hacerlo.
--
-- `cascade` se encarga del orden de las claves foráneas (borra primero
-- las tablas hijas). `restart identity` reinicia los contadores de id.
-- =====================================================================

truncate table
  public.evaluaciones,
  public.asistencias_profesionales,
  public.turnos,
  public.admision_documentos,
  public.asistencias,
  public.documentos,
  public.contactos_emergencia,
  public.asignaciones,
  public.pacientes,
  public.profesionales
restart identity cascade;

-- Nota: los archivos subidos a Storage (bucket "documentos") NO se borran
-- desde acá. Si llegaste a subir alguno, eliminalo desde Storage →
-- documentos. (Hoy el bucket está vacío.)
