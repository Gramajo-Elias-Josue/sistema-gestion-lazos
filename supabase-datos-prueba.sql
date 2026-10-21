-- =====================================================================
-- Lazos — Datos de prueba (para probar el sistema "como si fuera real")
-- ---------------------------------------------------------------------
-- Pegá y ejecutá en: Supabase → SQL Editor. Corre TODO junto en un solo
-- bloque: si algo falla, no queda nada a medias.
-- Requiere antes supabase-migracion-turnos-profesional.sql (columna
-- `turnos_trabajo`) y supabase-migracion-turnos-casuales.sql (turnos de
-- personas sin legajo).
--
-- Carga:
--   · 7 profesionales (uno por profesión, mañana y tarde), uno con
--     cumpleaños en 2 días (para ver el aviso de Inicio).
--   · 24 pacientes: 20 admitidos y activos, 1 dado de baja y 3 en
--     admisión (con el checklist a medio completar). Uno cumple años hoy.
--   · Grilla de atención armada (cada profesional con sus franjas): los
--     pacientes FIJOS.
--   · Turnos CASUALES (personas sin legajo) de la semana pasada y la que
--     viene, solo en franjas libres de la grilla.
--   · Asistencia de pacientes y fichaje de profesionales del último mes
--     (HOY queda sin marcar, para probar marcarlo a mano).
--   · Informes mensuales (el mes anterior completo; el actual le falta a
--     algunos, para ver "quién debe").
--   · CUD con vencimientos (uno vencido y algunos por vencer).
--   · Convenios, facturación de los últimos 3 meses y gastos.
--
-- NO carga: usuarios de login, fotos de la galería ni archivos (eso
-- necesita Storage; se prueba desde la app).
--
-- Cómo se reconocen los datos de prueba (para borrarlos después con
-- supabase-datos-prueba-borrar.sql):
--   · pacientes con DNI 90000001 … 90000024
--   · profesionales con email …@prueba.lazos.test
--   · convenios con nota "Datos de prueba"
--   · gastos pagados por "Socio 1 (prueba)" / "Socio 2 (prueba)"
-- =====================================================================

do $$
declare
  hoy    date := current_date;
  dias   text[] := array['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  v_prof uuid[];
  v_pac  uuid[];
  p      int;
  s      int;
  idx    int;
  off    int;
  v_sec  text;
  v_tur  text[];
  v_dias text[];
  v_fecha date;   -- no llamarlo "d": choca con el alias de generate_series(...) as d
  v_n    int := 0;
  v_trn  record;  -- no llamarlo "t": choca con el alias de "from public.turnos t"
begin
  if exists (select 1 from public.pacientes where dni between '90000001' and '90000024') then
    raise exception 'Los datos de prueba ya están cargados. Si querés recargarlos, corré primero supabase-datos-prueba-borrar.sql.';
  end if;

  -- Para que cada corrida genere los mismos datos "al azar".
  perform setseed(0.42);

  -- Las profesiones de siempre (por si la tabla quedó vacía).
  insert into public.sectores (clave, etiqueta, orden) values
    ('psicologia', 'Psicología', 1), ('fono', 'Fonoaudiología', 2), ('to', 'T.O.', 3),
    ('kinesiologia', 'Kinesiología', 4), ('psicopedagogia', 'Psicopedagogía', 5)
  on conflict (clave) do nothing;

  -- -------------------------------------------------------------------
  -- 1) PROFESIONALES: los 5 primeros de mañana, los 2 últimos de tarde,
  --    y Gabriela Soria en los DOS turnos (aparece en ambas pestañas).
  -- -------------------------------------------------------------------
  insert into public.profesionales
    (nombre_completo, dni, fecha_nacimiento, matricula, profesion, sector, especialidad,
     telefono, email, direccion, turnos_trabajo, dias_trabajo, estado)
  values
    ('Lic. Carolina Medina',  '91000001', (hoy + 2 - interval '36 years')::date, 'M.P. 4512', 'Psicología',            'psicologia',     'Psicología infantil',        '3865401001', 'carolina.medina@prueba.lazos.test',  'San Martín 120, Aguilares',  '{manana}',       '{Lunes,Martes,Miércoles,Jueves,Viernes}', 'activo'),
    ('Lic. Florencia Paz',    '91000002', '1990-03-14', 'M.P. 3871', 'Fonoaudiología',        'fono',           'Lenguaje y deglución',       '3865401002', 'florencia.paz@prueba.lazos.test',    'Belgrano 455, Aguilares',    '{manana}',       '{Lunes,Martes,Miércoles,Jueves,Viernes}', 'activo'),
    ('Lic. Martín Herrera',   '91000003', '1985-11-02', null,        'Terapia Ocupacional',   'to',             'Integración sensorial',      '3865401003', 'martin.herrera@prueba.lazos.test',   'Mitre 78, Aguilares',        '{manana}',       '{Lunes,Miércoles,Viernes}',               'activo'),
    ('Lic. Valeria Ríos',     '91000004', '1992-07-21', 'M.P. 5120', 'Kinesiología',          'kinesiologia',   'Neurorrehabilitación',       '3865401004', 'valeria.rios@prueba.lazos.test',     'Laprida 300, Aguilares',     '{manana}',       '{Martes,Jueves}',                         'activo'),
    ('Lic. Gabriela Soria',   '91000005', '1988-01-30', 'M.P. 2964', 'Psicopedagogía',        'psicopedagogia', 'Dificultades de aprendizaje','3865401005', 'gabriela.soria@prueba.lazos.test',   'Sarmiento 912, Aguilares',   '{manana,tarde}', '{Lunes,Martes,Miércoles,Jueves,Viernes}', 'activo'),
    ('Lic. Diego Albornoz',   '91000006', '1983-09-09', 'M.P. 3302', 'Psicología',            'psicologia',     'Terapia cognitivo-conductual','3865401006', 'diego.albornoz@prueba.lazos.test',  'Rivadavia 55, Aguilares',    '{tarde}',        '{Lunes,Martes,Miércoles,Jueves,Viernes}', 'activo'),
    ('Lic. Natalia Juárez',   '91000007', '1994-05-17', null,        'Fonoaudiología',        'fono',           'Estimulación temprana',      '3865401007', 'natalia.juarez@prueba.lazos.test',   'Av. Colón 1400, Aguilares',  '{tarde}',        '{Lunes,Martes,Miércoles}',                'activo');

  select array_agg(id order by dni) into v_prof
    from public.profesionales where email like '%@prueba.lazos.test';

  -- -------------------------------------------------------------------
  -- 2) PACIENTES (DNI 90000001 … 90000024)
  -- -------------------------------------------------------------------
  insert into public.pacientes
    (nombre_completo, dni, fecha_nacimiento, telefono, domicilio, escuela, referente_familiar,
     diagnostico, tiene_cud, obra_social, numero_afiliado, fecha_ingreso, estado, estado_admision)
  select
    n.nombre,
    (90000000 + n.i)::text,
    case when n.i = 5 then (hoy - interval '8 years')::date              -- cumple hoy
         else (hoy - ((3 + (n.i * 7) % 12) * 365 + n.i * 11))::date end,
    '38654' || lpad((10000 + n.i * 37)::text, 5, '0'),
    (array['San Martín','Belgrano','Mitre','Rivadavia','Sarmiento','Laprida','Av. Colón','Juan B. Justo'])[1 + n.i % 8]
      || ' ' || (100 + n.i * 13) || ', Aguilares',
    (array['Escuela N° 23 Gral. Belgrano','Jardín de Infantes Rayito de Sol','Escuela Especial N° 5','Colegio San José','Escuela N° 112 Sarmiento'])[1 + n.i % 5],
    (array['Madre: Laura','Madre: Paola','Padre: Jorge','Madre: Romina','Abuela: Silvia','Madre: Carla','Padre: Sergio','Madre: Andrea'])[1 + n.i % 8]
      || ' ' || split_part(n.nombre, ' ', 2),
    (array['TEA (trastorno del espectro autista)','TDAH','Retraso madurativo','Trastorno específico del lenguaje',
           'Síndrome de Down','Parálisis cerebral leve','Dificultades de aprendizaje','Trastorno del procesamiento sensorial'])[1 + n.i % 8],
    n.i % 3 <> 0,
    (array['Subsidio de Salud','PAMI','OSDE','IOSFA','Particular'])[1 + n.i % 5],
    case when n.i % 5 = 4 then null else 'AF-' || (450000 + n.i * 173) end,
    (hoy - (30 + n.i * 15))::date,
    case when n.i = 21 then 'inactivo' else 'activo' end,
    case when n.i >= 22 then 'en_admision' else 'admitido' end
  -- `ord` sale bigint y los índices de arreglo tienen que ser int.
  from (
    select u.nombre, u.ord::int as i
    from unnest(array[
      'Benjamín Acosta','Valentina Romero','Thiago Medina','Isabella Gómez','Mateo Díaz','Martina Herrera',
      'Santino López','Emma Fernández','Bautista Ruiz','Catalina Sosa','Felipe Torres','Olivia Castro',
      'Joaquín Ledesma','Mía Villagra','Lautaro Paz','Sofía Coronel','Benicio Albarracín','Delfina Robles',
      'Tomás Moreno','Renata Gutiérrez','Ignacio Bustos','Lucía Figueroa','Francisco Navarro','Julieta Campos'
    ]) with ordinality as u(nombre, ord)
  ) n;

  -- Los 20 admitidos y activos (los que entran en grilla, turnos, etc.).
  select array_agg(id order by dni) into v_pac
    from public.pacientes where dni between '90000001' and '90000020';

  -- -------------------------------------------------------------------
  -- 3) ADMISIÓN: checklist a medio completar de los 3 en admisión
  -- -------------------------------------------------------------------
  insert into public.admision_documentos (paciente_id, requisito, presentado, observaciones)
  select pa.id, r.req,
         (r.ord + pa.dni::int) % 3 <> 0,
         case when r.req = 'certificado_medico' then 'Lo trae la semana que viene' end
  from public.pacientes pa
  cross join unnest(array['dni','cud','certificado_medico','estudios','carnet_obra_social','informe_escolar','consentimiento'])
       with ordinality as r(req, ord)
  where pa.dni between '90000022' and '90000024';

  -- -------------------------------------------------------------------
  -- 4) GRILLA DE ATENCIÓN: 8 franjas de 30 min por profesional y por
  --    turno, con algunas libres. `off` corre la lista de pacientes para
  --    que en la misma franja nadie quede con dos profesionales, y para
  --    que Gabriela (que hace los dos turnos) no repita pacientes.
  -- -------------------------------------------------------------------
  for p in 1..7 loop
    select sector, turnos_trabajo into v_sec, v_tur from public.profesionales where id = v_prof[p];
    for v_trn in select * from (values ('manana', time '08:00'), ('tarde', time '14:00')) as x(clave, desde) loop
      continue when not (v_trn.clave = any(v_tur));
      off := case when v_trn.clave = 'manana' then (p - 1) * 8
                  when p = 5 then 4
                  else (p - 6) * 8 end;
      for s in 0..7 loop
        continue when (s + p) % 4 = 3;  -- franja libre
        idx := (s + off) % 20 + 1;
        insert into public.asignaciones (paciente_id, profesional_id, hora, sector, vigente_desde)
        values (v_pac[idx], v_prof[p], v_trn.desde + s * interval '30 minutes', v_sec, hoy - 60);
      end loop;
    end loop;
  end loop;

  -- -------------------------------------------------------------------
  -- 5) ASISTENCIA DE PACIENTES: días hábiles del último mes (hoy no)
  -- -------------------------------------------------------------------
  insert into public.asistencias (paciente_id, fecha, estado, observaciones)
  select x.pid, x.fecha,
         case when x.r < 0.82 then 'presente'
              when x.r < 0.90 then 'ausente'
              when x.r < 0.95 then 'ausente_con_aviso'
              else 'enfermedad' end,
         case when x.r >= 0.95 then 'Avisó la familia: está con fiebre'
              when x.r >= 0.90 then 'Avisaron por teléfono' end
  from (
    select pid, d::date as fecha, random() as r
    from unnest(v_pac) as pid
    cross join generate_series(hoy - 30, hoy - 1, interval '1 day') as d
    where extract(isodow from d) < 6
  ) x;

  -- -------------------------------------------------------------------
  -- 6) TURNOS CASUALES (personas sin legajo): la semana pasada y la que
  --    viene, solo en las franjas que la grilla dejó LIBRES y en los días
  --    que trabaja cada profesional (nunca encima de un paciente fijo).
  -- -------------------------------------------------------------------
  for p in 1..7 loop
    select turnos_trabajo, dias_trabajo into v_tur, v_dias from public.profesionales where id = v_prof[p];
    for v_trn in select * from (values ('manana', time '08:00'), ('tarde', time '14:00')) as x(clave, desde) loop
      continue when not (v_trn.clave = any(v_tur));
      for s in 0..7 loop
        continue when (s + p) % 4 <> 3;  -- la misma regla que dejó la franja libre en la grilla
        for v_fecha in select g::date from generate_series(hoy - 7, hoy + 7, interval '1 day') as g loop
          continue when extract(isodow from v_fecha) > 5
                     or not (dias[extract(isodow from v_fecha)::int] = any(v_dias))
                     or random() > 0.3;
          v_n := v_n + 1;
          insert into public.turnos
            (paciente_nombre, paciente_telefono, paciente_dni, profesional_id, fecha, hora, estado, observaciones)
          values (
            (array['Martín Quiroga','Ana Belén Ruiz','Carlos Vega','Lorena Ibáñez','Santiago Rojas',
                   'Paula Mansilla','Rodrigo Leiva','Camila Ponce','Hugo Toledo','Valeria Núñez'])[1 + v_n % 10],
            '38655' || lpad((20000 + v_n * 91)::text, 5, '0'),
            case when v_n % 3 = 0 then null else (95000000 + v_n)::text end,
            v_prof[p], v_fecha, v_trn.desde + s * interval '30 minutes',
            case when v_fecha >= hoy then 'programado' when random() < 0.8 then 'atendido' else 'ausente' end,
            (array['Consulta de evaluación','Primera entrevista','Interconsulta','Control puntual'])[1 + v_n % 4]
          );
        end loop;
      end loop;
    end loop;
  end loop;

  -- -------------------------------------------------------------------
  -- 7) FICHAJE DE PROFESIONALES: último mes, en sus días de trabajo.
  --    Entra al empezar su primer turno y sale al terminar el último.
  -- -------------------------------------------------------------------
  insert into public.asistencias_profesionales (profesional_id, fecha, hora_entrada, hora_salida, estado, observaciones)
  select x.id, x.fecha,
         case when x.r < 0.9 then x.entrada + (floor(x.r * 100)::int % 12) * interval '1 minute' end,
         case when x.r < 0.9 then x.salida end,
         case when x.r < 0.9 then 'presente' when x.r < 0.95 then 'ausente' else 'licencia' end,
         case when x.r >= 0.95 then 'Licencia por capacitación' end
  from (
    select pr.id,
           case when 'manana' = any(pr.turnos_trabajo) then time '08:00' else time '14:00' end as entrada,
           case when 'tarde'  = any(pr.turnos_trabajo) then time '18:00' else time '12:00' end as salida,
           d::date as fecha, random() as r
    from public.profesionales pr
    cross join generate_series(hoy - 30, hoy - 1, interval '1 day') as d
    where pr.id = any(v_prof)
      and extract(isodow from d) < 6
      and dias[extract(isodow from d)::int] = any(pr.dias_trabajo)
  ) x;

  -- -------------------------------------------------------------------
  -- 8) INFORMES MENSUALES: el mes pasado todos al día; este mes solo
  --    los 4 primeros profesionales (los otros 3 aparecen como que deben).
  -- -------------------------------------------------------------------
  insert into public.evaluaciones (paciente_id, profesional_id, fecha, tipo, contenido)
  select distinct on (a.paciente_id, a.profesional_id, m.fecha)
         a.paciente_id, a.profesional_id, m.fecha, 'mensual',
         json_build_object(
           'tipo', 'mensual',
           'titulo', 'INFORME MENSUAL',
           'objetivos', 'Favorecer la comunicación funcional y la autonomía en las actividades de la vida diaria.',
           'cuerpo', 'Durante el mes asistió con regularidad. Se observan avances en la atención sostenida y en la '
                     || 'tolerancia a la frustración. Responde mejor a consignas cortas y con apoyo visual.',
           'indicaciones', 'Continuar con el abordaje actual. Se sugiere reforzar las rutinas en el hogar.'
         )::text
  from public.asignaciones a
  cross join (values
    ((date_trunc('month', hoy) - interval '5 days')::date, false),           -- mes anterior
    (greatest(date_trunc('month', hoy)::date, hoy - 3), true)                -- mes actual
  ) as m(fecha, es_actual)
  where a.vigente_hasta is null
    and a.profesional_id = any(v_prof)
    and (not m.es_actual or a.profesional_id = any(v_prof[1:4]));

  -- -------------------------------------------------------------------
  -- 9) CUD con vencimientos (sin archivo adjunto): uno vencido, varios
  --     por vencer en el mes y el resto lejos.
  -- -------------------------------------------------------------------
  insert into public.documentos (paciente_id, tipo, numero, fecha_emision, fecha_vencimiento, observaciones)
  select pa.id, 'cud', 'CUD-' || pa.dni,
         (hoy - interval '3 years')::date,
         case (pa.dni::int % 5)
           when 0 then hoy + 10
           when 1 then hoy - 5
           when 2 then hoy + 25
           else hoy + 200 + (pa.dni::int % 40) * 10 end,
         'Cargado como dato de prueba (sin archivo)'
  from public.pacientes pa
  where pa.dni between '90000001' and '90000021' and pa.tiene_cud;

  -- -------------------------------------------------------------------
  -- 10) CONVENIOS, FACTURACIÓN Y GASTOS
  -- -------------------------------------------------------------------
  insert into public.convenios (nombre, notas) values
    ('Subsidio de Salud', 'Datos de prueba'),
    ('PAMI',              'Datos de prueba'),
    ('OSDE',              'Datos de prueba'),
    ('IOSFA',             'Datos de prueba'),
    ('Swiss Medical',     'Datos de prueba');

  -- Hace 2 meses casi todo cobrado, el mes pasado mezclado, este mes
  -- casi nada facturado todavía.
  insert into public.facturacion (paciente_id, periodo, estado)
  select x.pid, to_char(x.mes, 'YYYY-MM'),
         case x.atras
           when 2 then case when x.r < 0.9 then 'facturado_cobrado' else 'facturado_no_cobrado' end
           when 1 then case when x.r < 0.4 then 'facturado_cobrado' when x.r < 0.8 then 'facturado_no_cobrado' else 'no_facturado' end
           else       case when x.r < 0.15 then 'facturado_no_cobrado' else 'no_facturado' end
         end
  from (
    select pid, k as atras, (date_trunc('month', hoy) - k * interval '1 month')::date as mes, random() as r
    from unnest(v_pac) as pid cross join generate_series(0, 2) as k
  ) x;

  insert into public.gastos (fecha, concepto, monto, socio, categoria) values
    (hoy - 2,  'Resmas de papel y tóner',          38500.00, 'Socio 1 (prueba)', 'Insumos'),
    (hoy - 5,  'Factura de luz',                   61200.00, 'Socio 2 (prueba)', 'Servicios'),
    (hoy - 8,  'Material didáctico (encastres)',   45900.00, 'Socio 1 (prueba)', 'Insumos'),
    (hoy - 12, 'Arreglo del aire acondicionado',   90000.00, 'Socio 2 (prueba)', 'Mantenimiento'),
    (hoy - 15, 'Internet del mes',                 24990.00, 'Socio 1 (prueba)', 'Servicios'),
    (hoy - 20, 'Alquiler del local',              450000.00, 'Socio 2 (prueba)', 'Alquiler'),
    (hoy - 33, 'Colchonetas para kinesiología',   128000.00, 'Socio 1 (prueba)', 'Insumos'),
    (hoy - 38, 'Factura de agua',                  18700.00, 'Socio 2 (prueba)', 'Servicios'),
    (hoy - 42, 'Pintura sala verde',               76000.00, 'Socio 1 (prueba)', 'Mantenimiento'),
    (hoy - 50, 'Alquiler del local',              450000.00, 'Socio 1 (prueba)', 'Alquiler'),
    (hoy - 55, 'Artículos de limpieza',            32400.00, 'Socio 2 (prueba)', 'Insumos'),
    (hoy - 58, 'Factura de luz',                   58900.00, 'Socio 1 (prueba)', 'Servicios');

  raise notice 'Datos de prueba cargados: 7 profesionales, 24 pacientes, grilla, turnos, asistencias, informes, CUD, facturación y gastos.';
end $$;

-- Verificación rápida: cuántas filas de prueba quedaron en cada tabla.
select
  (select count(*) from public.profesionales where email like '%@prueba.lazos.test') as profesionales,
  (select count(*) from public.pacientes where dni between '90000001' and '90000024') as pacientes,
  (select count(*) from public.asignaciones a join public.pacientes p on p.id = a.paciente_id where p.dni like '9000%') as celdas_grilla,
  (select count(*) from public.turnos t join public.profesionales pr on pr.id = t.profesional_id where pr.email like '%@prueba.lazos.test') as turnos_casuales,
  (select count(*) from public.asistencias a join public.pacientes p on p.id = a.paciente_id where p.dni like '9000%') as asistencias,
  (select count(*) from public.evaluaciones e join public.pacientes p on p.id = e.paciente_id where p.dni like '9000%') as evaluaciones,
  (select count(*) from public.facturacion f join public.pacientes p on p.id = f.paciente_id where p.dni like '9000%') as facturacion,
  (select count(*) from public.gastos where socio like '%(prueba)') as gastos;
