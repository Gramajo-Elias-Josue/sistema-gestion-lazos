-- =====================================================================
-- Fichaje en dos tramos: el profesional que trabaja mañana Y tarde
-- ---------------------------------------------------------------------
-- Pegá y ejecutá en: Supabase → SQL Editor. Es idempotente.
-- Requiere antes supabase/sql/16-fichaje-por-ubicacion.sql.
--
-- Hasta acá había UNA entrada y UNA salida por día: al que hace los dos
-- turnos no se le registraba el corte del mediodía (ni si a la tarde no
-- volvía). Ahora la MISMA fila del día tiene un segundo tramo:
--   tramo 1 (hora_entrada / hora_salida)     -> la mañana del que hace
--                                               los dos turnos, o el único
--                                               turno del que hace uno.
--   tramo 2 (hora_entrada_2 / hora_salida_2) -> la tarde del que hace los dos.
-- Sigue siendo UNA fila por profesional y día: estadísticas, % de
-- asistencia, calendario y disponibilidad no cambian. El estado
-- (presente / ausente / licencia) sigue siendo del día.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Columnas del segundo tramo
-- ---------------------------------------------------------------------
alter table public.asistencias_profesionales
  add column if not exists hora_entrada_2        time,
  add column if not exists hora_salida_2         time,
  add column if not exists entrada_2_por         text check (entrada_2_por in ('ubicacion', 'secretaria')),
  add column if not exists salida_2_por          text check (salida_2_por  in ('ubicacion', 'secretaria')),
  add column if not exists entrada_2_distancia_m integer,
  add column if not exists salida_2_distancia_m  integer;

-- ---------------------------------------------------------------------
-- 2) Trigger: la marca de origen ("ubicacion" / "secretaria") también
--    para el segundo tramo. Misma regla que en el 16: si la hora cambió,
--    la decide la base; si no cambió, se conserva.
-- ---------------------------------------------------------------------
create or replace function public.marcar_origen_fichaje()
returns trigger language plpgsql set search_path = public as $$
declare
  por_ubicacion boolean := coalesce(current_setting('lazos.fichaje', true), '') = 'ubicacion';
  marca text := case when por_ubicacion then 'ubicacion' else 'secretaria' end;
  es_alta boolean := tg_op = 'INSERT';
begin
  -- Tramo 1
  if es_alta or new.hora_entrada is distinct from old.hora_entrada then
    new.entrada_por := case when new.hora_entrada is null then null else marca end;
    if not por_ubicacion then new.entrada_distancia_m := null; end if;
  else
    new.entrada_por := old.entrada_por;
    new.entrada_distancia_m := old.entrada_distancia_m;
  end if;
  if es_alta or new.hora_salida is distinct from old.hora_salida then
    new.salida_por := case when new.hora_salida is null then null else marca end;
    if not por_ubicacion then new.salida_distancia_m := null; end if;
  else
    new.salida_por := old.salida_por;
    new.salida_distancia_m := old.salida_distancia_m;
  end if;

  -- Tramo 2
  if es_alta or new.hora_entrada_2 is distinct from old.hora_entrada_2 then
    new.entrada_2_por := case when new.hora_entrada_2 is null then null else marca end;
    if not por_ubicacion then new.entrada_2_distancia_m := null; end if;
  else
    new.entrada_2_por := old.entrada_2_por;
    new.entrada_2_distancia_m := old.entrada_2_distancia_m;
  end if;
  if es_alta or new.hora_salida_2 is distinct from old.hora_salida_2 then
    new.salida_2_por := case when new.hora_salida_2 is null then null else marca end;
    if not por_ubicacion then new.salida_2_distancia_m := null; end if;
  else
    new.salida_2_por := old.salida_2_por;
    new.salida_2_distancia_m := old.salida_2_distancia_m;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 3) fichar(): ahora también 'entrada_2' / 'salida_2' (la tarde)
-- ---------------------------------------------------------------------
-- Reglas (las mismas que habilitan los botones en la app):
--   entrada    -> si no fichó la mañana ni empezó la tarde.
--   salida     -> con la entrada de la mañana fichada, una vez.
--   entrada_2  -> solo quien hace los dos turnos; con la mañana cerrada
--                 (o sin mañana: vino solo a la tarde), una vez.
--   salida_2   -> con la entrada de la tarde fichada, una vez.
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
begin
  if que is null or que not in ('entrada', 'salida', 'entrada_2', 'salida_2') then
    raise exception 'Fichaje inválido.';
  end if;
  if prof is null then
    raise exception 'Tu usuario no está vinculado a un profesional. Avisale a la dirección.';
  end if;

  select coalesce('manana' = any(turnos_trabajo) and 'tarde' = any(turnos_trabajo), false)
    into doble from public.profesionales where id = prof;
  if que in ('entrada_2', 'salida_2') and not doble then
    raise exception 'Trabajás un solo turno: fichá con los botones de entrada y salida.';
  end if;

  -- 1) ¿Le corresponde fichar eso?
  select * into fila from public.asistencias_profesionales
   where profesional_id = prof and fecha = hoy
   for update;
  existe := found;  -- se guarda ya: cualquier PERFORM posterior pisa FOUND

  if existe and fila.estado <> 'presente' then
    raise exception 'Hoy figurás como "%" en la planilla. Si es un error, avisale a la secretaría.', fila.estado;
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
    -- Solo se llega acá con una entrada (de la mañana o de la tarde).
    insert into public.asistencias_profesionales (profesional_id, fecha, estado)
    values (prof, hoy, 'presente')
    returning * into fila;
  end if;

  if que = 'entrada' then
    update public.asistencias_profesionales set hora_entrada = ahora, entrada_distancia_m = dist
     where id = fila.id returning * into fila;
  elsif que = 'salida' then
    update public.asistencias_profesionales set hora_salida = ahora, salida_distancia_m = dist
     where id = fila.id returning * into fila;
  elsif que = 'entrada_2' then
    update public.asistencias_profesionales set hora_entrada_2 = ahora, entrada_2_distancia_m = dist
     where id = fila.id returning * into fila;
  else
    update public.asistencias_profesionales set hora_salida_2 = ahora, salida_2_distancia_m = dist
     where id = fila.id returning * into fila;
  end if;
  perform set_config('lazos.fichaje', '', true);
  return fila;
end;
$$;

-- ---------------------------------------------------------------------
-- 4) deshacer_salida(tramo): la de la mañana (1) o la de la tarde (2)
-- ---------------------------------------------------------------------
-- Solo la de HOY y solo si la fichó el propio profesional con su
-- ubicación. La de la mañana no se deshace si ya empezó la tarde.
drop function if exists public.deshacer_salida();

create or replace function public.deshacer_salida(tramo integer default 1)
returns public.asistencias_profesionales
language plpgsql security definer set search_path = public as $$
declare
  prof uuid := public.mi_profesional_id();
  fila public.asistencias_profesionales;
begin
  if prof is null then
    raise exception 'Tu usuario no está vinculado a un profesional. Avisale a la dirección.';
  end if;
  if tramo not in (1, 2) then
    raise exception 'Tramo inválido.';
  end if;
  select * into fila from public.asistencias_profesionales
   where profesional_id = prof and fecha = public.hoy_local()
   for update;

  if tramo = 1 then
    if not found or fila.hora_salida is null then
      raise exception 'Hoy no tenés una salida fichada para deshacer.';
    end if;
    if fila.salida_por is distinct from 'ubicacion' then
      raise exception 'La salida la cargó la secretaría: pedile a ella que la corrija.';
    end if;
    if fila.hora_entrada_2 is not null then
      raise exception 'Ya empezaste el turno tarde: la salida de la mañana ya no se puede deshacer.';
    end if;
    update public.asistencias_profesionales set hora_salida = null, salida_distancia_m = null
     where id = fila.id returning * into fila;
  else
    if not found or fila.hora_salida_2 is null then
      raise exception 'Hoy no tenés una salida de la tarde fichada para deshacer.';
    end if;
    if fila.salida_2_por is distinct from 'ubicacion' then
      raise exception 'La salida la cargó la secretaría: pedile a ella que la corrija.';
    end if;
    update public.asistencias_profesionales set hora_salida_2 = null, salida_2_distancia_m = null
     where id = fila.id returning * into fila;
  end if;
  return fila;
end;
$$;

revoke execute on function public.deshacer_salida(integer) from public, anon;
grant execute on function public.deshacer_salida(integer) to authenticated;

-- Verificación: tienen que aparecer las 6 columnas nuevas.
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'asistencias_profesionales' and column_name like '%\_2%'
 order by column_name;
