-- =====================================================================
-- Sector del profesional (enlazado a la columna de la grilla)
-- ---------------------------------------------------------------------
-- Pegá y ejecutá en: Supabase → SQL Editor. Es idempotente.
--
-- Hasta ahora `profesionales.profesion` era texto libre ("Psicología",
-- "Lic. en Psicologia", "psicologa"…) y la grilla adivinaba a qué columna
-- correspondía con un regex (utils/areas.js). Eso permitía cargar a un
-- psicólogo en la columna de Fonoaudiología por error de tipeo.
--
-- Esta columna nueva es la relación DE VERDAD: se elige de un desplegable
-- (los mismos `sectores` que arma las columnas de la grilla), no se
-- escribe a mano. `profesion` se conserva igual, como título libre para
-- mostrar (ej: "Kinesióloga deportiva").
-- =====================================================================

alter table public.profesionales
  add column if not exists sector text references public.sectores(clave);

-- Backfill: a los profesionales ya cargados se les completa el sector
-- adivinando con el mismo criterio que usaba utils/areas.js. Los que no
-- matchean ninguno (ej. "Musicoterapia") quedan en NULL: se asignan a
-- mano desde la pestaña "Profesiones" de Profesionales.
update public.profesionales
   set sector = case
     when profesion ~* 'psicolog'                              then 'psicologia'
     when profesion ~* 'fono'                                  then 'fono'
     when profesion ~* 'terapia\s*ocupacional' or profesion ~* '^\s*t\.?\s*o\.?\s*$' then 'to'
     when profesion ~* 'kine'                                  then 'kinesiologia'
     when profesion ~* 'psicopedagog'                          then 'psicopedagogia'
     else null
   end
 where sector is null
   and exists (select 1 from public.sectores s where s.clave = (case
     when profesion ~* 'psicolog'                              then 'psicologia'
     when profesion ~* 'fono'                                  then 'fono'
     when profesion ~* 'terapia\s*ocupacional' or profesion ~* '^\s*t\.?\s*o\.?\s*$' then 'to'
     when profesion ~* 'kine'                                  then 'kinesiologia'
     when profesion ~* 'psicopedagog'                          then 'psicopedagogia'
     else null
   end));

-- Verificación: cuántos quedaron sin sector (para asignar a mano).
select id, nombre_completo, profesion
  from public.profesionales
 where sector is null and estado = 'activo';

-- =====================================================================
-- Listo. El resto (el desplegable en "Nuevo profesional" y la pestaña
-- "Profesiones") es código, no necesita otro paso en la base.
-- =====================================================================
