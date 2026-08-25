-- =====================================================================
-- Convenios, Facturación y Gastos
-- ---------------------------------------------------------------------
-- Pegá y ejecutá en: Supabase → SQL Editor. Es idempotente.
--
-- Tres tablas nuevas, todas SOLO para director / secretaría (ni siquiera
-- lectura para profesional o CM: es información de gestión de los dueños,
-- no clínica):
--   - convenios:    obras sociales con las que trabaja el centro. Por
--                    ahora solo el nombre y una nota; el resto de los
--                    datos se carga más adelante.
--   - facturacion:  estado de facturación de cada paciente POR MES (no
--                    facturado / facturado y no cobrado / facturado y
--                    cobrado). Es solo CONTROL, no genera facturas.
--   - gastos:        gastos del centro, cada uno atado a qué SOCIO lo
--                    pagó, para poder rendir cuentas entre los dueños
--                    (es una sociedad, no un solo dueño).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Convenios
-- ---------------------------------------------------------------------
create table if not exists public.convenios (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  notas       text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2) Facturación (estado por paciente y por mes)
--    paciente_id es UUID (como en el resto de la base: pacientes.id no
--    es bigint).
-- ---------------------------------------------------------------------
create table if not exists public.facturacion (
  id          uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  periodo     text not null,  -- 'yyyy-mm'
  estado      text not null default 'no_facturado'
              check (estado in ('no_facturado', 'facturado_no_cobrado', 'facturado_cobrado')),
  nota        text,
  updated_at  timestamptz not null default now(),
  unique (paciente_id, periodo)
);

-- ---------------------------------------------------------------------
-- 3) Gastos
-- ---------------------------------------------------------------------
create table if not exists public.gastos (
  id          uuid primary key default gen_random_uuid(),
  fecha       date not null,
  concepto    text not null,
  monto       numeric(12,2) not null,
  socio       text not null,   -- quién lo pagó (para rendir cuentas)
  categoria   text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4) RLS: SOLO director / secretaría (puede_operar), ni lectura para el
--    resto. Requiere que supabase-rls.sql ya haya creado puede_operar().
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['convenios', 'facturacion', 'gastos']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "solo_gestion" on public.%I;', t);
    execute format($f$
      create policy "solo_gestion" on public.%I
        for all to authenticated
        using (public.puede_operar())
        with check (public.puede_operar());
    $f$, t);
  end loop;
end $$;

-- =====================================================================
-- Listo. Convenios queda con la sección creada, sin datos todavía (se
-- cargan más adelante). Facturación y Gastos ya quedan operativos.
-- =====================================================================
