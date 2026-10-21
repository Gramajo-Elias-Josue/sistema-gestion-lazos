// Tests de las áreas de intervención (utils/areas.js).
// El área de un profesional sale de su campo `sector`; para los cargados
// antes de existir ese campo se adivina por `profesion`, que es texto
// libre: cada quien escribe distinto, así que se tiene que reconocer igual.
import { describe, it, expect } from 'vitest';
import { areaDeProfesion, normalizar, areaDelProfesional } from '../src/utils/areas.js';

describe('areaDeProfesion', () => {
  it('reconoce la profesión escrita de cualquier forma', () => {
    expect(areaDeProfesion('psicologa')).toBe('psicologia');
    expect(areaDeProfesion('Lic. en Fonoaudiología')).toBe('fono');
    expect(areaDeProfesion('Terapia Ocupacional')).toBe('to');
    expect(areaDeProfesion('T.O.')).toBe('to');
    expect(areaDeProfesion('kinesiologo')).toBe('kinesiologia');
  });

  it('psicopedagogía no se confunde con psicología', () => {
    expect(areaDeProfesion('Psicopedagogía')).toBe('psicopedagogia');
  });

  it('es una lista abierta: lo que no está no se pierde, queda sin área', () => {
    expect(areaDeProfesion('Musicoterapia')).toBe(null);
    expect(areaDeProfesion('')).toBe(null);
    expect(areaDeProfesion(null)).toBe(null);
  });
});

describe('areaDelProfesional', () => {
  it('usa el campo sector si lo tiene', () => {
    expect(areaDelProfesional({ sector: 'fono', profesion: 'Psicología' })).toBe('fono');
  });

  it('sin sector, cae de reserva a adivinar por "profesion"', () => {
    expect(areaDelProfesional({ profesion: 'Psicología' })).toBe('psicologia');
  });

  it('[regresión] sin sector NI profesión reconocida, da null (no undefined)', () => {
    expect(areaDelProfesional({})).toBe(null);
    expect(areaDelProfesional(undefined)).toBe(null);
    expect(areaDelProfesional({ profesion: 'Musicoterapia' })).toBe(null);
  });
});

describe('normalizar', () => {
  it('saca tildes y mayúsculas para poder comparar nombres', () => {
    expect(normalizar('Fonoaudiología')).toBe('fonoaudiologia');
    expect(normalizar('  Flores INGRID ')).toBe('flores ingrid');
  });

  it('la ñ también se compara sin acento: "Villafañe" = "Villafane"', () => {
    // Así, si el nombre se escribió sin la ñ, igual reconoce al paciente
    // cargado en el sistema al escribirlo en la grilla.
    expect(normalizar('Villafañe Mirka')).toBe(normalizar('Villafane mirka'));
  });
});
