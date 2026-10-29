-- =====================================================================
-- Fichaje del profesional por ubicación
-- ---------------------------------------------------------------------
-- Pegá y ejecutá en: Supabase → SQL Editor. Es idempotente.
-- Requiere antes supabase/sql/14-escritura-informes-y-documentos.sql
-- (usa hoy_local()).
--
-- El profesional ficha su propia entrada y salida desde el celular. No
-- elige la hora: la pone la BASE (hora de Argentina del servidor), y solo
-- se acepta si está cerca del centro. La ubicación del centro y el radio
-- los configura el director en Administración.
--
-- Todo se decide acá y no en la app: la función fichar() es la única
-- puerta. Calcula la distancia, usa su propia hora y registra a nombre
-- del usuario logueado (nadie puede fichar por otro).
--
-- La planilla de la secretaría (Asistencia → Profesionales) sigue igual,
-- como respaldo. Cada hora queda marcada con quién la cargó: un trigger
-- pone "ubicacion" o "secretaria" y la app no lo puede falsear.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Ubicación del centro (una sola fila)
-- ---------------------------------------------------------------------
create table if not exists public.configuracion_centro (
  id          boolean primary key default true check (id),  -- fuerza una única fila
  latitud     double precision check (latitud between -90 and 90),
  longitud    double precision check (longitud between -180 and 180),
  radio_m     integer not null default 100 check (radio_m between 20 and 2000),
  updated_at  timestamptz not null default now()
);
insert into public.configuracion_centro (id) values (true) on conflict (id) do nothing;

alter table public.configuracion_centro enable row level security;
drop policy if exists "conf_select" on public.configuracion_centro;
create policy "conf_select" on public.configuracion_centro
  for select to authenticated using (true);
drop policy if exists "conf_escritura" on public.configuracion_centro;
create policy "conf_escritura" on public.configuracion_centro
  for update to authenticated
  using (public.es_director()) with check (public.es_director());

-- ---------------------------------------------------------------------
-- 2) Quién cargó cada hora (y a qué distancia, si fue por ubicación)
-- ---------------------------------------------------------------------
alter table public.asistencias_profesionales
  add column if not exists entrada_por         text check (entrada_por in ('ubicacion', 'secretaria')),
  add column if not exists salida_por          text check (salida_por  in ('ubicacion', 'secretaria')),
  add column if not exists entrada_distancia_m integer,
  add column if not exists salida_distancia_m  integer;

-- Si la hora cambió, la marca la decide la BASE: "ubicacion" solo cuando
-- viene de fichar() (que prende una bandera interna, invisible para la
-- API); cualquier otro cambio es de la secretaría. Si la hora no cambió,
-- se conserva la marca que tenía.
create or replace function public.marcar_origen_fichaje()
returns trigger language plpgsql set search_path = public as $$
declare
  por_ubicacion boolean := coalesce(current_setting('lazos.fichaje', true), '') = 'ubicacion';
begin
  if tg_op = 'INSERT' or new.hora_entrada is distinct from old.hora_entrada then
    new.entrada_por := case when new.hora_entrada is null then null
                            when por_ubicacion then 'ubicacion' else 'secretaria' end;
    if not por_ubicacion then new.entrada_distancia_m := null; end if;
  else
    new.entrada_por := old.entrada_por;
    new.entrada_distancia_m := old.entrada_distancia_m;
  end if;

  if tg_op = 'INSERT' or new.hora_salida is distinct from old.hora_salida then
    new.salida_por := case when new.hora_salida is null then null
                           when por_ubicacion then 'ubicacion' else 'secretaria' end;
    if not por_ubicacion then new.salida_distancia_m := null; end if;
  else
    new.salida_por := old.salida_por;
    new.salida_distancia_m := old.salida_distancia_m;
  end if;
  return new;
end;
$$;

drop trigger if exists marcar_origen_fichaje on public.asistencias_profesionales;
create trigger marcar_origen_fichaje
  before insert or update on public.asistencias_profesionales
  for each row execute function public.marcar_origen_fichaje();

-- ---------------------------------------------------------------------
-- 3) Distancia en metros entre dos puntos (fórmula de Haversine)
-- ---------------------------------------------------------------------
create or replace function public.distancia_metros(lat1 double precision, lng1 double precision,
                                                   lat2 double precision, lng2 double precision)
returns double precision language sql immutable set search_path = public as $$
  select 2 * 6371000 * asin(sqrt(
           power(sin(radians(lat2 - lat1) / 2), 2)
         + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)));
$$;

-- ---------------------------------------------------------------------
-- 4) fichar(): la única puerta del fichaje por ubicación
-- ---------------------------------------------------------------------
-- `que` = 'entrada' o 'salida' (un botón para cada una en la app). Cada
-- una se ficha UNA vez por día, y la salida recién después de la entrada.
-- Si la salida se fichó por error, se deshace con deshacer_salida().
-- Devuelve la fila del día. Los mensajes de error son para el usuario.
-- (La primera versión recibía solo lat/lng y adivinaba cuál tocaba.)
drop function if exists public.fichar(double precision, double precision);

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
begin
  if que is null or que not in ('entrada', 'salida') then
    raise exception 'Fichaje inválido: tiene que ser la entrada o la salida.';
  end if;
  if prof is null then
    raise exception 'Tu usuario no está vinculado a un profesional. Avisale a la dirección.';
  end if;

  -- 1) ¿Le corresponde fichar eso? (antes que la ubicación: si ya fichó,
  --    el aviso es ese, esté donde esté)
  select * into fila from public.asistencias_profesionales
   where profesional_id = prof and fecha = hoy
   for update;
  existe := found;  -- se guarda ya: cualquier PERFORM posterior pisa FOUND

  if existe and fila.estado <> 'presente' then
    raise exception 'Hoy figurás como "%" en la planilla. Si es un error, avisale a la secretaría.', fila.estado;
  end if;
  if que = 'entrada' and existe and fila.hora_entrada is not null then
    raise exception 'Ya fichaste la entrada a las %.', to_char(fila.hora_entrada, 'HH24:MI');
  end if;
  if que = 'salida' and (not existe or fila.hora_entrada is null) then
    raise exception 'Primero tenés que fichar la entrada.';
  end if;
  if que = 'salida' and fila.hora_salida is not null then
    raise exception 'Ya fichaste la salida a las %.', to_char(fila.hora_salida, 'HH24:MI');
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
  if que = 'entrada' and not existe then
    insert into public.asistencias_profesionales (profesional_id, fecha, estado, hora_entrada, entrada_distancia_m)
    values (prof, hoy, 'presente', ahora, dist)
    returning * into fila;
  elsif que = 'entrada' then
    update public.asistencias_profesionales
       set hora_entrada = ahora, entrada_distancia_m = dist
     where id = fila.id
    returning * into fila;
  else
    update public.asistencias_profesionales
       set hora_salida = ahora, salida_distancia_m = dist
     where id = fila.id
    returning * into fila;
  end if;
  perform set_config('lazos.fichaje', '', true);
  return fila;
end;
$$;

-- ---------------------------------------------------------------------
-- 5) deshacer_salida(): por si la salida se fichó por error
-- ---------------------------------------------------------------------
-- Solo la de HOY y solo si la fichó el propio profesional con su
-- ubicación (si la cargó la secretaría, la corrige ella en la planilla).
-- La hora vuelve a quedar vacía: el trigger borra también la marca de
-- origen, y en el Inicio vuelve a aparecer el recordatorio de la salida.
create or replace function public.deshacer_salida()
returns public.asistencias_profesionales
language plpgsql security definer set search_path = public as $$
declare
  prof uuid := public.mi_profesional_id();
  fila public.asistencias_profesionales;
begin
  if prof is null then
    raise exception 'Tu usuario no está vinculado a un profesional. Avisale a la dirección.';
  end if;
  select * into fila from public.asistencias_profesionales
   where profesional_id = prof and fecha = public.hoy_local()
   for update;
  if not found or fila.hora_salida is null then
    raise exception 'Hoy no tenés una salida fichada para deshacer.';
  end if;
  if fila.salida_por is distinct from 'ubicacion' then
    raise exception 'La salida la cargó la secretaría: pedile a ella que la corrija.';
  end if;
  update public.asistencias_profesionales
     set hora_salida = null, salida_distancia_m = null
   where id = fila.id
  returning * into fila;
  return fila;
end;
$$;

-- Solo con sesión. distancia_metros y el trigger no se llaman desde afuera.
revoke execute on function public.fichar(double precision, double precision, text) from public, anon;
grant execute on function public.fichar(double precision, double precision, text) to authenticated;
revoke execute on function public.deshacer_salida() from public, anon;
grant execute on function public.deshacer_salida() to authenticated;
revoke execute on function public.distancia_metros(double precision, double precision, double precision, double precision) from public, anon;
revoke execute on function public.marcar_origen_fichaje() from public, anon;

-- Verificación: la fila de configuración (latitud/longitud vacías hasta
-- que el director las cargue en Administración).
select * from public.configuracion_centro;
