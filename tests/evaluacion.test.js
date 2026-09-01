// Tests de la estructura de los informes (utils/evaluacion.js): tipos,
// serialización JSON en `contenido` y compatibilidad con datos viejos.
import { describe, it, expect } from 'vitest';
import {
  TIPOS_INFORME, tituloPorTipo, parseEvaluacion, serializarEvaluacion, evaluacionVacia,
  autoresElegiblesHoy,
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

// Gate "atendido hoy": quién puede cargar el informe. Dos vías, ver el
// comentario de la función en utils/evaluacion.js.
describe('autoresElegiblesHoy', () => {
  const profTurno = { nombre_completo: 'Lic. Casual', profesion: 'Psicología' };
  const profGrilla = { nombre_completo: 'Lic. Diario', profesion: 'T.O.' };

  it('vía turno: trae al profesional con turno atendido hoy', () => {
    const turnosAtendidos = [{ id: 't1', profesional_id: 'p1', profesionales: profTurno, hora: '10:00' }];
    const r = autoresElegiblesHoy({ turnosAtendidos });
    expect(r).toEqual([{ id: 't1', profesional_id: 'p1', profesionales: profTurno, hora: '10:00' }]);
  });

  it('vía grilla: paciente y profesional presentes -> entra sin turno (id null)', () => {
    const asignaciones = [{ profesional_id: 'p2', profesionales: profGrilla }];
    const r = autoresElegiblesHoy({
      asignaciones, pacientePresente: true, idsProfPresentes: new Set(['p2']),
    });
    expect(r).toEqual([{ id: null, profesional_id: 'p2', profesionales: profGrilla, hora: null }]);
  });

  it('vía grilla: si el PACIENTE no está presente hoy, no entra aunque el profesional sí', () => {
    const asignaciones = [{ profesional_id: 'p2', profesionales: profGrilla }];
    const r = autoresElegiblesHoy({
      asignaciones, pacientePresente: false, idsProfPresentes: new Set(['p2']),
    });
    expect(r).toEqual([]);
  });

  it('vía grilla: si el PROFESIONAL no fichó presente, no entra', () => {
    const asignaciones = [{ profesional_id: 'p2', profesionales: profGrilla }];
    const r = autoresElegiblesHoy({
      asignaciones, pacientePresente: true, idsProfPresentes: new Set(),
    });
    expect(r).toEqual([]);
  });

  it('asignación sin profesional_id (celda escrita a mano) se ignora', () => {
    const asignaciones = [{ profesional_id: null, profesional_nombre: 'X a mano' }];
    const r = autoresElegiblesHoy({ asignaciones, pacientePresente: true, idsProfPresentes: new Set() });
    expect(r).toEqual([]);
  });

  it('combina las dos vías sin duplicar al profesional que aparece en ambas', () => {
    const turnosAtendidos = [{ id: 't1', profesional_id: 'p1', profesionales: profTurno, hora: '09:00' }];
    const asignaciones = [
      { profesional_id: 'p1', profesionales: profTurno },   // mismo prof. que el turno: no se duplica
      { profesional_id: 'p2', profesionales: profGrilla },  // distinto: se suma
    ];
    const r = autoresElegiblesHoy({
      turnosAtendidos, asignaciones, pacientePresente: true, idsProfPresentes: new Set(['p1', 'p2']),
    });
    expect(r.map(a => a.profesional_id)).toEqual(['p1', 'p2']);
    expect(r[0].id).toBe('t1'); // el de p1 conserva el turno (vino primero por esa vía)
  });

  it('sin nada, no hay autores', () => {
    expect(autoresElegiblesHoy()).toEqual([]);
  });
});
