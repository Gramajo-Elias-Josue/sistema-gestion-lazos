-- =====================================================================
-- Estado por turno (quien trabaja mañana Y tarde)
-- ---------------------------------------------------------------------
-- Pegá y ejecutá en: Supabase → SQL Editor. Es idempotente.
-- Requiere antes supabase/sql/17-fichaje-doble-turno.sql.
--
-- Con el 17, el de doble turno ya fichaba dos tramos, pero el ESTADO
-- (presente / ausente / licencia) seguía siendo uno por día: si faltó a
-- la mañana y vino a la tarde, no había cómo registrarlo. Ahora:
--   estado_1 -> estado de la mañana (tramo 1)  } solo para doble turno;
--   estado_2 -> estado de la tarde  (tramo 2)  } null = sin marcar.
--   estado   -> el del DÍA. Para el de un turno, se carga como siempre.
--               Para el de doble turno lo calcula la base (trigger):
--               presente si vino a algún turno; si no, licencia o ausente.
-- Así todo lo que lee `estado` (estadísticas, % de asistencia, color del
-- calendario, "profesional presente" en los turnos) sigue igual.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Columnas
-- ---------------------------------------------------------------------
alter table public.asistencias_profesionales
  add column if not exists estado_1 text check (estado_1 in ('presente', 'ausente', 'licencia')),
  add column if not exists estado_2 text check (estado_2 in ('presente', 'ausente', 'licencia'));

-- ---------------------------------------------------------------------
-- 2) El estado del día a partir de los dos turnos
-- ---------------------------------------------------------------------
create or replace function public.resumir_estado_del_dia()
returns trigger language plpgsql set search_path = public as $$
begin
  -- Solo si se marcó algún turno (el de un solo turno no usa estas columnas).
  if new.estado_1 is not null or new.estado_2 is not null then
    new.estado := case
      when 'presente' in (new.estado_1, new.estado_2) then 'presente'
      when 'licencia' in (new.estado_1, new.estado_2) then 'licencia'
      else 'ausente'
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists resumir_estado_del_dia on public.asistencias_profesionales;
create trigger resumir_estado_del_dia
  before insert or update on public.asistencias_profesionales
  for each row execute function public.resumir_estado_del_dia();

revoke execute on function public.resumir_estado_del_dia() from public, anon;

-- ---------------------------------------------------------------------
-- 3) fichar(): el bloqueo por ausente / licencia ahora es POR TURNO
-- ---------------------------------------------------------------------
-- El de doble turno puede faltar a la mañana y fichar la tarde. Al fichar
-- un turno, ese turno queda "presente". Estado de un turno = su estado_n;
-- si no se marcó ningún turno, vale el del día (filas viejas).
create or replace function public.fichar(lat double precision, lng double precision, que text)
returns public.asistencias_profesionales
language plpgsql security definer set search_path = public as $$
declare
  prof   uuid := public.mi_profesional_id();
  conf   public.configuracion_centro;
  dist   integer;
  hoy    date := public.hoy_local();
  ahora  time := date_trunc('minute', now() at time zone 'America/Argentina/Buenos_Aires')::time;
  fila   public.asistencias_profesionales;
  existe boolean;
  doble  boolean;
  tramo  integer := case when que in ('entrada_2', 'salida_2') then 2 else 1 end;
  est    text;
begin
  if que is null or que not in ('entrada', 'salida', 'entrada_2', 'salida_2') then
    raise exception 'Fichaje inválido.';
  end if;
  if prof is null then
    raise exception 'Tu usuario no está vinculado a un profesional. Avisale a la dirección.';
  end if;

  select coalesce('manana' = any(turnos_trabajo) and 'tarde' = any(turnos_trabajo), false)
    into doble from public.profesionales where id = prof;
  if tramo = 2 and not doble then
    raise exception 'Trabajás un solo turno: fichá con los botones de entrada y salida.';
  end if;

  -- 1) ¿Le corresponde fichar eso?
  select * into fila from public.asistencias_profesionales
   where profesional_id = prof and fecha = hoy
   for update;
  existe := found;  -- se guarda ya: cualquier PERFORM posterior pisa FOUND

  if existe then
    est := case
      when not doble then fila.estado
      when fila.estado_1 is null and fila.estado_2 is null then fila.estado
      when tramo = 1 then fila.estado_1
      else fila.estado_2
    end;
    if est is not null and est <> 'presente' then
      raise exception '% figurás como "%" en la planilla. Si es un error, avisale a la secretaría.',
        case when not doble then 'Hoy' when tramo = 1 then 'Hoy a la mañana' else 'Hoy a la tarde' end, est;
    end if;
  end if;

  if que = 'entrada' then
    if existe and fila.hora_entrada is not null then
      raise exception 'Ya fichaste la entrada a las %.', to_char(fila.hora_entrada, 'HH24:MI');
    end if;
    if existe and fila.hora_entrada_2 is not null then
      raise exception 'Ya empezaste el turno tarde: la mañana ya no se puede fichar.';
    end if;
  elsif que = 'salida' then
    if not existe or fila.hora_entrada is null then
      raise exception 'Primero tenés que fichar la entrada.';
    end if;
    if fila.hora_salida is not null then
      raise exception 'Ya fichaste la salida a las %.', to_char(fila.hora_salida, 'HH24:MI');
    end if;
  elsif que = 'entrada_2' then
    if existe and fila.hora_entrada_2 is not null then
      raise exception 'Ya fichaste la entrada de la tarde a las %.', to_char(fila.hora_entrada_2, 'HH24:MI');
    end if;
    if existe and fila.hora_entrada is not null and fila.hora_salida is null then
      raise exception 'Primero fichá la salida de la mañana.';
    end if;
  else -- salida_2
    if not existe or fila.hora_entrada_2 is null then
      raise exception 'Primero tenés que fichar la entrada de la tarde.';
    end if;
    if fila.hora_salida_2 is not null then
      raise exception 'Ya fichaste la salida de la tarde a las %.', to_char(fila.hora_salida_2, 'HH24:MI');
    end if;
  end if;

  -- 2) ¿Está en el centro?
  select * into conf from public.configuracion_centro where id;
  if conf.latitud is null or conf.longitud is null then
    raise exception 'Todavía no está configurada la ubicación del centro. Avisale a la dirección.';
  end if;
  if lat is null or lng is null or lat not between -90 and 90 or lng not between -180 and 180 then
    raise exception 'No llegó tu ubicación. Probá de nuevo.';
  end if;
  dist := round(public.distancia_metros(lat, lng, conf.latitud, conf.longitud));
  if dist > conf.radio_m then
    raise exception 'Estás a % m del centro (se permite hasta % m). Para fichar tenés que estar en el centro.', dist, conf.radio_m;
  end if;

  -- 3) Se guarda. Bandera para el trigger: estas horas son "por ubicación".
  perform set_config('lazos.fichaje', 'ubicacion', true);
  if not existe then
    insert into public.asistencias_profesionales (profesional_id, fecha, estado)
    values (prof, hoy, 'presente')
    returning * into fila;
  end if;

  if que = 'entrada' then
    update public.asistencias_profesionales
       set hora_entrada = ahora, entrada_distancia_m = dist,
           estado_1 = case when doble then 'presente' else estado_1 end
     where id = fila.id returning * into fila;
  elsif que = 'salida' then
    update public.asistencias_profesionales set hora_salida = ahora, salida_distancia_m = dist
     where id = fila.id returning * into fila;
  elsif que = 'entrada_2' then
    update public.asistencias_profesionales
       set hora_entrada_2 = ahora, entrada_2_distancia_m = dist, estado_2 = 'presente'
     where id = fila.id returning * into fila;
  else
    update public.asistencias_profesionales set hora_salida_2 = ahora, salida_2_distancia_m = dist
     where id = fila.id returning * into fila;
  end if;
  perform set_config('lazos.fichaje', '', true);
  return fila;
end;
$$;

-- Verificación: tienen que aparecer estado_1 y estado_2.
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'asistencias_profesionales' and column_name in ('estado_1', 'estado_2');
