-- =====================================================================
-- Avatar del usuario (perfil)
-- ---------------------------------------------------------------------
-- Pegá y ejecutá en: Supabase → SQL Editor. Es idempotente.
--
-- Permite que cada usuario elija su avatar: uno de los predefinidos o una
-- foto propia.
--
-- SEGURIDAD (importante): NO se abre la tabla `perfiles` a la escritura del
-- propio usuario, porque entonces cualquiera podría cambiarse el `rol` a
-- 'director' y darse acceso total. En su lugar hay una función que sólo
-- toca la columna `avatar` de la fila de quien la llama.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Columna del avatar
-- ---------------------------------------------------------------------
-- Guarda: NULL           -> iniciales del nombre (lo de siempre)
--         'preset:clave' -> uno de los avatares predefinidos
--         'foto:ruta'    -> foto subida al bucket "avatares"
alter table public.perfiles add column if not exists avatar text;

-- ---------------------------------------------------------------------
-- 2) Función para cambiar el PROPIO avatar (y sólo eso)
-- ---------------------------------------------------------------------
create or replace function public.actualizar_mi_avatar(nuevo text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.perfiles set avatar = nuevo where id = auth.uid();
$$;

-- Cualquier usuario logueado puede cambiar su propio avatar.
revoke all on function public.actualizar_mi_avatar(text) from public;
grant execute on function public.actualizar_mi_avatar(text) to authenticated;

-- ---------------------------------------------------------------------
-- 3) Bucket "avatares" (para las fotos)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatares', 'avatares', false)
on conflict (id) do nothing;

drop policy if exists "avatar_select" on storage.objects;
drop policy if exists "avatar_insert" on storage.objects;
drop policy if exists "avatar_update" on storage.objects;
drop policy if exists "avatar_delete" on storage.objects;

-- Ver: cualquier usuario logueado (para mostrar el avatar de sus compañeros).
create policy "avatar_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatares');

-- Subir / reemplazar / borrar: SOLO dentro de la carpeta propia. La ruta es
-- "<id-del-usuario>/archivo", así que se compara la primera carpeta con el
-- id de quien llama: nadie puede pisar la foto de otro.
create policy "avatar_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatar_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatar_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================================
-- Listo. Cada usuario puede tocar su avatar (en el encabezado, arriba a la
-- derecha) y elegir uno predefinido o subir una foto.
-- =====================================================================
