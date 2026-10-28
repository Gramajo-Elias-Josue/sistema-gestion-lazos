-- =====================================================================
-- Documentación de admisión y categorías de la historia clínica
-- ---------------------------------------------------------------------
-- Pegá y ejecutá en: Supabase → SQL Editor. Es idempotente.
-- Requiere antes supabase/sql/14-escritura-informes-y-documentos.sql.
--
-- Las dos listas estaban fijas en el código. Pasan a la base para que
-- dirección y secretaría las editen desde la app, como las profesiones:
--   - requisitos_admision: lo que se pide al admitir un paciente (DNI,
--     CUD, certificado médico…). Pestaña "Documentación" de Admisión.
--   - categorias_documento: las "carpetas" de la historia clínica (CUD,
--     Estudios, Escolar…). Pestaña "Categorías" de Pacientes.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Requisitos de admisión
-- ---------------------------------------------------------------------
-- No se borran: quitar uno lo deja inactivo (deja de pedirse), y lo ya
-- marcado en admisiones anteriores (admision_documentos.requisito) se
-- conserva. Si se vuelve a agregar, se reactiva.
create table if not exists public.requisitos_admision (
  id       uuid primary key default gen_random_uuid(),
  clave    text not null unique,
  etiqueta text not null,
  orden    integer not null default 0,
  activo   boolean not null default true
);

insert into public.requisitos_admision (clave, etiqueta, orden) values
  ('dni',                'DNI (copia)',                      1),
  ('cud',                'CUD (si tiene)',                   2),
  ('certificado_medico', 'Certificado médico',               3),
  ('estudios',           'Estudios / evaluaciones previas',  4),
  ('carnet_obra_social', 'Carnet de obra social',            5),
  ('informe_escolar',    'Informe escolar',                  6),
  ('consentimiento',     'Consentimiento informado firmado', 7)
on conflict (clave) do nothing;

alter table public.requisitos_admision enable row level security;
drop policy if exists "req_select" on public.requisitos_admision;
create policy "req_select" on public.requisitos_admision
  for select to authenticated using (public.ve_datos_clinicos());
drop policy if exists "req_escritura" on public.requisitos_admision;
create policy "req_escritura" on public.requisitos_admision
  for all to authenticated using (public.puede_operar()) with check (public.puede_operar());

-- ---------------------------------------------------------------------
-- 2) Categorías de la historia clínica
-- ---------------------------------------------------------------------
-- Cada documento pertenece a UNA categoría (documentos.tipo = clave).
-- Antes había "tipos" agrupados en categorías; se simplifica a una sola
-- elección. Una categoría con documentos no se puede borrar (la clave
-- foránea lo impide): primero hay que mover o borrar sus documentos.
create table if not exists public.categorias_documento (
  id     uuid primary key default gen_random_uuid(),
  clave  text not null unique,
  titulo text not null,
  icono  text not null default '📁',
  orden  integer not null default 0
);

insert into public.categorias_documento (clave, titulo, icono, orden) values
  ('cud',         'CUD',                     '🪪', 1),
  ('dni',         'DNI / Identificación',    '🆔', 2),
  ('estudios',    'Estudios y evaluaciones', '🔬', 3),
  ('historial',   'Historial médico',        '🩺', 4),
  ('obra_social', 'Obra social',             '📋', 5),
  ('escolar',     'Escolar',                 '🏫', 6),
  ('otros',       'Otros',                   '📁', 7)
on conflict (clave) do nothing;

-- Los tipos viejos pasan a la categoría que los agrupaba.
alter table public.documentos drop constraint if exists documentos_tipo_check;
update public.documentos set tipo = case tipo
    when 'evaluacion'         then 'estudios'
    when 'certificado_medico' then 'historial'
    when 'informe'            then 'historial'
    when 'autorizacion_os'    then 'obra_social'
    when 'informe_escolar'    then 'escolar'
    when 'consentimiento'     then 'otros'
    when 'otro'               then 'otros'
    else tipo
  end
 where tipo in ('evaluacion', 'certificado_medico', 'informe', 'autorizacion_os',
                'informe_escolar', 'consentimiento', 'otro');

alter table public.documentos drop constraint if exists documentos_tipo_fkey;
alter table public.documentos add constraint documentos_tipo_fkey
  foreign key (tipo) references public.categorias_documento (clave);

alter table public.categorias_documento enable row level security;
drop policy if exists "cat_select" on public.categorias_documento;
create policy "cat_select" on public.categorias_documento
  for select to authenticated using (public.ve_datos_clinicos());
drop policy if exists "cat_escritura" on public.categorias_documento;
create policy "cat_escritura" on public.categorias_documento
  for all to authenticated using (public.puede_operar()) with check (public.puede_operar());

-- CUD (aviso de vencimiento) e Historial médico (ahí se adjunta el PDF de
-- cada informe) los usa el sistema: no se pueden borrar. Sí renombrar.
create or replace function public.proteger_categorias_fijas()
returns trigger
language plpgsql
as $$
begin
  if old.clave in ('cud', 'historial') then
    raise exception 'La categoría "%" la usa el sistema y no se puede eliminar.', old.titulo;
  end if;
  return old;
end;
$$;

drop trigger if exists proteger_categorias_fijas on public.categorias_documento;
create trigger proteger_categorias_fijas
  before delete on public.categorias_documento
  for each row execute function public.proteger_categorias_fijas();
