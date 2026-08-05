// Tests del calendario de asistencia (utils/calendario.js).
// Lo importante acá es la REGLA DEL CENTRO: sábados y domingos la
// clínica no abre, así que no cuentan como inasistencia; y los días
// futuros tampoco se juzgan (todavía no pasaron).
import { describe, it, expect } from 'vitest';
import {
  armarCalendario, resumirMes, rangoDelMes, moverMes, mesDeFecha, etiquetaMes,
} from '../src/utils/calendario.js';

// Julio de 2026: empieza MIÉRCOLES y tiene 31 días.
const JULIO = { anio: 2026, mes: 7 };

describe('rangoDelMes', () => {
  it('devuelve el primer y el último día del mes', () => {
    expect(rangoDelMes(2026, 7)).toEqual({ desde: '2026-07-01', hasta: '2026-07-31' });
    expect(rangoDelMes(2026, 2)).toEqual({ desde: '2026-02-01', hasta: '2026-02-28' });
    expect(rangoDelMes(2024, 2).hasta).toBe('2024-02-29'); // año bisiesto
  });
});

describe('moverMes', () => {
  it('cambia de año al pasar de diciembre o enero', () => {
    expect(moverMes(2026, 12, 1)).toEqual({ anio: 2027, mes: 1 });
    expect(moverMes(2026, 1, -1)).toEqual({ anio: 2025, mes: 12 });
  });
});

describe('mesDeFecha y etiquetaMes', () => {
  it('leen el mes de una fecha ISO y lo muestran en castellano', () => {
    expect(mesDeFecha('2026-07-31')).toEqual({ anio: 2026, mes: 7 });
    expect(etiquetaMes(2026, 7)).toBe('Julio 2026');
  });
});

describe('armarCalendario', () => {
  const base = { ...JULIO, hoy: '2026-07-20', registros: [] };

  it('la semana arranca el lunes: julio 2026 empieza miércoles (2 huecos)', () => {
    const { semanas } = armarCalendario(base);
    expect(semanas[0][0]).toBe(null);        // lunes
    expect(semanas[0][1]).toBe(null);        // martes
    expect(semanas[0][2].dia).toBe(1);       // miércoles 1 de julio
  });

  it('arma todos los días del mes y completa la última semana', () => {
    const { dias, semanas } = armarCalendario(base);
    expect(dias).toHaveLength(31);
    semanas.forEach(s => expect(s).toHaveLength(7));
  });

  it('marca los fines de semana (la clínica no abre)', () => {
    const { dias } = armarCalendario(base);
    const sabado4 = dias.find(d => d.iso === '2026-07-04');
    const lunes6 = dias.find(d => d.iso === '2026-07-06');
    expect(sabado4.finde).toBe(true);
    expect(lunes6.finde).toBe(false);
  });

  it('los días posteriores a hoy quedan como futuros', () => {
    const { dias } = armarCalendario(base);
    expect(dias.find(d => d.iso === '2026-07-20').futuro).toBe(false); // hoy
    expect(dias.find(d => d.iso === '2026-07-21').futuro).toBe(true);
  });

  it('pega cada registro en su día (estado, motivo y horario)', () => {
    const { dias } = armarCalendario({
      ...base,
      registros: [
        { fecha: '2026-07-01', estado: 'presente', hora_entrada: '08:00:00', hora_salida: '13:00:00' },
        { fecha: '2026-07-02', estado: 'ausente_con_aviso', observaciones: 'Control médico' },
      ],
    });
    const d1 = dias.find(d => d.iso === '2026-07-01');
    const d2 = dias.find(d => d.iso === '2026-07-02');
    expect(d1.estado).toBe('presente');
    expect(d1.entrada).toBe('08:00:00');
    expect(d2.nota).toBe('Control médico');
    expect(dias.find(d => d.iso === '2026-07-03').estado).toBe(null); // sin registro
  });
});

describe('resumirMes', () => {
  const dia = (props) => ({ iso: '2026-07-01', dia: 1, finde: false, futuro: false, estado: null, ...props });

  it('el fin de semana no cuenta como día hábil ni como falta', () => {
    const r = resumirMes([
      dia({ estado: 'presente' }),
      dia({ finde: true }),            // sábado: la clínica no abre
      dia({ finde: true }),            // domingo
    ]);
    expect(r.habiles).toBe(1);
    expect(r.ausentes).toBe(0);
    expect(r.pct).toBe(100);
  });

  it('los días futuros no se cuentan (todavía no pasaron)', () => {
    const r = resumirMes([dia({ estado: 'presente' }), dia({ futuro: true })]);
    expect(r.habiles).toBe(1);
    expect(r.sinRegistro).toBe(0);
  });

  it('separa ausencias con aviso, licencia y enfermedad de las lisas', () => {
    const r = resumirMes([
      dia({ estado: 'presente' }), dia({ estado: 'presente' }),
      dia({ estado: 'ausente' }),
      dia({ estado: 'ausente_con_aviso' }),
      dia({ estado: 'licencia' }),
      dia({ estado: 'enfermedad' }),
    ]);
    expect(r.presentes).toBe(2);
    expect(r.ausentes).toBe(1);
    expect(r.avisados).toBe(3);
    expect(r.registrados).toBe(6);
    expect(r.pct).toBe(33); // 2 de 6
  });

  it('un día hábil sin marcar queda como "sin registro", no como ausente', () => {
    const r = resumirMes([dia({ estado: 'presente' }), dia({})]);
    expect(r.sinRegistro).toBe(1);
    expect(r.ausentes).toBe(0);
    expect(r.pct).toBe(100); // el % se calcula sobre lo registrado
  });

  it('un mes sin ningún registro no divide por cero', () => {
    expect(resumirMes([dia({}), dia({})]).pct).toBe(0);
  });
});
