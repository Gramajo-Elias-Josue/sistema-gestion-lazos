// Tests de utils/catalogos.js (listas editables: documentación de
// admisión y categorías de la historia clínica) y del filtro de autores
// de informes según el usuario.
import { describe, it, expect } from 'vitest';
import { claveDesdeNombre, siguienteOrden, nombreRepetido } from '../src/utils/catalogos.js';
import { autoresDelUsuario } from '../src/utils/evaluacion.js';

describe('catalogos', () => {
  it('la clave es el nombre sin tildes, mayúsculas ni espacios', () => {
    expect(claveDesdeNombre('Certificado de Vacunas')).toBe('certificado_de_vacunas');
    expect(claveDesdeNombre('  Medicación / recetas ')).toBe('medicacion_recetas');
  });

  it('un elemento nuevo va al final', () => {
    expect(siguienteOrden([{ orden: 1 }, { orden: 7 }, { orden: 3 }])).toBe(8);
    expect(siguienteOrden([])).toBe(1);
  });

  it('nombre repetido: compara sin tildes ni mayúsculas, salvo contra sí mismo', () => {
    const lista = [{ id: 1, clave: 'medicacion' }, { id: 2, clave: 'escolar' }];
    expect(nombreRepetido(lista, 'MEDICACIÓN')).toBe(true);
    expect(nombreRepetido(lista, 'Medicación', 1)).toBe(false); // renombrando la misma
    expect(nombreRepetido(lista, 'Medicación', 2)).toBe(true);  // otra ya se llama así
    expect(nombreRepetido(lista, 'Vacunas')).toBe(false);
  });
});

describe('autoresDelUsuario', () => {
  const autores = [{ profesional_id: 'a' }, { profesional_id: 'b' }];

  it('el profesional solo puede firmar como él mismo', () => {
    expect(autoresDelUsuario(autores, { rol: 'profesional', profesional_id: 'b' })).toEqual([{ profesional_id: 'b' }]);
    expect(autoresDelUsuario(autores, { rol: 'profesional', profesional_id: null })).toEqual([]);
  });

  it('dirección y secretaría pueden cargar el de cualquiera', () => {
    expect(autoresDelUsuario(autores, { rol: 'director' })).toEqual(autores);
    expect(autoresDelUsuario(autores, { rol: 'secretaria' })).toEqual(autores);
  });
});
