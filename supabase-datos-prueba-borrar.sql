-- =====================================================================
-- Lazos — Borrar SOLO los datos de prueba
-- ---------------------------------------------------------------------
-- Pegá y ejecutá en: Supabase → SQL Editor.
--
-- Borra únicamente lo que cargó supabase-datos-prueba.sql (se reconoce
-- por sus marcas: DNI 90000001…90000024, emails @prueba.lazos.test,
-- convenios "Datos de prueba" y gastos de "Socio N (prueba)"). Lo que
-- hayas cargado a mano desde la app NO se toca, y los usuarios tampoco.
--
-- Si mientras probabas le creaste usuario a algún profesional de prueba,
-- su cuenta queda (desvinculada): borrala desde Administración.
-- =====================================================================

begin;

create temp table _pac_prueba on commit drop as
  select id from public.pacientes where dni between '90000001' and '90000024';
create temp table _prof_prueba on commit drop as
  select id from public.profesionales where email like '%@prueba.lazos.test';

-- Todo lo que cuelga de los pacientes o de los profesionales de prueba.
delete from public.evaluaciones
  where paciente_id in (select id from _pac_prueba) or profesional_id in (select id from _prof_prueba);
delete from public.turnos
  where paciente_id in (select id from _pac_prueba) or profesional_id in (select id from _prof_prueba);
delete from public.asignaciones
  where paciente_id in (select id from _pac_prueba) or profesional_id in (select id from _prof_prueba);
delete from public.asistencias          where paciente_id    in (select id from _pac_prueba);
delete from public.admision_documentos  where paciente_id    in (select id from _pac_prueba);
delete from public.documentos           where paciente_id    in (select id from _pac_prueba);
delete from public.contactos_emergencia where paciente_id    in (select id from _pac_prueba);
delete from public.facturacion          where paciente_id    in (select id from _pac_prueba);
delete from public.asistencias_profesionales where profesional_id in (select id from _prof_prueba);
delete from public.fotos_trabajo        where profesional_id in (select id from _prof_prueba);

-- Desvincular usuarios que hayan quedado atados a un profesional de prueba.
update public.perfiles set profesional_id = null
  where profesional_id in (select id from _prof_prueba);

delete from public.pacientes     where id in (select id from _pac_prueba);
delete from public.profesionales where id in (select id from _prof_prueba);
delete from public.convenios     where notas = 'Datos de prueba';
delete from public.gastos        where socio like 'Socio _ (prueba)';

commit;

-- Verificación: todo en 0.
select
  (select count(*) from public.pacientes where dni between '90000001' and '90000024') as pacientes,
  (select count(*) from public.profesionales where email like '%@prueba.lazos.test') as profesionales,
  (select count(*) from public.convenios where notas = 'Datos de prueba') as convenios,
  (select count(*) from public.gastos where socio like 'Socio _ (prueba)') as gastos;
