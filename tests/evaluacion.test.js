// Tests de la estructura de los informes (utils/evaluacion.js): tipos,
// serialización JSON en `contenido` y compatibilidad con datos viejos.
import { describe, it, expect } from 'vitest';
import {
  TIPOS_INFORME, TIPO_CERTIFICADO, tituloPorTipo, parseEvaluacion, serializarEvaluacion, evaluacionVacia,
  autoresElegiblesMes, autoresCertificado,
} from '../src/utils/evaluacion.js';

describe('TIPOS_INFORME', () => {
  it('[regresión] ya no hay informe "diario"; quedan mensual, anual, evolución y admisión', () => {
    expect(TIPOS_INFORME.map(t => t.key)).toEqual(['mensual', 'anual', 'evolucion', 'admision']);
  });
  it('la evaluación / certificado es aparte (no es un informe periódico)', () => {
    expect(TIPOS_INFORME.map(t => t.key)).not.toContain(TIPO_CERTIFICADO.key);
    expect(tituloPorTipo('certificado')).toBe('EVALUACIÓN / CERTIFICADO');
  });
  it('tituloPorTipo devuelve el título o el del primero por defecto', () => {
    expect(tituloPorTipo('anual')).toBe('INFORME ANUAL');
    expect(tituloPorTipo('inexistente')).toBe(TIPOS_INFORME[0].titulo);
  });
});

describe('serializar / parse (roundtrip)', () => {
  it('conserva tipo, título y cuerpo; recorta espacios', () => {
    const json = serializarEvaluacion({ tipo: 'certificado', titulo: 'CERTIFICADO', cuerpo: '  hola  ' });
    const p = parseEvaluacion(json);
    expect(p.tipo).toBe('certificado');
    expect(p.titulo).toBe('CERTIFICADO');
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

// Gate del informe MENSUAL: quién puede cargarlo. Solo por la grilla (la
// agenda de turnos es para casuales sin legajo) y con al menos un día del
// mes en que el paciente y el profesional figuraron presentes.
describe('autoresElegiblesMes', () => {
  const profUno = { nombre_completo: 'Lic. Uno', profesion: 'Psicología' };
  const profGrilla = { nombre_completo: 'Lic. Diario', profesion: 'T.O.' };
  const dia = '2026-10-07';

  it('vía grilla: paciente y profesional presentes el mismo día -> entra sin turno (id null)', () => {
    const asignaciones = [{ profesional_id: 'p2', profesionales: profGrilla }];
    const r = autoresElegiblesMes({ asignaciones, fechasPaciente: [dia], presenciasProf: { p2: new Set([dia]) } });
    expect(r).toEqual([{ id: null, profesional_id: 'p2', profesionales: profGrilla, hora: null }]);
  });

  it('si el PACIENTE no vino en el mes, no entra aunque el profesional sí', () => {
    const asignaciones = [{ profesional_id: 'p2', profesionales: profGrilla }];
    const r = autoresElegiblesMes({ asignaciones, fechasPaciente: [], presenciasProf: { p2: new Set([dia]) } });
    expect(r).toEqual([]);
  });

  it('si el PROFESIONAL no estuvo presente en el mes, no entra', () => {
    const asignaciones = [{ profesional_id: 'p2', profesionales: profGrilla }];
    const r = autoresElegiblesMes({ asignaciones, fechasPaciente: [dia], presenciasProf: {} });
    expect(r).toEqual([]);
  });

  it('asignación sin profesional_id (celda escrita a mano) se ignora', () => {
    const asignaciones = [{ profesional_id: null, profesional_nombre: 'X a mano' }];
    const r = autoresElegiblesMes({ asignaciones, fechasPaciente: [dia], presenciasProf: {} });
    expect(r).toEqual([]);
  });

  it('el profesional que lo tiene en varias franjas aparece una sola vez', () => {
    const asignaciones = [
      { profesional_id: 'p1', profesionales: profUno },
      { profesional_id: 'p1', profesionales: profUno },    // otra franja, mismo profesional
      { profesional_id: 'p2', profesionales: profGrilla },
    ];
    const presenciasProf = { p1: new Set([dia]), p2: new Set([dia]) };
    const r = autoresElegiblesMes({ asignaciones, fechasPaciente: [dia], presenciasProf });
    expect(r.map(a => a.profesional_id)).toEqual(['p1', 'p2']);
  });

  it('sin nada, no hay autores', () => {
    expect(autoresElegiblesMes()).toEqual([]);
  });
});

// Evaluación / certificado (paciente habitual): no exige que haya venido
// HOY, sí que su asistencia con ese profesional esté confirmada alguna vez.
describe('autoresCertificado', () => {
  const profA = { nombre_completo: 'Lic. A' };
  const profB = { nombre_completo: 'Lic. B' };

  it('habilita al profesional si el paciente estuvo presente mientras lo tenía en la grilla', () => {
    const asignaciones = [{ profesional_id: 'a', profesionales: profA, vigente_desde: '2026-08-01', vigente_hasta: null }];
    const r = autoresCertificado({ asignaciones, fechasPresente: ['2026-09-10'] });
    expect(r).toEqual([{ id: null, profesional_id: 'a', profesionales: profA, hora: null }]);
  });

  it('no hace falta que sea hoy, ni que la asignación siga vigente', () => {
    const asignaciones = [{ profesional_id: 'b', profesionales: profB, vigente_desde: '2026-01-01', vigente_hasta: '2026-03-31' }];
    expect(autoresCertificado({ asignaciones, fechasPresente: ['2026-02-15'] }).map(x => x.profesional_id)).toEqual(['b']);
  });

  it('[clave] sin asistencia confirmada con ese profesional, no habilita', () => {
    const asignaciones = [{ profesional_id: 'a', profesionales: profA, vigente_desde: '2026-08-01', vigente_hasta: null }];
    expect(autoresCertificado({ asignaciones, fechasPresente: [] })).toEqual([]);
    // Vino, pero antes de estar asignado a ese profesional.
    expect(autoresCertificado({ asignaciones, fechasPresente: ['2026-07-20'] })).toEqual([]);
  });

  it('cada profesional una sola vez, aunque lo haya tenido en varias franjas', () => {
    const asignaciones = [
      { profesional_id: 'a', profesionales: profA, vigente_desde: '2026-08-01', vigente_hasta: null },
      { profesional_id: 'a', profesionales: profA, vigente_desde: '2026-08-01', vigente_hasta: null },
    ];
    expect(autoresCertificado({ asignaciones, fechasPresente: ['2026-09-01'] })).toHaveLength(1);
  });
});
