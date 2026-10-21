// Tests de las entregas del mes (utils/periodos.js).
// Reglas del centro: cada profesional entrega SU informe mensual (uno
// por profesional, no por paciente) y al menos UNA foto de su trabajo.
// Las fotos se borran solas a los 3 meses.
import { describe, it, expect } from 'vitest';
import {
  periodoMensual, etiquetaPeriodo, moverPeriodo,
  pendientesDelMes, fotosVencidas, diasHastaFinDeMes,
} from '../src/utils/periodos.js';

const equipo = [
  { id: 'x1', nombre_completo: 'Flores Ingrid', profesion: 'Psicología' },
  { id: 'x2', nombre_completo: 'Villafañe Mirka', profesion: 'Fonoaudiología' },
  { id: 'x3', nombre_completo: 'Funez Nazareth', profesion: 'T.O.' },
];

describe('períodos', () => {
  it('saca el mes de una fecha', () => {
    expect(periodoMensual('2026-08-15')).toBe('2026-08');
  });

  it('se lee en castellano', () => {
    expect(etiquetaPeriodo('2026-08')).toBe('Agosto 2026');
    expect(etiquetaPeriodo('2026')).toBe('2026');
  });

  it('cambia de año al moverse de mes', () => {
    expect(moverPeriodo('2026-01', -1)).toBe('2025-12');
    expect(moverPeriodo('2026-12', 1)).toBe('2027-01');
  });
});

describe('diasHastaFinDeMes', () => {
  it('cuenta lo que falta hasta el último día del mes', () => {
    expect(diasHastaFinDeMes('2026-08-09')).toBe(22); // agosto tiene 31 días
  });

  it('0 cuando hoy es el último día del mes', () => {
    expect(diasHastaFinDeMes('2026-08-31')).toBe(0);
  });

  it('funciona en febrero (28/29 días)', () => {
    expect(diasHastaFinDeMes('2026-02-26')).toBe(2); // 2026 no es bisiesto
  });
});

// Los informes salen de `evaluaciones`, con su tipo y su fecha: son los
// mismos que el profesional carga en la historia clínica del paciente.
const informe = (profesionalId, tipo, fecha) => ({ profesional_id: profesionalId, tipo, fecha });

describe('pendientesDelMes', () => {
  const periodo = '2026-08';

  it('marca a quien no cargó ningún informe mensual en el mes', () => {
    const r = pendientesDelMes({
      profesionales: equipo, periodo,
      informes: [informe('x1', 'mensual', '2026-08-12')],
      fotos: equipo.map(p => ({ profesional_id: p.id, periodo })),
    });
    expect(r.informes.map(p => p.id)).toEqual(['x2', 'x3']);
    expect(r.fotos).toHaveLength(0);
  });

  it('con un informe alcanza, aunque haya cargado varios pacientes', () => {
    const r = pendientesDelMes({
      profesionales: [equipo[0]], periodo,
      informes: [
        informe('x1', 'mensual', '2026-08-03'),
        informe('x1', 'mensual', '2026-08-20'),
      ],
      fotos: [{ profesional_id: 'x1', periodo }],
    });
    expect(r.informes).toHaveLength(0);
    expect(r.alDia).toBe(true);
  });

  it('marca a quien no subió su foto del mes', () => {
    const r = pendientesDelMes({
      profesionales: equipo, periodo,
      informes: equipo.map(p => informe(p.id, 'mensual', '2026-08-10')),
      fotos: [{ profesional_id: 'x2', periodo }],
    });
    expect(r.fotos.map(p => p.id)).toEqual(['x1', 'x3']);
  });

  it('lo entregado en OTRO mes no cuenta para este', () => {
    const r = pendientesDelMes({
      profesionales: [equipo[0]], periodo,
      informes: [informe('x1', 'mensual', '2026-07-31')],
      fotos: [{ profesional_id: 'x1', periodo: '2026-07' }],
    });
    expect(r.informes).toHaveLength(1);
    expect(r.fotos).toHaveLength(1);
  });

  it('[regresión] la evaluación DIARIA no cuenta como informe del mes', () => {
    const r = pendientesDelMes({
      profesionales: [equipo[0]], periodo,
      informes: [informe('x1', 'diaria', '2026-08-10')],
      fotos: [{ profesional_id: 'x1', periodo }],
    });
    expect(r.informes).toHaveLength(1);
  });

  it('el informe ANUAL no tapa el mensual', () => {
    const r = pendientesDelMes({
      profesionales: [equipo[0]], periodo,
      informes: [informe('x1', 'anual', '2026-08-10')],
      fotos: [{ profesional_id: 'x1', periodo }],
    });
    expect(r.informes).toHaveLength(1);
  });

  it('sin profesionales activos no hay pendientes', () => {
    expect(pendientesDelMes({ profesionales: [], periodo }).alDia).toBe(true);
  });
});

describe('fotosVencidas', () => {
  const hoy = '2026-08-10';

  it('las de más de 3 meses se van; las nuevas quedan', () => {
    const vencidas = fotosVencidas([
      { id: 1, created_at: '2026-08-01T10:00:00Z' }, // de este mes
      { id: 2, created_at: '2026-06-01T10:00:00Z' }, // 2 meses
      { id: 3, created_at: '2026-04-01T10:00:00Z' }, // más de 3 meses
      { id: 4, created_at: '2025-12-01T10:00:00Z' }, // del año pasado
    ], hoy);
    expect(vencidas.map(f => f.id)).toEqual([3, 4]);
  });

  it('una foto sin fecha no se borra por las dudas', () => {
    expect(fotosVencidas([{ id: 9, created_at: null }], hoy)).toEqual([]);
  });

  it('se puede cambiar el plazo', () => {
    const fotos = [{ id: 1, created_at: '2026-06-01T10:00:00Z' }];
    expect(fotosVencidas(fotos, hoy, 3)).toHaveLength(0);
    expect(fotosVencidas(fotos, hoy, 1)).toHaveLength(1);
  });
});
