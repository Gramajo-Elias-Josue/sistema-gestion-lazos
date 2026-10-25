// Tests de la búsqueda y los filtros del listado de pacientes
// (utils/filtrosPacientes.js). El listado no muestra a todos de entrada:
// solo lo que se busca o el grupo que se elige con "Filtros".
import { describe, it, expect } from 'vitest';
import {
  FILTROS_VACIOS, SIN_OBRA_SOCIAL, cantidadFiltros, hayQueMostrar, pasaFiltros, obrasSociales,
} from '../src/utils/filtrosPacientes.js';

const ana = { buscar: 'ana gómez 30111222 osde', estado: 'activo', cud: 'si', obraSocial: 'OSDE' };
const juan = { buscar: 'juan paz 30111333', estado: 'inactivo', cud: 'no', obraSocial: SIN_OBRA_SOCIAL };
const f = (cambios) => ({ ...FILTROS_VACIOS, ...cambios });

describe('hayQueMostrar', () => {
  it('[clave] de entrada (sin buscar ni filtrar) la lista NO se muestra', () => {
    expect(hayQueMostrar('', FILTROS_VACIOS)).toBe(false);
    expect(hayQueMostrar('   ', FILTROS_VACIOS)).toBe(false);
  });

  it('se muestra al buscar, al elegir un filtro o con "Ver todos"', () => {
    expect(hayQueMostrar('ana', FILTROS_VACIOS)).toBe(true);
    expect(hayQueMostrar('', f({ cud: 'si' }))).toBe(true);
    expect(hayQueMostrar('', f({ verTodos: true }))).toBe(true);
  });
});

describe('pasaFiltros', () => {
  it('busca por nombre, DNI u obra social', () => {
    expect(pasaFiltros(ana, 'ANA', FILTROS_VACIOS)).toBe(true);
    expect(pasaFiltros(ana, '30111222', FILTROS_VACIOS)).toBe(true);
    expect(pasaFiltros(juan, 'ana', FILTROS_VACIOS)).toBe(false);
  });

  it('filtra por estado, CUD y obra social (incluido "sin obra social")', () => {
    expect(pasaFiltros(ana, '', f({ estado: 'activo' }))).toBe(true);
    expect(pasaFiltros(juan, '', f({ estado: 'activo' }))).toBe(false);
    expect(pasaFiltros(juan, '', f({ cud: 'no' }))).toBe(true);
    expect(pasaFiltros(ana, '', f({ obraSocial: 'OSDE' }))).toBe(true);
    expect(pasaFiltros(juan, '', f({ obraSocial: SIN_OBRA_SOCIAL }))).toBe(true);
    expect(pasaFiltros(ana, '', f({ obraSocial: SIN_OBRA_SOCIAL }))).toBe(false);
  });

  it('la búsqueda y los filtros se combinan', () => {
    expect(pasaFiltros(ana, 'ana', f({ cud: 'no' }))).toBe(false);
    expect(pasaFiltros(ana, 'ana', f({ cud: 'si', estado: 'activo' }))).toBe(true);
  });
});

describe('cantidadFiltros y obrasSociales', () => {
  it('cuenta los filtros elegidos (el numerito del botón)', () => {
    expect(cantidadFiltros(FILTROS_VACIOS)).toBe(0);
    expect(cantidadFiltros(f({ estado: 'activo', cud: 'si' }))).toBe(2);
  });

  it('lista las obras sociales sin repetir y ordenadas', () => {
    expect(obrasSociales([{ obra_social: 'PAMI' }, { obra_social: 'OSDE' }, { obra_social: 'PAMI' }, { obra_social: null }]))
      .toEqual(['OSDE', 'PAMI']);
  });
});
