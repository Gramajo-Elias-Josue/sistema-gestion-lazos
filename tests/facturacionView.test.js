// Tests de la vista de Facturación (views/facturacionView.js).
import { describe, it, expect } from 'vitest';
import { filaHtml, renderFilas, renderEstructura } from '../src/views/facturacionView.js';
import { tonoDe } from '../src/utils/ui.js';

const ana = { id: 'p1', nombre_completo: 'Ana Gómez', obra_social: 'OSDE' };

describe('facturacionView', () => {
  it('cada paciente es una tarjeta con su color, avatar y los 3 estados', () => {
    const html = filaHtml(ana, 'facturado_cobrado');
    expect(html).toContain(`fac-fila tono-${tonoDe('p1')}`);
    expect(html).toContain('class="fac-cab"');
    expect(html).toContain('>AG<');
    expect(html.match(/data-estado="/g)).toHaveLength(3);
    expect(html).toMatch(/data-estado="facturado_cobrado" class="on-fc"/);
  });

  it('sin estado guardado, queda marcado "No facturado"', () => {
    expect(filaHtml(ana)).toMatch(/data-estado="no_facturado" class="on-nf"/);
  });

  it('sin obra social lo dice', () => {
    expect(filaHtml({ id: 'p2', nombre_completo: 'Juan Paz' })).toContain('Sin obra social');
  });

  it('la lista lleva la clase que la vuelve tarjetas en el celular, y el botón de Excel', () => {
    const html = renderEstructura('2026-10');
    expect(html).toContain('fac-lista');
    expect(html).toContain('btn-excel-fac');
  });

  it('sin pacientes activos lo avisa', () => {
    expect(renderFilas([])).toContain('No hay pacientes activos');
  });
});
