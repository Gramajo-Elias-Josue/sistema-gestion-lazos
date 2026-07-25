-- =====================================================================
-- Roles y perfiles — Etapa 2 · Fase B (control de acceso por rol)
-- ---------------------------------------------------------------------
-- Pegá y ejecutá en: Supabase → SQL Editor.
--
-- Supabase Auth guarda al usuario (email + contraseña) pero NO sabe de
-- roles. Esta tabla `perfiles` linkea cada usuario con su rol:
--   director    -> acceso total (dueño del sistema).
--   secretaria  -> operativo casi completo (pacientes, agenda, admisión,
--                  informes, profesionales), SIN estadísticas ni usuarios.
--   profesional -> entra por el paciente (ver + cargar informes) y su agenda.
--
-- Ojo con el ORDEN: primero corré esto y cargá los perfiles; la RLS por
-- rol de las demás tablas (Fase C) se activa DESPUÉS, cuando el front ya
-- lee el rol y cada usuario tiene su fila (si no, se bloquean solos).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Tabla de perfiles
-- ---------------------------------------------------------------------
create table if not exists public.perfiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  nombre         text,
  rol            text not null default 'secretaria'
                   check (rol in ('director','secretaria','profesional')),
  -- Si el usuario es un profesional, a qué fila de `profesionales` mapea
  -- (sirve para "sus pacientes / su agenda"). Opcional.
  profesional_id bigint references public.profesionales(id) on delete set null,
  creado_en      timestamptz not null default now()
);

alter table public.perfiles enable row level security;

-- ---------------------------------------------------------------------
-- 2) Función rol_actual(): rol del usuario logueado
-- ---------------------------------------------------------------------
-- SECURITY DEFINER = corre con permisos del dueño de la función, así puede
-- leer `perfiles` SIN disparar sus políticas RLS (evita recursión) y se
-- puede reutilizar en las políticas de las demás tablas (Fase C).
create or replace function public.rol_actual()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select rol from public.perfiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- 3) Políticas de `perfiles`
-- ---------------------------------------------------------------------
drop policy if exists "perfil_propio_select" on public.perfiles;
drop policy if exists "perfil_director_all" on public.perfiles;

-- Cada usuario puede LEER su propio perfil (así el front conoce su rol).
create policy "perfil_propio_select" on public.perfiles
  for select to authenticated
  using (id = auth.uid());

-- El director puede leer y gestionar TODOS los perfiles (crear/editar/borrar).
create policy "perfil_director_all" on public.perfiles
  for all to authenticated
  using (public.rol_actual() = 'director')
  with check (public.rol_actual() = 'director');

-- ---------------------------------------------------------------------
-- 4) Bootstrap: el usuario admin ya creado pasa a ser DIRECTOR (dueño)
-- ---------------------------------------------------------------------
-- Cambiá el email si tu usuario admin es otro.
insert into public.perfiles (id, nombre, rol)
select id, 'Director', 'director'
  from auth.users
 where email = 'admin@lazos.test'
on conflict (id) do update set rol = 'director';

-- =====================================================================
-- Listo. El front ya puede leer el rol de cada usuario y mostrar/ocultar
-- las secciones. Para dar de alta más usuarios (secretaría, profesionales)
-- creá el usuario en Authentication → Users y agregá su fila acá, p. ej.:
--
--   insert into public.perfiles (id, nombre, rol)
--   select id, 'Ana (secretaría)', 'secretaria'
--     from auth.users where email = 'secretaria@lazos.test'
--   on conflict (id) do update set rol = excluded.rol;
-- =====================================================================
