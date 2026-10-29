-- =====================================================================
-- El fichaje del profesional, separado de la planilla de la secretaría
-- ---------------------------------------------------------------------
-- Pegá y ejecutá en: Supabase → SQL Editor. Es idempotente.
-- Requiere antes supabase/sql/18-estado-por-turno.sql.
--
-- Hasta acá el fichaje con ubicación y la planilla de la secretaría
-- escribían en la MISMA fila (asistencias_profesionales): la secretaría
-- podía pisar lo que fichó el profesional. Como los sueldos se pagan
-- comparando los dos registros, ahora van por separado:
--   asistencias_profesionales -> la planilla de la SECRETARÍA (como siempre).
--   fichajes_propios          -> lo que fichó el PROFESIONAL con su ubicación.
-- fichajes_propios la leen SOLO el propio profesional y la dirección
-- (la secretaría no la ve), y nadie la escribe directo: solo fichar() y
-- deshacer_salida(), que validan ubicación, hora y a nombre de quién.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) La tabla del fichaje propio (una fila por profesional y día)
-- ---------------------------------------------------------------------
create table if not exists public.fichajes_propios (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  profesional_id        uuid not null references public.profesionales(id) on delete cascade,
  fecha                 date not null,
  -- tramo 1: la mañana del que hace los dos turnos, o su único turno
  hora_entrada          time,
  hora_salida           time,
  entrada_distancia_m   integer,
  salida_distancia_m    integer,
  -- tramo 2: la tarde del que hace los dos turnos
  hora_entrada_2        time,
  hora_salida_2         time,
  entrada_2_distancia_m integer,
  salida_2_distancia_m  integer,
  unique (profesional_id, fecha)
);
create index if not exists fichajes_propios_fecha_idx on public.fichajes_propios (fecha);

drop trigger if exists update_fichajes_propios_updated_at on public.fichajes_propios;
create trigger update_fichajes_propios_updated_at before update on public.fichajes_propios
  for each row execute function public.update_updated_at_column();

-- Lectura: el propio profesional (lo suyo) y la dirección (todo).
-- Escritura: ninguna política -> nadie escribe por la API; solo las
-- funciones de abajo (security definer).
alter table public.fichajes_propios enable row level security;
drop policy if exists "fichaje_propio_select" on public.fichajes_propios;
create policy "fichaje_propio_select" on public.fichajes_propios
  for select to authenticated
  using (public.es_director() or profesional_id = public.mi_profesional_id());

-- ---------------------------------------------------------------------
-- 2) Lo que ya se había fichado con ubicación pasa a la tabla nueva, y
--    esas horas salen de la planilla de la secretaría (no las cargó ella).
-- ---------------------------------------------------------------------
insert into public.fichajes_propios (profesional_id, fecha,
  hora_entrada, hora_salida, entrada_distancia_m, salida_distancia_m,
  hora_entrada_2, hora_salida_2, entrada_2_distancia_m, salida_2_distancia_m)
select profesional_id, fecha,
  case when entrada_por = 'ubicacion' then hora_entrada end,
  case when salida_por = 'ubicacion' then hora_salida end,
  case when entrada_por = 'ubicacion' then entrada_distancia_m end,
  case when salida_por = 'ubicacion' then salida_distancia_m end,
  case when entrada_2_por = 'ubicacion' then hora_entrada_2 end,
  case when salida_2_por = 'ubicacion' then hora_salida_2 end,
  case when entrada_2_por = 'ubicacion' then entrada_2_distancia_m end,
  case when salida_2_por = 'ubicacion' then salida_2_distancia_m end
  from public.asistencias_profesionales
 where 'ubicacion' in (entrada_por, salida_por, entrada_2_por, salida_2_por)
on conflict (profesional_id, fecha) do nothing;

update public.asistencias_profesionales set
  hora_entrada   = case when entrada_por   = 'ubicacion' then null else hora_entrada end,
  hora_salida    = case when salida_por    = 'ubicacion' then null else hora_salida end,
  hora_entrada_2 = case when entrada_2_por = 'ubicacion' then null else hora_entrada_2 end,
  hora_salida_2  = case when salida_2_por  = 'ubicacion' then null else hora_salida_2 end
 where 'ubicacion' in (entrada_por, salida_por, entrada_2_por, salida_2_por);

-- ---------------------------------------------------------------------
-- 3) fichar(): ahora escribe en fichajes_propios
-- ---------------------------------------------------------------------
-- Mismas reglas que antes (16, 17, 18). Lo único que mira de la planilla
-- de la secretaría es el ESTADO: si ese turno figura ausente / licencia,
-- no se ficha.
-- Devuelve otro tipo de fila (fichajes_propios): hay que borrarla antes.
drop function if exists public.fichar(double precision, double precision, text);
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

  -- 1) ¿La secretaría lo marcó ausente / de licencia en ese turno?
  select * into planilla from public.asistencias_profesionales
   where profesional_id = prof and fecha = hoy;
  if found then
    est := case
      when not doble then planilla.estado
      when planilla.estado_1 is null and planilla.estado_2 is null then planilla.estado
      when tramo = 1 then planilla.estado_1
      else planilla.estado_2
    end;
    if est is not null and est <> 'presente' then
      raise exception '% figurás como "%" en la planilla. Si es un error, avisale a la secretaría.',
        case when not doble then 'Hoy' when tramo = 1 then 'Hoy a la mañana' else 'Hoy a la tarde' end, est;
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

-- ---------------------------------------------------------------------
-- 4) deshacer_salida(tramo): sobre su propio fichaje
-- ---------------------------------------------------------------------
-- Solo la de HOY. La de la mañana no se deshace si ya empezó la tarde.
drop function if exists public.deshacer_salida(integer);
create or replace function public.deshacer_salida(tramo integer default 1)
returns public.fichajes_propios
language plpgsql security definer set search_path = public as $$
declare
  prof uuid := public.mi_profesional_id();
  fila public.fichajes_propios;
begin
  if prof is null then
    raise exception 'Tu usuario no está vinculado a un profesional. Avisale a la dirección.';
  end if;
  if tramo not in (1, 2) then
    raise exception 'Tramo inválido.';
  end if;
  select * into fila from public.fichajes_propios
   where profesional_id = prof and fecha = public.hoy_local()
   for update;

  if tramo = 1 then
    if not found or fila.hora_salida is null then
      raise exception 'Hoy no tenés una salida fichada para deshacer.';
    end if;
    if fila.hora_entrada_2 is not null then
      raise exception 'Ya empezaste el turno tarde: la salida de la mañana ya no se puede deshacer.';
    end if;
    update public.fichajes_propios set hora_salida = null, salida_distancia_m = null
     where id = fila.id returning * into fila;
  else
    if not found or fila.hora_salida_2 is null then
      raise exception 'Hoy no tenés una salida de la tarde fichada para deshacer.';
    end if;
    update public.fichajes_propios set hora_salida_2 = null, salida_2_distancia_m = null
     where id = fila.id returning * into fila;
  end if;
  return fila;
end;
$$;

revoke execute on function public.fichar(double precision, double precision, text) from public, anon;
grant execute on function public.fichar(double precision, double precision, text) to authenticated;
revoke execute on function public.deshacer_salida(integer) from public, anon;
grant execute on function public.deshacer_salida(integer) to authenticated;

-- Verificación: lo que se pasó a la tabla nueva.
select profesional_id, fecha, hora_entrada, hora_salida, hora_entrada_2, hora_salida_2
  from public.fichajes_propios order by fecha desc limit 10;
