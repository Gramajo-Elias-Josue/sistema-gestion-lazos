// Tests del PLAZO de la evaluación diaria (utils/evaluacion.js).
// Regla del centro: la evaluación diaria es OPCIONAL (hay profesionales
// que la llevan en papel), pero si se carga en el sistema se admite
// hasta una semana de atraso. Después el día queda solo para consulta.
import { describe, it, expect } from 'vitest';
import {
  estadoCargaEvaluacion, diasRestantesEvaluacion, DIAS_PLAZO_EVALUACION,
} from '../src/utils/evaluacion.js';

const HOY = '2026-08-10';

describe('estadoCargaEvaluacion', () => {
  it('hoy se puede cargar', () => {
    expect(estadoCargaEvaluacion(HOY, HOY).editable).toBe(true);
  });

  it('ayer y hasta 7 días atrás, también', () => {
    expect(estadoCargaEvaluacion('2026-08-09', HOY).editable).toBe(true);
    expect(estadoCargaEvaluacion('2026-08-03', HOY).editable).toBe(true); // 7 días justos
  });

  it('a los 8 días ya no: el día queda para consulta', () => {
    const r = estadoCargaEvaluacion('2026-08-02', HOY);
    expect(r.editable).toBe(false);
    expect(r.motivo).toBe('vencido');
    expect(r.mensaje).toContain('8 días');
  });

  it('el futuro nunca se evalúa', () => {
    const r = estadoCargaEvaluacion('2026-08-11', HOY);
    expect(r.editable).toBe(false);
    expect(r.motivo).toBe('futuro');
  });

  it('cruza meses y años sin romperse', () => {
    expect(estadoCargaEvaluacion('2025-12-31', '2026-01-05').editable).toBe(true);  // 5 días
    expect(estadoCargaEvaluacion('2025-12-28', '2026-01-05').editable).toBe(false); // 8 días
  });

  it('[regresión] el mensaje está escrito para el usuario', () => {
    const r = estadoCargaEvaluacion('2026-07-01', HOY);
    expect(r.mensaje).not.toMatch(/error|null|undefined|NaN/i);
    expect(r.mensaje).toContain('semana');
  });
});

describe('diasRestantesEvaluacion', () => {
  it('cuenta lo que queda de plazo', () => {
    expect(diasRestantesEvaluacion(HOY, HOY)).toBe(DIAS_PLAZO_EVALUACION); // recién atendido
    expect(diasRestantesEvaluacion('2026-08-04', HOY)).toBe(1);            // queda 1 día
    expect(diasRestantesEvaluacion('2026-08-03', HOY)).toBe(0);            // último día
  });

  it('null cuando ya no se puede cargar', () => {
    expect(diasRestantesEvaluacion('2026-08-02', HOY)).toBe(null);
    expect(diasRestantesEvaluacion('2026-08-11', HOY)).toBe(null);
  });
});
