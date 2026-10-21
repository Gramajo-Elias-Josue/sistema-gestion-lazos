-- =====================================================================
-- CET Aguilares — Vaciar la base (datos de prueba)
-- ---------------------------------------------------------------------
-- Borra TODOS los datos de pacientes y del equipo, dejando las tablas
-- vacías para volver a cargar. NO borra las tablas ni las columnas.
--
-- Pegá y ejecutá en: Supabase → SQL Editor.
--
-- ⚠️  ACCIÓN IRREVERSIBLE. Borra pacientes, profesionales, documentos,
--     asistencias, turnos, informes, contactos, asignaciones,
--     facturación, gastos y convenios.
--
-- ✅ Por defecto NO toca los USUARIOS del sistema: las cuentas (auth.users)
--    y sus roles y permisos (perfiles) quedan intactos. Después de limpiar
--    entrás con el mismo usuario de siempre.
--
--    Si además querés borrar TODAS las cuentas menos una (dejar solo el
--    admin), hay un bloque aparte al final (paso 5), comentado por
--    defecto porque borrar cuentas de login es más difícil de deshacer
--    que vaciar datos: hay que activarlo a propósito.
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
--    NO se toca `sectores`: son las áreas fijas del centro (Psicología,
--    Fono, T.O., …), configuración del sistema, no datos de prueba.
truncate table
  public.evaluaciones,
  public.asistencias_profesionales,
  public.turnos,
  public.admision_documentos,
  public.asistencias,
  public.documentos,
  public.contactos_emergencia,
  public.asignaciones,
  public.facturacion,
  public.gastos,
  public.convenios,
  public.pacientes
restart identity cascade;

-- 3) Profesionales al final y con DELETE (ver la advertencia de arriba).
--    `fotos_trabajo` referencia profesional_id con "on delete cascade",
--    así que sus fotos del mes se borran solas acá, sin tocarla aparte.
delete from public.profesionales;

-- 4) Verificación: todo en 0, y al menos un usuario con rol director.
select
  (select count(*) from public.pacientes)      as pacientes,
  (select count(*) from public.profesionales)  as profesionales,
  (select count(*) from public.turnos)         as turnos,
  (select count(*) from public.fotos_trabajo)  as fotos_trabajo,
  (select count(*) from public.facturacion)    as facturacion,
  (select count(*) from public.gastos)         as gastos,
  (select count(*) from public.convenios)      as convenios,
  (select count(*) from public.perfiles)       as usuarios_conservados,
  (select count(*) from public.perfiles where rol = 'director') as directores;

-- =====================================================================
-- Los ARCHIVOS subidos no se borran desde acá. Si querés dejarlo todo
-- limpio, vaciá a mano los buckets en Storage:
--   · "documentos" — adjuntos de la historia clínica, informes en PDF
--                     y las fotos del trabajo del mes (galería)
--   · "avatares"   — fotos de perfil de los usuarios
-- =====================================================================

-- ---------------------------------------------------------------------
-- 5) OPCIONAL — Borrar TODOS los usuarios menos el admin
-- ---------------------------------------------------------------------
-- ⚠️  Comentado a propósito: esto SÍ borra cuentas de login (auth.users),
--     no solo datos. Es más difícil de deshacer que los pasos de arriba
--     (recrear un usuario implica volver a invitarlo/registrarlo).
--
-- Para usarlo: sacá los "--" de las 2 líneas de abajo y cambiá el email
-- por el que SÍ querés conservar (el admin). `perfiles` se borra solo
-- (referencia a auth.users con "on delete cascade"), y de paso arrastra
-- todo lo que ese usuario tuviera atado (por ejemplo, si era también un
-- profesional vinculado — no lo es en el flujo normal, pero por las dudas).
--
-- delete from auth.users
-- where email <> 'admin@lazos.test';   -- <-- cambiá esto por el email a conservar

-- Verificación (después de correr el delete de arriba): debería quedar 1.
-- select email, rol from public.perfiles;
-- =====================================================================
