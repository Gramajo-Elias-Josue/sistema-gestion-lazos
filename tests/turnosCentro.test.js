// Tests de los turnos del centro (utils/turnosCentro.js): mañana de 8 a
// 12 y tarde de 14 a 18. Cada profesional trabaja en uno o en los dos.
import { describe, it, expect } from 'vitest';
import {
  TURNOS_CENTRO, rangoTurno, turnosDe, horarioDe, textoTurnos, atiendeALaHora, turnoSegunHora,
} from '../src/utils/turnosCentro.js';

const manana = { turnos_trabajo: ['manana'] };
const tarde = { turnos_trabajo: ['tarde'] };
const ambos = { turnos_trabajo: ['tarde', 'manana'] }; // el orden guardado no importa

describe('turnos del centro', () => {
  it('son dos: mañana de 8 a 12 y tarde de 14 a 18', () => {
    expect(TURNOS_CENTRO.map(t => [t.clave, t.desde, t.hasta]))
      .toEqual([['manana', '08:00', '12:00'], ['tarde', '14:00', '18:00']]);
    expect(rangoTurno(TURNOS_CENTRO[0])).toBe('8 a 12 hs');
  });

  it('turnosDe devuelve los del profesional, siempre en orden mañana → tarde', () => {
    expect(turnosDe(ambos).map(t => t.clave)).toEqual(['manana', 'tarde']);
    expect(turnosDe({})).toEqual([]);
    expect(turnosDe(null)).toEqual([]);
  });

  it('horarioDe: del inicio de su primer turno al fin del último', () => {
    expect(horarioDe(manana)).toEqual({ entrada: '08:00', salida: '12:00' });
    expect(horarioDe(tarde)).toEqual({ entrada: '14:00', salida: '18:00' });
    expect(horarioDe(ambos)).toEqual({ entrada: '08:00', salida: '18:00' });
    expect(horarioDe({})).toEqual({ entrada: '', salida: '' });
  });

  it('textoTurnos para mostrar', () => {
    expect(textoTurnos(manana)).toBe('Mañana (8 a 12 hs)');
    expect(textoTurnos(ambos)).toBe('Mañana y tarde');
    expect(textoTurnos({})).toBe('');
  });

  it('[regresión] atiendeALaHora: con los dos turnos, el mediodía queda afuera', () => {
    expect(atiendeALaHora(ambos, '08:00')).toBe(true);
    expect(atiendeALaHora(ambos, '11:30')).toBe(true);
    expect(atiendeALaHora(ambos, '12:00')).toBe(false);
    expect(atiendeALaHora(ambos, '13:00')).toBe(false);
    expect(atiendeALaHora(ambos, '14:00:00')).toBe(true);
    expect(atiendeALaHora(manana, '15:00')).toBe(false);
  });

  it('turnoSegunHora: la grilla abre en el turno en curso', () => {
    expect(turnoSegunHora('07:30')).toBe('manana');
    expect(turnoSegunHora('11:59')).toBe('manana');
    expect(turnoSegunHora('12:00')).toBe('tarde');
    expect(turnoSegunHora('16:45')).toBe('tarde');
  });
});
