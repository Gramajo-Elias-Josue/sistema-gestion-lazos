// Tests de la grilla de atención (views/grillaAtencionView.js).
// Es la planilla del centro: PACIENTES en las filas (automático),
// SECTORES en las columnas (fijos, ampliables) y, en cada celda, el
// nombre del profesional escrito a mano, como en una planilla de Excel.
import { describe, it, expect } from 'vitest';
import {
  renderGrilla, renderInputCelda, renderListaProfesionales,
  contenidoCelda, claveCelda, nombreDeCelda,
} from '../src/views/grillaAtencionView.js';

const pacientes = [
  { id: 'p1', nombre_completo: 'Bustos Félix', turno: 'tarde' },
  { id: 'p2', nombre_completo: 'Cuello Liam' },
];
const sectores = [
  { clave: 'psicologia', etiqueta: 'Psicología' },
  { clave: 'fono', etiqueta: 'Fonoaudiología' },
  { clave: 'to', etiqueta: 'T.O.' },
];
const profesionales = [
  { id: 'x1', nombre_completo: 'Flores Ingrid', profesion: 'Psicología' },
  { id: 'x2', nombre_completo: 'Villafañe Mirka', profesion: 'Fonoaudiología' },
];
const celdas = {
  'p1|psicologia': {
    id: 'a1', paciente_id: 'p1', sector: 'psicologia',
    profesionales: { nombre_completo: 'Flores Ingrid' },
  },
  'p1|to': { id: 'a2', paciente_id: 'p1', sector: 'to', profesional_nombre: 'X' },
  'p2|fono': { id: 'a3', paciente_id: 'p2', sector: 'fono', profesional_nombre: 'Suárez Marta' },
};

describe('renderGrilla', () => {
  it('los pacientes activos salen solos en la columna izquierda', () => {
    const html = renderGrilla({ pacientes, sectores, celdas, profesionales });
    expect(html).toContain('Bustos Félix');
    expect(html).toContain('Cuello Liam');
  });

  it('la cabecera son los SECTORES, no los profesionales', () => {
    const html = renderGrilla({ pacientes, sectores, celdas, profesionales });
    expect(html).toContain('Psicología');
    expect(html).toContain('Fonoaudiología');
    expect(html).toContain('T.O.');
    expect(html).toContain('Hs de asist');
  });

  it('la celda muestra el nombre del profesional, sin horarios', () => {
    const html = renderGrilla({ pacientes, sectores, celdas, profesionales });
    expect(html).toContain('Flores Ingrid');
    expect(html).not.toContain('09:00'); // [regresión] la hora salió de la grilla
  });

  it('acepta un profesional escrito a mano, aunque no esté cargado', () => {
    const html = renderGrilla({ pacientes, sectores, celdas, profesionales });
    expect(html).toContain('Suárez Marta');
  });

  it('la "X" del papel se ve como X (ese sector no le corresponde)', () => {
    expect(renderGrilla({ pacientes, sectores, celdas, profesionales })).toContain('ga-equis');
  });

  it('cada celda queda identificada por su cruce paciente × sector', () => {
    const html = renderGrilla({ pacientes, sectores, celdas, profesionales });
    expect(html).toContain('data-paciente="p2"');
    expect(html).toContain('data-sector="psicologia"');
    expect(html).toContain('data-asignacion="a1"');
  });

  it('las celdas sin cargar quedan en blanco, como en una planilla', () => {
    const html = renderGrilla({ pacientes, sectores, celdas: {}, profesionales });
    expect(html).toContain('ga-celda');
    expect(html).not.toContain('ga-nombre');
  });

  it('un sector nuevo suma su columna sin tocar nada más', () => {
    const conNuevo = [...sectores, { clave: 'musicoterapia', etiqueta: 'Musicoterapia' }];
    expect(renderGrilla({ pacientes, sectores: conNuevo, celdas, profesionales })).toContain('Musicoterapia');
  });

  it('la columna "Hs de asist" trae el turno de cada paciente', () => {
    const html = renderGrilla({ pacientes, sectores, celdas, profesionales });
    expect(html).toContain('value="tarde" selected'); // Bustos es de tarde
    expect(html).toContain('Mañana');
  });

  it('cada fila lleva su texto de búsqueda: paciente y sus profesionales', () => {
    const html = renderGrilla({ pacientes, sectores, celdas, profesionales });
    expect(html).toContain('data-buscar="bustos félix flores ingrid x"');
    expect(html).toContain('ga-buscar'); // el buscador está en la barra
  });

  it('cada columna trae su botón para quitarla, con el sector identificado', () => {
    const html = renderGrilla({ pacientes, sectores, celdas, profesionales });
    expect(html).toContain('ga-del-sector');
    expect(html).toContain('data-sector="fono"');
    expect(html).toContain('Quitar la columna Fonoaudiología');
  });

  it('sin permiso de operar se ve pero no se edita, ni se agregan ni se quitan columnas', () => {
    const html = renderGrilla({ pacientes, sectores, celdas, profesionales, editable: false });
    expect(html).toContain('bloqueada');
    expect(html).not.toContain('ga-add-sector');
    expect(html).not.toContain('ga-del-sector');
  });

  it('avisos escritos para el usuario cuando falta cargar datos', () => {
    expect(renderGrilla({ pacientes: [], sectores, celdas })).toContain('No hay pacientes activos');
    expect(renderGrilla({ pacientes, sectores: [], celdas })).toContain('No hay sectores cargados');
  });
});

describe('renderInputCelda', () => {
  it('es un campo simple, con sugerencias pero escritura libre', () => {
    const html = renderInputCelda('');
    expect(html).toContain('list="ga-profesionales"');
    expect(html).toContain('class="ga-input"');
  });

  it('viene con lo que ya tenía la celda', () => {
    expect(renderInputCelda('Flores Ingrid')).toContain('value="Flores Ingrid"');
  });

  it('escapa el texto (no se cuela HTML desde la base)', () => {
    expect(renderInputCelda('<b>x</b>')).not.toContain('<b>x</b>');
  });
});

describe('renderListaProfesionales', () => {
  it('arma las sugerencias con los profesionales cargados y su sector', () => {
    const html = renderListaProfesionales(profesionales);
    expect(html).toContain('value="Flores Ingrid"');
    expect(html).toContain('Fonoaudiología');
  });
});

describe('nombreDeCelda y contenidoCelda', () => {
  it('prefiere el profesional del sistema y si no usa el nombre escrito', () => {
    expect(nombreDeCelda({ profesionales: { nombre_completo: 'Flores Ingrid' } })).toBe('Flores Ingrid');
    expect(nombreDeCelda({ profesional_nombre: 'Suárez Marta' })).toBe('Suárez Marta');
    expect(nombreDeCelda(null)).toBe(null);
  });

  it('la celda vacía no dibuja nada', () => {
    expect(contenidoCelda(null)).toBe('');
  });

  it('la clave identifica el cruce', () => {
    expect(claveCelda('p1', 'to')).toBe('p1|to');
  });
});
