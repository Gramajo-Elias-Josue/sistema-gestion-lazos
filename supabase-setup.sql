-- =====================================================================
-- CET Aguilares — Configuración de acceso en Supabase
-- ---------------------------------------------------------------------
-- Pegá y ejecutá este script en: Supabase → SQL Editor.
--
-- El frontend usa la clave pública (rol "anon"), por lo que estas
-- políticas habilitan ese acceso. Cuando se incorpore autenticación,
-- se reemplazan por políticas RLS atadas al rol de cada usuario.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) TABLAS — habilitar RLS y permitir el acceso al rol anónimo
-- ---------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'pacientes','contactos_emergencia','profesionales',
    'documentos','asistencias','asignaciones',
    'admision_documentos','turnos','asistencias_profesionales','evaluaciones'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    -- Borra las políticas si ya existían (permite re-ejecutar el script).
    execute format('drop policy if exists "etapa1_anon_all" on public.%I;', t);
    execute format('drop policy if exists "acceso_anon" on public.%I;', t);
    -- Política abierta: lectura y escritura para anon y authenticated.
    execute format($f$
      create policy "acceso_anon" on public.%I
        for all
        to anon, authenticated
        using (true)
        with check (true);
    $f$, t);
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- 2) STORAGE — bucket "documentos"
-- ---------------------------------------------------------------------
-- Crea el bucket si no existe (privado). También se puede crear a mano
-- desde Storage → New bucket, con el nombre exacto "documentos".
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;

-- Políticas del bucket para el rol anónimo (subir, ver, borrar).
-- Se borran también los nombres viejos, por si quedaron de una
-- ejecución anterior del script.
drop policy if exists "etapa1_doc_select" on storage.objects;
drop policy if exists "etapa1_doc_insert" on storage.objects;
drop policy if exists "etapa1_doc_delete" on storage.objects;
drop policy if exists "acceso_doc_select" on storage.objects;
drop policy if exists "acceso_doc_insert" on storage.objects;
drop policy if exists "acceso_doc_delete" on storage.objects;

create policy "acceso_doc_select" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'documentos');

create policy "acceso_doc_insert" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'documentos');

create policy "acceso_doc_delete" on storage.objects
  for delete to anon, authenticated
  using (bucket_id = 'documentos');

-- =====================================================================
-- Listo. Con esto el frontend puede leer y escribir datos, y subir o
-- consultar documentos del bucket.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 3) MIGRACIONES EXTRA (Evolución de base de datos)
-- ---------------------------------------------------------------------
-- Agrega los días de trabajo del profesional (Etapa 1.5).
ALTER TABLE public.profesionales ADD COLUMN IF NOT EXISTS dias_trabajo text[] DEFAULT ARRAY[]::text[];
