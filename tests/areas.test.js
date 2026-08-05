// Tests de las áreas de intervención (utils/areas.js).
// `profesionales.profesion` es texto libre: cada quien escribe distinto,
// así que lo importante es que se reconozca igual y que las columnas
// salgan siempre en el mismo orden.
import { describe, it, expect } from 'vitest';
import { areaDeProfesion, etiquetaArea, ordenarPorArea, normalizar } from '../src/utils/areas.js';

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

  it('etiquetaArea devuelve el nombre legible', () => {
    expect(etiquetaArea('to')).toBe('T.O.');
    expect(etiquetaArea('inventada')).toBe(null);
  });
});

describe('normalizar', () => {
  it('saca tildes y mayúsculas para poder comparar nombres', () => {
    expect(normalizar('Fonoaudiología')).toBe('fonoaudiologia');
    expect(normalizar('  Flores INGRID ')).toBe('flores ingrid');
  });

  it('la ñ también se compara sin acento: "Villafañe" = "Villafane"', () => {
    // Así, si el nombre se escribió sin la ñ, igual reconoce al profesional
    // cargado en el sistema en vez de guardarlo como nombre suelto.
    expect(normalizar('Villafañe Mirka')).toBe(normalizar('Villafane mirka'));
  });
});

describe('ordenarPorArea', () => {
  it('agrupa por área y, dentro de cada una, ordena por nombre', () => {
    const orden = ordenarPorArea([
      { nombre_completo: 'Raiden Jessica', profesion: 'Terapia Ocupacional' },
      { nombre_completo: 'Pérez Ana', profesion: 'Musicoterapia' },
      { nombre_completo: 'Villafañe Mirka', profesion: 'Fonoaudiología' },
      { nombre_completo: 'Flores Ingrid', profesion: 'Psicología' },
      { nombre_completo: 'Funez Nazareth', profesion: 'Terapia Ocupacional' },
    ]).map(p => p.nombre_completo);

    expect(orden).toEqual([
      'Flores Ingrid',    // psicología
      'Villafañe Mirka',  // fono
      'Funez Nazareth',   // T.O. (alfabético dentro del área)
      'Raiden Jessica',
      'Pérez Ana',        // sin área conocida: al final
    ]);
  });

  it('no modifica el arreglo original', () => {
    const original = [{ nombre_completo: 'B', profesion: 'Fono' }, { nombre_completo: 'A', profesion: 'Psicología' }];
    ordenarPorArea(original);
    expect(original[0].nombre_completo).toBe('B');
  });
});
