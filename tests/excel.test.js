// Tests de lo que se exporta a Excel (utils/excel.js): las filas de cada
// planilla. La descarga en sí (SheetJS) necesita navegador y no se prueba acá.
import { describe, it, expect } from 'vitest';
import { hojasGastos, hojasFacturacion } from '../src/utils/excel.js';

describe('hojasGastos', () => {
  const gastos = [
    { fecha: '2026-10-05', concepto: 'Factura de luz', categoria: 'Servicios', socio: 'Socio 1', monto: '61200.00' },
    { fecha: '2026-10-12', concepto: 'Resmas', categoria: null, socio: 'Socio 2', monto: 38500 },
    { fecha: '2026-10-20', concepto: 'Internet', categoria: 'Servicios', socio: 'Socio 1', monto: 24990 },
  ];
  const [detalle, porSocio] = hojasGastos(gastos, '2026-10');

  it('título con el mes y encabezados', () => {
    expect(detalle.filas[0][0]).toBe('Gastos — Octubre 2026');
    expect(detalle.filas[2]).toEqual(['Fecha', 'Concepto', 'Categoría', 'Socio', 'Monto']);
  });

  it('[clave] el monto va como NÚMERO (para poder sumar en Excel), aunque la base lo devuelva como texto', () => {
    expect(detalle.filas[3]).toEqual(['05/10/2026', 'Factura de luz', 'Servicios', 'Socio 1', 61200]);
    expect(typeof detalle.filas[3][4]).toBe('number');
  });

  it('cierra con el total del mes', () => {
    expect(detalle.filas.at(-1)).toEqual(['', '', '', 'Total', 124690]);
  });

  it('la hoja "Por socio" rinde cuentas de mayor a menor', () => {
    expect(porSocio.nombre).toBe('Por socio');
    expect(porSocio.filas.slice(3, 5)).toEqual([['Socio 1', 86190], ['Socio 2', 38500]]);
    expect(porSocio.filas.at(-1)).toEqual(['Total', 124690]);
  });

  it('marca qué columnas llevan formato de pesos', () => {
    expect(detalle.columnasPesos).toEqual([4]);
    expect(porSocio.columnasPesos).toEqual([1]);
  });
});

describe('hojasFacturacion', () => {
  const pacientes = [
    { id: 'p1', nombre_completo: 'Ana Gómez', dni: '30111222', obra_social: 'OSDE', numero_afiliado: 'AF-1' },
    { id: 'p2', nombre_completo: 'Juan Paz', dni: '30111333', obra_social: null },
    { id: 'p3', nombre_completo: 'Mía Ruiz', dni: '30111444', obra_social: 'PAMI' },
  ];
  const estados = { p1: 'facturado_cobrado', p3: 'facturado_no_cobrado' };
  const [hoja] = hojasFacturacion(pacientes, estados, '2026-10');

  it('un paciente por fila con su estado legible', () => {
    expect(hoja.filas[0][0]).toBe('Facturación — Octubre 2026');
    expect(hoja.filas[3]).toEqual(['Ana Gómez', '30111222', 'OSDE', 'AF-1', 'Cobrado']);
  });

  it('el que no tiene registro cuenta como "No facturado" (igual que en pantalla)', () => {
    expect(hoja.filas[4]).toEqual(['Juan Paz', '30111333', 'Sin obra social', '', 'No facturado']);
  });

  it('cierra con cuántos hay en cada estado', () => {
    expect(hoja.filas.slice(-3)).toEqual([
      ['', '', '', 'No facturado', 1],
      ['', '', '', 'Facturado', 1],
      ['', '', '', 'Cobrado', 1],
    ]);
  });
});
