// Tests de la vista de Gastos (views/gastosView.js).
import { describe, it, expect } from 'vitest';
import { renderEstructura, renderResumen, renderLista } from '../src/views/gastosView.js';
import { tonoDe } from '../src/utils/ui.js';

const gastos = [
  { id: 'g1', fecha: '2026-10-05', concepto: 'Factura de luz', categoria: 'Servicios', socio: 'Socio 1', monto: 61200 },
  { id: 'g2', fecha: '2026-10-12', concepto: 'Resmas', categoria: null, socio: 'Socio 2', monto: 38500 },
];

describe('gastosView', () => {
  it('la lista lleva la clase que la vuelve tarjetas en el celular, y el botón de Excel', () => {
    const html = renderEstructura('2026-10');
    expect(html).toContain('tabla-cards');
    expect(html).toContain('btn-excel-gastos');
  });

  it('cada gasto es una tarjeta con el color del socio, el concepto y el monto en la cabecera', () => {
    const html = renderLista(gastos);
    expect(html).toContain(`class="tono-${tonoDe('Socio 1')}"`);
    expect(html).toMatch(/class="tc-nombre ga-concepto">\s*<b>Factura de luz<\/b>\s*<span class="ga-monto-cel">/);
    expect(html).toContain('data-t="Fecha"');
    expect(html).toContain('data-t="Socio"');
    expect(html).toContain('class="tc-acciones"');
  });

  it('sin categoría muestra un guion', () => {
    expect(renderLista(gastos)).toMatch(/data-t="Categoría">—</);
  });

  it('el resumen da cada socio con su color (el mismo que sus gastos) y el total resaltado', () => {
    const html = renderResumen(gastos);
    expect(html).toContain(`kpi tono-${tonoDe('Socio 2')}`);
    expect(html).toContain('ga-total');
    expect(html).toContain('Total del mes');
  });

  it('sin gastos: aviso en la lista y sin resumen', () => {
    expect(renderLista([])).toContain('No hay gastos cargados este mes');
    expect(renderResumen([])).toBe('');
  });
});
