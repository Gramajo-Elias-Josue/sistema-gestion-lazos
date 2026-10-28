// Tests de los cálculos de Estadísticas (utils/estadisticas.js). Son
// puros: reciben filas como las de la base y devuelven números.
import { describe, it, expect } from 'vitest';
import * as E from '../src/utils/estadisticas.js';

describe('estadisticas: meses y rangos', () => {
  it('los 6 meses que terminan en el elegido, del más viejo al más nuevo (cruzando el año)', () => {
    expect(E.mesesHasta('2026-02')).toEqual(['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02']);
  });

  it('el rango va del primer día del primer mes al último del último', () => {
    expect(E.rangoDeMeses(['2026-01', '2026-02'])).toEqual({ desde: '2026-01-01', hasta: '2026-02-28' });
  });

  it('porcentaje sin base da 0 (no NaN)', () => {
    expect(E.porcentaje(3, 0)).toBe(0);
    expect(E.porcentaje(1, 3)).toBe(33);
  });
});

describe('estadisticas: asistencia', () => {
  const asis = [
    { paciente_id: 1, fecha: '2026-10-01', estado: 'presente' },
    { paciente_id: 1, fecha: '2026-10-02', estado: 'ausente' },
    { paciente_id: 2, fecha: '2026-10-01', estado: 'enfermedad' },
    { paciente_id: 2, fecha: '2026-10-02', estado: 'ausente_con_aviso' },
    { paciente_id: 3, fecha: '2026-10-02', estado: 'presente' },
    { paciente_id: 1, fecha: '2026-09-30', estado: 'presente' },
  ];
  const pacientes = [{ id: 1, nombre_completo: 'Ana' }, { id: 2, nombre_completo: 'Beto' }, { id: 3, nombre_completo: 'Caro' }];

  it('cuenta cada estado por mes y el % de presentes sobre lo registrado', () => {
    const [sep, oct] = E.asistenciaPorMes(asis, ['2026-09', '2026-10']);
    expect(sep).toMatchObject({ total: 1, presentes: 1, pct: 100 });
    expect(oct).toMatchObject({ total: 5, presentes: 2, ausentes: 1, aviso: 1, enfermedad: 1, pct: 40 });
  });

  it('un mes sin registros da 0 y no se rompe', () => {
    expect(E.asistenciaPorMes([], ['2026-10'])[0]).toMatchObject({ total: 0, pct: 0 });
  });

  it('ranking de faltas: solo los que faltaron, de más a menos, del mes elegido', () => {
    const r = E.ausentismoPorPaciente(asis, pacientes, '2026-10');
    expect(r.map(x => x.nombre)).toEqual(['Beto', 'Ana']);
    expect(r[0]).toMatchObject({ faltas: 2, registros: 2, pct: 0 });
    expect(r[1]).toMatchObject({ faltas: 1, registros: 2, pct: 50 });
  });

  it('fichaje por profesional: cuenta presente / ausente / licencia y omite inactivos', () => {
    const profs = [{ id: 'a', nombre_completo: 'Lic. B' }, { id: 'b', nombre_completo: 'Lic. A' }, { id: 'c', nombre_completo: 'Lic. C', estado: 'inactivo' }];
    const fich = [
      { profesional_id: 'a', fecha: '2026-10-01', estado: 'presente' },
      { profesional_id: 'a', fecha: '2026-10-02', estado: 'licencia' },
      { profesional_id: 'b', fecha: '2026-10-01', estado: 'ausente' },
      { profesional_id: 'b', fecha: '2026-09-01', estado: 'presente' },
    ];
    const r = E.fichajePorProfesional(fich, profs, '2026-10');
    expect(r.map(x => x.nombre)).toEqual(['Lic. A', 'Lic. B']);
    expect(r[0]).toMatchObject({ presentes: 0, ausentes: 1, licencias: 0 });
    expect(r[1]).toMatchObject({ presentes: 1, ausentes: 0, licencias: 1 });
  });
});

describe('estadisticas: atención y grilla', () => {
  const pacientes = [
    { id: 1, estado_admision: 'admitido', estado: 'activo', tiene_cud: true, fecha_ingreso: '2026-10-05' },
    { id: 2, estado_admision: 'admitido', estado: 'activo', tiene_cud: false, fecha_ingreso: null, created_at: '2026-09-10T12:00:00Z' },
    { id: 3, estado_admision: 'admitido', estado: 'inactivo', tiene_cud: true, fecha_ingreso: '2026-08-01' },
    { id: 4, estado_admision: 'en_admision', estado: 'activo', fecha_ingreso: '2026-10-20' },
  ];

  it('resumen: activos, bajas, en admisión y con CUD (solo entre activos)', () => {
    expect(E.resumenPacientes(pacientes)).toEqual({ activos: 2, inactivos: 1, enAdmision: 1, conCud: 1 });
  });

  it('ingresos por mes: solo admitidos, por fecha de ingreso o, si falta, de carga', () => {
    const r = E.ingresosPorMes(pacientes, ['2026-08', '2026-09', '2026-10']);
    expect(r.map(x => x.valor)).toEqual([1, 1, 1]);
  });

  const profs = [
    { id: 'p1', nombre_completo: 'Lic. Uno', sector: 'psicologia' },
    { id: 'p2', nombre_completo: 'Lic. Dos', sector: 'fono' },
    { id: 'p3', nombre_completo: 'Lic. Tres', sector: null },
  ];
  const asig = [
    { profesional_id: 'p1', paciente_id: 1, hora: '08:00:00' },
    { profesional_id: 'p1', paciente_id: 2, hora: '08:30:00' },
    { profesional_id: 'p1', paciente_id: 1, hora: '15:00:00' }, // mismo paciente: cuenta una vez
    { profesional_id: 'p2', paciente_id: 1, hora: '14:00:00' },
    { profesional_id: 'p3', paciente_id: 9, hora: '09:00:00' },
  ];
  const sectores = [{ clave: 'fono', etiqueta: 'Fonoaudiología', orden: 2 }, { clave: 'psicologia', etiqueta: 'Psicología', orden: 1 }];

  it('pacientes DISTINTOS por profesión, en el orden de los sectores, y "Sin profesión" al final', () => {
    expect(E.pacientesPorProfesion(asig, profs, sectores)).toEqual([
      { clave: 'psicologia', etiqueta: 'Psicología', valor: 2 },
      { clave: 'fono', etiqueta: 'Fonoaudiología', valor: 1 },
      { clave: '', etiqueta: 'Sin profesión', valor: 1 },
    ]);
  });
});

describe('estadisticas: informes y turnos', () => {
  it('informes y certificados por mes (los periódicos cuentan como informes)', () => {
    const ev = [
      { fecha: '2026-10-01', tipo: 'mensual' }, { fecha: '2026-10-03', tipo: 'anual' },
      { fecha: '2026-10-05', tipo: 'certificado' }, { fecha: '2026-09-05', tipo: 'mensual' },
    ];
    expect(E.documentosPorMes(ev, ['2026-09', '2026-10'])).toEqual([
      { periodo: '2026-09', informes: 1, certificados: 0 },
      { periodo: '2026-10', informes: 2, certificados: 1 },
    ]);
  });

  it('entregas: pacientes de la grilla con informe MENSUAL del mes, los más atrasados primero', () => {
    const profs = [{ id: 'a', nombre_completo: 'Lic. A' }, { id: 'b', nombre_completo: 'Lic. B' }, { id: 'c', nombre_completo: 'Lic. C' }];
    const asig = [
      { profesional_id: 'a', paciente_id: 1 }, { profesional_id: 'a', paciente_id: 2 },
      { profesional_id: 'b', paciente_id: 3 },
    ];
    const ev = [
      { profesional_id: 'a', paciente_id: 1, fecha: '2026-10-20', tipo: 'mensual' },
      { profesional_id: 'b', paciente_id: 3, fecha: '2026-10-20', tipo: 'mensual' },
      { profesional_id: 'a', paciente_id: 2, fecha: '2026-10-20', tipo: 'certificado' }, // no es el informe mensual
      { profesional_id: 'a', paciente_id: 2, fecha: '2026-09-20', tipo: 'mensual' },     // otro mes
    ];
    const r = E.entregasDeInformes(ev, profs, asig, '2026-10');
    expect(r).toEqual([
      expect.objectContaining({ nombre: 'Lic. A', entregados: 1, pacientes: 2, pct: 50 }),
      expect.objectContaining({ nombre: 'Lic. B', entregados: 1, pacientes: 1, pct: 100 }),
    ]); // Lic. C no tiene pacientes en la grilla: no aparece
  });

  it('turnos casuales por mes, separados por estado', () => {
    const t = [
      { fecha: '2026-10-01', estado: 'atendido' }, { fecha: '2026-10-02', estado: 'ausente' },
      { fecha: '2026-10-03', estado: 'cancelado' }, { fecha: '2026-10-04', estado: 'programado' },
    ];
    expect(E.turnosCasualesPorMes(t, ['2026-10'])[0]).toEqual({ periodo: '2026-10', total: 4, atendidos: 1, ausentes: 1, cancelados: 1, programados: 1 });
  });
});

describe('estadisticas: gestión', () => {
  it('facturación por mes: facturados sin cobrar y cobrados', () => {
    const f = [
      { periodo: '2026-10', estado: 'facturado_no_cobrado' }, { periodo: '2026-10', estado: 'facturado_cobrado' },
      { periodo: '2026-10', estado: 'facturado_cobrado' }, { periodo: '2026-09', estado: 'no_facturado' },
    ];
    expect(E.facturacionPorMes(f, ['2026-09', '2026-10'])).toEqual([
      { periodo: '2026-09', facturados: 0, cobrados: 0 },
      { periodo: '2026-10', facturados: 1, cobrados: 2 },
    ]);
  });

  it('gastos por mes y por categoría (sin categoría agrupa aparte)', () => {
    const g = [
      { fecha: '2026-10-01', monto: '1000.50', categoria: 'Insumos' }, { fecha: '2026-10-09', monto: 500, categoria: ' ' },
      { fecha: '2026-10-10', monto: 2000, categoria: 'Insumos' }, { fecha: '2026-09-10', monto: 300, categoria: null },
    ];
    expect(E.gastosPorMes(g, ['2026-09', '2026-10']).map(x => x.valor)).toEqual([300, 3500.5]);
    expect(E.gastosPorCategoria(g.slice(0, 3))).toEqual([
      { categoria: 'Insumos', total: 3000.5 }, { categoria: 'Sin categoría', total: 500 },
    ]);
  });
});
