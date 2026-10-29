-- =====================================================================
-- Fichaje independiente de la planilla (solo la licencia lo bloquea)
-- ---------------------------------------------------------------------
-- Pegá y ejecutá en: Supabase → SQL Editor. Es idempotente.
-- Requiere antes supabase/sql/19-fichaje-propio-separado.sql.
--
-- Hasta acá, si la secretaría marcaba al profesional "ausente" en su
-- planilla, fichar() no lo dejaba fichar. Pero el sentido de tener dos
-- registros es que sean INDEPENDIENTES: si la planilla dice ausente y el
-- profesional fichó, esa diferencia es justamente lo que la dirección
-- tiene que ver en el Control de horas. Por eso ahora solo bloquea la
-- LICENCIA (un día que el profesional no trabaja por un motivo ya
-- informado); "ausente" ya no.
-- =====================================================================

create or replace function public.fichar(lat double precision, lng double precision, que text)
returns public.fichajes_propios
language plpgsql security definer set search_path = public as $$
declare
  prof    uuid := public.mi_profesional_id();
  conf    public.configuracion_centro;
  dist    integer;
  hoy     date := public.hoy_local();
  ahora   time := date_trunc('minute', now() at time zone 'America/Argentina/Buenos_Aires')::time;
  fila    public.fichajes_propios;
  planilla public.asistencias_profesionales;
  existe  boolean;
  doble   boolean;
  tramo   integer := case when que in ('entrada_2', 'salida_2') then 2 else 1 end;
  est     text;
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

  -- 1) ¿La secretaría le cargó LICENCIA en ese turno? (ausente no bloquea:
  --    los dos registros son independientes y se comparan después)
  select * into planilla from public.asistencias_profesionales
   where profesional_id = prof and fecha = hoy;
  if found then
    est := case
      when not doble then planilla.estado
      when planilla.estado_1 is null and planilla.estado_2 is null then planilla.estado
      when tramo = 1 then planilla.estado_1
      else planilla.estado_2
    end;
    if est = 'licencia' then
      raise exception '% figurás de licencia en la planilla. Si es un error, avisale a la secretaría.',
        case when not doble then 'Hoy' when tramo = 1 then 'Hoy a la mañana' else 'Hoy a la tarde' end;
    end if;
  end if;

  -- 2) ¿Le corresponde fichar eso? (según su propio fichaje del día)
  select * into fila from public.fichajes_propios
   where profesional_id = prof and fecha = hoy
   for update;
  existe := found;

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

  -- 3) ¿Está en el centro?
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

  -- 4) Se guarda en SU fichaje (la planilla de la secretaría no se toca).
  if not existe then
    insert into public.fichajes_propios (profesional_id, fecha) values (prof, hoy)
    returning * into fila;
  end if;
  if que = 'entrada' then
    update public.fichajes_propios set hora_entrada = ahora, entrada_distancia_m = dist
     where id = fila.id returning * into fila;
  elsif que = 'salida' then
    update public.fichajes_propios set hora_salida = ahora, salida_distancia_m = dist
     where id = fila.id returning * into fila;
  elsif que = 'entrada_2' then
    update public.fichajes_propios set hora_entrada_2 = ahora, entrada_2_distancia_m = dist
     where id = fila.id returning * into fila;
  else
    update public.fichajes_propios set hora_salida_2 = ahora, salida_2_distancia_m = dist
     where id = fila.id returning * into fila;
  end if;
  return fila;
end;
$$;

revoke execute on function public.fichar(double precision, double precision, text) from public, anon;
grant execute on function public.fichar(double precision, double precision, text) to authenticated;
