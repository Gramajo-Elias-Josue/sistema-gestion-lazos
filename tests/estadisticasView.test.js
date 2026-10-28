// Tests de la vista de Estadísticas (views/estadisticasView.js).
import { describe, it, expect } from 'vitest';
import {
  renderEstructura, columnasPorMes, barrasHorizontales,
  renderAsistencia, renderAtencion, renderInformes, renderGestion,
} from '../src/views/estadisticasView.js';

describe('estadisticasView: gráficos', () => {
  it('columnas: la más alta llega al 100% y las demás en proporción; pie con el mes corto', () => {
    const html = columnasPorMes([
      { periodo: '2026-09', partes: [{ valor: 5, clase: 'es-ok' }] },
      { periodo: '2026-10', partes: [{ valor: 8, clase: 'es-ok' }, { valor: 2, clase: 'es-mal' }] },
    ]);
    expect(html).toContain('height:50%');
    expect(html).toContain('height:100%');
    expect(html).toContain('Sep 26');
    expect(html).toContain('Oct 26');
  });

  it('columnas sin ningún dato muestran un mensaje en vez de barras vacías', () => {
    expect(columnasPorMes([{ periodo: '2026-10', partes: [{ valor: 0, clase: 'es-ok' }] }])).toContain('Sin datos');
  });

  it('barras horizontales: ancho relativo a su propio máximo (ej. franjas ocupadas / totales)', () => {
    const html = barrasHorizontales([{ etiqueta: 'Lic. A', valor: 4, max: 8, texto: '4/8' }]);
    expect(html).toContain('width:50%');
    expect(html).toContain('4/8');
  });

  it('escapa los textos (nombres que vienen de la base)', () => {
    const html = barrasHorizontales([{ etiqueta: '<b>x</b>', valor: 1 }]);
    expect(html).not.toContain('<b>x</b>');
    expect(html).toContain('&lt;b&gt;');
  });
});

describe('estadisticasView: bloques', () => {
  it('la estructura tiene la navegación por mes y los cuatro bloques', () => {
    const html = renderEstructura('2026-10');
    for (const id of ['es-prev', 'es-next', 'es-hoy', 'es-asistencia', 'es-atencion', 'es-informes', 'es-gestion']) {
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).toContain('Octubre 2026');
  });

  it('asistencia: % del mes elegido y mensaje cuando nadie faltó', () => {
    const html = renderAsistencia({
      periodo: '2026-10',
      porMes: [{ periodo: '2026-10', total: 10, presentes: 9, ausentes: 1, aviso: 0, enfermedad: 0, pct: 90 }],
      ausentismo: [], fichaje: [],
    });
    expect(html).toContain('90%');
    expect(html).toContain('9 presentes de 10 registros');
    expect(html).toContain('Nadie faltó este mes.');
  });

  it('atención: muestra los totales de pacientes', () => {
    const html = renderAtencion({ resumen: { activos: 23, inactivos: 2, enAdmision: 3, conCud: 15 } });
    expect(html).toContain('>23<');
    expect(html).toContain('15 con CUD');
  });

  it('informes: el profesional al día se marca como completo', () => {
    const html = renderInformes({ periodo: '2026-10', entregas: [{ id: 'a', nombre: 'Lic. A', entregados: 3, pacientes: 3, pct: 100 }] });
    expect(html).toContain('es-completo');
    expect(html).toContain('3/3');
  });

  it('gestión: estados del mes y total de gastos en pesos', () => {
    const html = renderGestion({
      periodo: '2026-10',
      resumenMes: { no_facturado: 4, facturado_no_cobrado: 5, facturado_cobrado: 14 },
      total: 151200,
    });
    expect(html).toContain('>14<');
    expect(html).toContain('Sin facturar');
    expect(html).toMatch(/151\.200/);
  });
});
