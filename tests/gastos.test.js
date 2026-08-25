// Tests de la rendición de cuentas de gastos (utils/gastos.js).
import { describe, it, expect } from 'vitest';
import { formatearMonto, resumenPorSocio, totalGastos } from '../src/utils/gastos.js';

describe('formatearMonto', () => {
  it('formatea en pesos argentinos', () => {
    expect(formatearMonto(3500)).toContain('3.500');
    expect(formatearMonto(3500)).toContain('$');
  });

  it('sin monto, muestra guion', () => {
    expect(formatearMonto(null)).toBe('—');
    expect(formatearMonto(undefined)).toBe('—');
  });
});

describe('resumenPorSocio', () => {
  const gastos = [
    { socio: 'Josué', monto: 3500 },
    { socio: 'Ana', monto: 1000 },
    { socio: 'Josué', monto: 500 },
  ];

  it('suma el total de cada socio, de mayor a menor', () => {
    expect(resumenPorSocio(gastos)).toEqual([
      { socio: 'Josué', total: 4000 },
      { socio: 'Ana', total: 1000 },
    ]);
  });

  it('sin gastos, lista vacía', () => {
    expect(resumenPorSocio([])).toEqual([]);
  });
});

describe('totalGastos', () => {
  it('suma todos los montos', () => {
    expect(totalGastos([{ monto: 100 }, { monto: 250.5 }])).toBe(350.5);
  });

  it('sin gastos, 0', () => {
    expect(totalGastos([])).toBe(0);
  });
});
