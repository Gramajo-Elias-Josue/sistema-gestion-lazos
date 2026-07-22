// Tests de la estructura de los informes (utils/evaluacion.js): tipos,
// serialización JSON en `contenido` y compatibilidad con datos viejos.
import { describe, it, expect } from 'vitest';
import {
  TIPOS_INFORME, tituloPorTipo, parseEvaluacion, serializarEvaluacion, evaluacionVacia,
} from '../src/utils/evaluacion.js';

describe('TIPOS_INFORME', () => {
  it('incluye "diario" y ya no "evaluacion"', () => {
    const keys = TIPOS_INFORME.map(t => t.key);
    expect(keys).toContain('diario');
    expect(keys).not.toContain('evaluacion');
  });
  it('tituloPorTipo devuelve el título o el del primero por defecto', () => {
    expect(tituloPorTipo('diario')).toBe('INFORME DIARIO');
    expect(tituloPorTipo('inexistente')).toBe(TIPOS_INFORME[0].titulo);
  });
});

describe('serializar / parse (roundtrip)', () => {
  it('conserva tipo, título y cuerpo; recorta espacios', () => {
    const json = serializarEvaluacion({ tipo: 'diario', titulo: 'INFORME DIARIO', cuerpo: '  hola  ' });
    const p = parseEvaluacion(json);
    expect(p.tipo).toBe('diario');
    expect(p.titulo).toBe('INFORME DIARIO');
    expect(p.cuerpo).toBe('hola');
  });
  it('completa el título desde el tipo si viene vacío', () => {
    const json = serializarEvaluacion({ tipo: 'mensual', cuerpo: 'x' });
    expect(JSON.parse(json).titulo).toBe('INFORME MENSUAL');
  });
});

describe('compatibilidad con datos viejos', () => {
  it('texto plano (sin JSON) cae en el cuerpo', () => {
    expect(parseEvaluacion('nota vieja').cuerpo).toBe('nota vieja');
  });
  it('formato anterior (motivo/desarrollo) se mapea', () => {
    const p = parseEvaluacion(JSON.stringify({ motivo: 'M', desarrollo: 'D' }));
    expect(p.cuerpo).toBe('D');
    expect(p.objetivos).toBe('M');
  });
  it('null / vacío devuelve el informe base', () => {
    expect(parseEvaluacion(null).cuerpo).toBe('');
    expect(evaluacionVacia(parseEvaluacion(null))).toBe(true);
  });
});

describe('evaluacionVacia', () => {
  it('true solo si todas las secciones están vacías', () => {
    expect(evaluacionVacia({ objetivos: '', cuerpo: '   ', indicaciones: '' })).toBe(true);
    expect(evaluacionVacia({ cuerpo: 'algo' })).toBe(false);
  });
});
