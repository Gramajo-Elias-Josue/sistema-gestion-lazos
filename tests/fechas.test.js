// Tests de la lógica de fechas y vencimientos (utils/fechas.js).
// Se enfocan en el bug de zona horaria: las fechas 'yyyy-mm-dd' deben
// interpretarse en horario LOCAL, sin correrse un día (Argentina es UTC-3).
import { describe, it, expect } from 'vitest';
import {
  formatearFecha, diasHasta, estadoVencimiento, calcularEdad,
  hoyISO, sumarDias, rangoMes, nombreDia,
} from '../src/utils/fechas.js';

const pad = (n) => String(n).padStart(2, '0');

describe('formatearFecha', () => {
  it('no corre el día por zona horaria (dd/mm/aaaa)', () => {
    expect(formatearFecha('2013-03-07')).toBe('07/03/2013');
    expect(formatearFecha('2026-01-01')).toBe('01/01/2026');
  });
  it('devuelve — si está vacía', () => {
    expect(formatearFecha('')).toBe('—');
    expect(formatearFecha(null)).toBe('—');
  });
});

describe('diasHasta', () => {
  it('hoy = 0, futuro = positivo, pasado = negativo', () => {
    expect(diasHasta(hoyISO())).toBe(0);
    expect(diasHasta(sumarDias(hoyISO(), 5))).toBe(5);
    expect(diasHasta(sumarDias(hoyISO(), -2))).toBe(-2);
  });
  it('null si no hay fecha', () => {
    expect(diasHasta(null)).toBeNull();
  });
});

describe('estadoVencimiento', () => {
  it('clasifica vencido / por vencer / vigente', () => {
    expect(estadoVencimiento(sumarDias(hoyISO(), -1)).clase).toBe('bad');  // vencido
    expect(estadoVencimiento(sumarDias(hoyISO(), 10)).clase).toBe('warn'); // por vencer
    expect(estadoVencimiento(sumarDias(hoyISO(), 40)).clase).toBe('ok');   // vigente
  });
  it('sin fecha = Cargado', () => {
    expect(estadoVencimiento(null).texto).toBe('Cargado');
  });
  it('el límite de 30 días es "por vencer"', () => {
    expect(estadoVencimiento(sumarDias(hoyISO(), 30)).clase).toBe('warn');
    expect(estadoVencimiento(sumarDias(hoyISO(), 31)).clase).toBe('ok');
  });
});

describe('calcularEdad', () => {
  it('cuenta años cumplidos', () => {
    const d = new Date();
    const hace10 = `${d.getFullYear() - 10}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    expect(calcularEdad(hace10)).toBe(10);
  });
  it('— si no hay fecha', () => {
    expect(calcularEdad(null)).toBe('—');
  });
});

describe('sumarDias', () => {
  it('suma y resta con rollover de mes', () => {
    expect(sumarDias('2026-07-14', 1)).toBe('2026-07-15');
    expect(sumarDias('2026-07-31', 1)).toBe('2026-08-01');
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('rangoMes', () => {
  it('primer y último día del mes', () => {
    expect(rangoMes('2026-07-14')).toEqual({ desde: '2026-07-01', hasta: '2026-07-31' });
    expect(rangoMes('2024-02-10').hasta).toBe('2024-02-29'); // bisiesto
  });
});

describe('hoyISO / nombreDia', () => {
  it('hoyISO tiene formato yyyy-mm-dd', () => {
    expect(hoyISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('nombreDia devuelve el día capitalizado', () => {
    const s = nombreDia('2026-07-14');
    expect(s[0]).toBe(s[0].toUpperCase());
    expect(s.length).toBeGreaterThan(3);
  });
});
