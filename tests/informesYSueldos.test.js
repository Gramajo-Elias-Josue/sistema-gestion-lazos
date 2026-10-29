// Tests: informe mensual (uno por paciente, cualquier día del mes),
// fichaje propio separado de la planilla, y control de horas para la
// dirección (sueldos).
import { describe, it, expect } from 'vitest';
import { pendientesDelMes } from '../src/utils/periodos.js';
import { autoresElegiblesMes, presenciasPorProfesional } from '../src/utils/evaluacion.js';
import { combinarFichaje, combinarPorFecha, puedeDeshacerSalida, pasoFichaje } from '../src/utils/tramosFichaje.js';
import {
  minutosTramo, minutosDia, horarioTexto, formatearHoras, enHoras, alertaDelDia, resumenControlHoras,
} from '../src/utils/controlHoras.js';
import { hojasControlHoras } from '../src/utils/excel.js';
import { renderResumenControl, renderDetalleControl } from '../src/views/controlHorasView.js';
import { renderMisEntregas, renderEntregas } from '../src/views/inicioView.js';
import { notificacionesGlobales } from '../src/utils/notificaciones.js';

const ana = { id: 'p1', nombre_completo: 'Flores Ana', profesion: 'Psicología' };
const beto = { id: 'p2', nombre_completo: 'Soria Beto', profesion: 'Fono' };

describe('Informe mensual: uno por paciente', () => {
  const asignaciones = [
    { profesional_id: 'p1', paciente_id: 'x1', pacientes: { nombre_completo: 'Juan' } },
    { profesional_id: 'p1', paciente_id: 'x1', pacientes: { nombre_completo: 'Juan' } }, // otra franja, mismo paciente
    { profesional_id: 'p1', paciente_id: 'x2', pacientes: { nombre_completo: 'Lucía' } },
    { profesional_id: 'p2', paciente_id: 'x3', pacientes: { nombre_completo: 'Mora' } },
  ];
  const informes = [
    { profesional_id: 'p1', paciente_id: 'x1', tipo: 'mensual', fecha: '2026-10-05' },
    { profesional_id: 'p2', paciente_id: 'x3', tipo: 'mensual', fecha: '2026-10-20' },
    { profesional_id: 'p1', paciente_id: 'x2', tipo: 'mensual', fecha: '2026-09-28' }, // otro mes: no cuenta
  ];

  it('cada profesional debe el de cada paciente de su grilla que no tiene informe este mes', () => {
    const r = pendientesDelMes({ profesionales: [ana, beto], informes, fotos: [], asignaciones, periodo: '2026-10' });
    expect(r.informes.map(p => p.id)).toEqual(['p1']);
    expect(r.informes[0].pacientesPendientes).toEqual([{ id: 'x2', nombre_completo: 'Lucía' }]);
  });
  it('un profesional sin pacientes en la grilla no debe informes', () => {
    const r = pendientesDelMes({ profesionales: [beto], informes: [], fotos: [], asignaciones: [], periodo: '2026-10' });
    expect(r.informes).toEqual([]);
  });
  it('sin asignaciones (regla vieja): alcanza con uno en el mes', () => {
    const r = pendientesDelMes({ profesionales: [ana, beto], informes: [informes[0]], fotos: [], periodo: '2026-10' });
    expect(r.informes.map(p => p.id)).toEqual(['p2']);
  });
  it('Inicio y campana nombran a los pacientes que faltan', () => {
    const r = pendientesDelMes({ profesionales: [ana], informes, fotos: [{ profesional_id: 'p1', periodo: '2026-10' }], asignaciones, periodo: '2026-10' });
    expect(renderEntregas(r)).toContain('Lucía');
    const notif = notificacionesGlobales({ pendientes: r, avisarEntregas: true });
    expect(notif[0].detalle).toBe('Debe 1 informe del mes: Lucía');
  });
  it('recordatorio del profesional: sus pacientes pendientes y la foto', () => {
    const html = renderMisEntregas({ periodo: '2026-10', pacientes: [{ id: 'x2', nombre_completo: 'Lucía' }], debeFoto: true });
    expect(html).toContain('Te falta el informe mensual de 1 paciente');
    expect(html).toContain('Lucía');
    expect(html).toContain('href="#pacientes"');
    expect(html).toContain('foto');
    expect(renderMisEntregas({ periodo: '2026-10', pacientes: [], debeFoto: false })).toBe('');
  });
});

describe('Informe mensual: se carga cualquier día del mes', () => {
  const asignaciones = [{ profesional_id: 'p1', profesionales: { nombre_completo: 'Flores Ana' } }];

  it('alcanza con un día del mes con los dos presentes', () => {
    const presenciasProf = { p1: new Set(['2026-10-07']) };
    expect(autoresElegiblesMes({ asignaciones, fechasPaciente: ['2026-10-07'], presenciasProf })).toHaveLength(1);
  });
  it('si nunca coincidieron el mismo día, no', () => {
    const presenciasProf = { p1: new Set(['2026-10-08']) };
    expect(autoresElegiblesMes({ asignaciones, fechasPaciente: ['2026-10-07'], presenciasProf })).toHaveLength(0);
  });
  it('el profesional cuenta presente por la planilla o por su propio fichaje', () => {
    const pres = presenciasPorProfesional({
      planilla: [{ profesional_id: 'p1', fecha: '2026-10-01', estado: 'presente' }, { profesional_id: 'p1', fecha: '2026-10-02', estado: 'ausente' }],
      propios: [{ profesional_id: 'p1', fecha: '2026-10-03', hora_entrada: '08:00' }, { profesional_id: 'p1', fecha: '2026-10-04' }],
    });
    expect([...pres.p1].sort()).toEqual(['2026-10-01', '2026-10-03']);
  });
});

describe('Fichaje propio separado de la planilla', () => {
  const planilla = { fecha: '2026-10-29', profesional_id: 'p1', estado: 'presente', hora_entrada: '08:00:00', hora_salida: '12:00:00' };
  const propio = { fecha: '2026-10-29', profesional_id: 'p1', hora_entrada: '08:05:00', entrada_distancia_m: 20 };

  it('Mi fichaje muestra SUS horas (no las de la secretaría) con el estado de la planilla', () => {
    const f = combinarFichaje(planilla, propio);
    expect(f.hora_entrada).toBe('08:05:00');
    expect(f.hora_salida).toBe(null); // la salida de la secretaría no cuenta como fichada por él
    expect(f.entrada_por).toBe('ubicacion');
    expect(f.estado).toBe('presente');
    expect(pasoFichaje(f)).toBe('salida');
  });
  it('si la secretaría lo marcó de licencia, no puede fichar', () => {
    expect(pasoFichaje(combinarFichaje({ ...planilla, estado: 'licencia' }, null))).toBe('bloqueado');
  });
  it('puede deshacer su propia salida', () => {
    expect(puedeDeshacerSalida(combinarFichaje(null, { ...propio, hora_salida: '12:00:00' }), 1)).toBe(true);
  });
  it('sin ninguno de los dos: null', () => {
    expect(combinarFichaje(null, null)).toBe(null);
  });
  it('por fecha: una fila combinada por día', () => {
    const filas = combinarPorFecha([planilla, { fecha: '2026-10-28', estado: 'ausente' }], [propio]);
    expect(filas.map(f => f.fecha)).toEqual(['2026-10-28', '2026-10-29']);
    expect(filas[0].estado).toBe('ausente');
  });
});

describe('Control de horas (sueldos, solo dirección)', () => {
  it('minutos y textos', () => {
    expect(minutosTramo('08:00:00', '12:30:00')).toBe(270);
    expect(minutosTramo('08:00', null)).toBe(0);
    expect(minutosDia({ hora_entrada: '08:00', hora_salida: '12:00', hora_entrada_2: '14:00', hora_salida_2: '18:00' })).toBe(480);
    expect(horarioTexto({ hora_entrada: '08:00:00', hora_salida: '12:00:00', hora_entrada_2: '14:00:00' })).toBe('08:00 a 12:00 · 14:00 a —');
    expect(formatearHoras(450)).toBe('7 h 30 min');
    expect(formatearHoras(0)).toBe('—');
    expect(enHoras(450)).toBe(7.5);
  });
  it('alertas: lo que no cuadra', () => {
    const p = { estado: 'presente', hora_entrada: '08:00', hora_salida: '12:00' };
    expect(alertaDelDia(p, null)).toContain('Solo en la planilla');
    expect(alertaDelDia(null, { hora_entrada: '08:00', hora_salida: '12:00' })).toContain('Solo en su fichaje');
    expect(alertaDelDia({ estado: 'ausente' }, { hora_entrada: '08:00', hora_salida: '12:00' })).toContain('ausente');
    expect(alertaDelDia(p, { hora_entrada: '08:00' })).toContain('sin salida');
    expect(alertaDelDia(p, { hora_entrada: '08:05', hora_salida: '12:00' })).toBe(null); // 5 min: tolerado
    expect(alertaDelDia(p, { hora_entrada: '09:00', hora_salida: '12:00' })).toBe('Diferencia de 1 h');
  });
  it('resumen por profesional: días y horas de cada registro', () => {
    const r = resumenControlHoras({
      profesionales: [beto, ana],
      planillas: [
        { profesional_id: 'p1', fecha: '2026-10-01', estado: 'presente', hora_entrada: '08:00', hora_salida: '12:00' },
        { profesional_id: 'p1', fecha: '2026-10-02', estado: 'presente', hora_entrada: '08:00', hora_salida: '12:00' },
      ],
      propios: [{ profesional_id: 'p1', fecha: '2026-10-01', hora_entrada: '08:00', hora_salida: '12:00' }],
    });
    expect(r.map(x => x.profesional.id)).toEqual(['p1', 'p2']); // por nombre
    expect(r[0]).toMatchObject({ diasPlanilla: 2, minPlanilla: 480, diasPropio: 1, minPropio: 240, alertas: 1 });
    expect(r[1].dias).toEqual([]);

    const html = renderResumenControl(r, 'p1');
    expect(html).toContain('Flores Ana');
    expect(html).toContain('1 día para revisar');
    expect(html).toContain('−4 h');
    expect(renderDetalleControl(r[0])).toContain('Solo en la planilla');

    const [resumen, detalle] = hojasControlHoras(r, '2026-10');
    expect(resumen.filas[3]).toEqual(['Flores Ana', 'Psicología', 2, 8, 1, 4, -4, 1]);
    expect(detalle.filas.length).toBe(3 + 2);
  });
});
