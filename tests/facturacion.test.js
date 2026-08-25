// Tests del control de facturación (utils/facturacion.js). Es solo
// CONTROL de estado por paciente y por mes: no genera facturas ni
// calcula montos.
import { describe, it, expect } from 'vitest';
import { ESTADOS_FACTURACION, ESTADO_POR_DEFECTO, resumenFacturacion } from '../src/utils/facturacion.js';

describe('ESTADOS_FACTURACION', () => {
  it('tiene los 3 estados pedidos, en orden', () => {
    expect(ESTADOS_FACTURACION.map(e => e.valor)).toEqual([
      'no_facturado', 'facturado_no_cobrado', 'facturado_cobrado',
    ]);
  });
});

describe('resumenFacturacion', () => {
  const pacientes = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];

  it('cuenta cada paciente en su estado', () => {
    const estadosPorId = { 1: 'facturado_cobrado', 2: 'facturado_no_cobrado', 3: 'facturado_cobrado' };
    const r = resumenFacturacion(pacientes, estadosPorId);
    expect(r).toEqual({ no_facturado: 1, facturado_no_cobrado: 1, facturado_cobrado: 2 });
  });

  it('el paciente sin fila todavía cuenta como no_facturado', () => {
    const r = resumenFacturacion(pacientes, {});
    expect(r.no_facturado).toBe(4);
  });

  it(`por defecto es "${ESTADO_POR_DEFECTO}"`, () => {
    expect(resumenFacturacion([{ id: 9 }], {})[ESTADO_POR_DEFECTO]).toBe(1);
  });
});
