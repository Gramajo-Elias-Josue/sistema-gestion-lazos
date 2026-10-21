// Tests de la grilla de atención (views/grillaAtencionView.js).
// Es la organización general de turnos del centro: UNA TARJETA por
// profesional, coloreada según su sector, con sus franjas horarias de 30
// minutos y el paciente asignado a cada una — como la planilla que se
// llevaba en papel.
import { describe, it, expect } from 'vitest';
import {
  renderGrilla, renderInputCelda, renderListaPacientes,
  contenidoCelda, claveCelda, pacienteDeCelda, franjasDe, franjasEntre, MINUTOS_FRANJA,
} from '../src/views/grillaAtencionView.js';

const sectores = [
  { clave: 'psicologia', etiqueta: 'Psicología' },
  { clave: 'fono', etiqueta: 'Fonoaudiología' },
  { clave: 'to', etiqueta: 'T.O.' },
];
// x1 trabaja a la mañana, x2 a la tarde y x5 en los dos turnos.
const profesionales = [
  { id: 'x1', nombre_completo: 'Flores Ingrid', profesion: 'Psicología', sector: 'psicologia', turnos_trabajo: ['manana'] },
  { id: 'x2', nombre_completo: 'Villafañe Mirka', profesion: 'Fonoaudiología', sector: 'fono', turnos_trabajo: ['tarde'] },
  { id: 'x5', nombre_completo: 'Soria Gabriela', profesion: 'T.O.', sector: 'to', turnos_trabajo: ['manana', 'tarde'] },
];
const pacientes = [
  { id: 'p1', nombre_completo: 'Gálvez Santiago' },
  { id: 'p2', nombre_completo: 'Chein Salvador' },
];
const celdas = {
  'x1|08:00': { id: 'a1', paciente_id: 'p1', pacientes: { nombre_completo: 'Gálvez Santiago' } },
  'x1|08:30': { id: 'a2', paciente_id: 'p2', pacientes: { nombre_completo: 'Chein Salvador' } },
};

const MANANA = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30'];
const TARDE = ['14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'];

describe('franjasEntre', () => {
  it('arma franjas de 30 minutos entre dos horas', () => {
    expect(franjasEntre('10:00', '11:00')).toEqual(['10:00', '10:30']);
    expect(MINUTOS_FRANJA).toBe(30);
  });

  it('rango al revés no rompe: da vacío', () => {
    expect(franjasEntre('15:00', '10:00')).toEqual([]);
  });

  it('se puede pedir otra duración de franja', () => {
    expect(franjasEntre('10:00', '11:00', 15)).toEqual(['10:00', '10:15', '10:30', '10:45']);
  });
});

describe('franjasDe (según los turnos del profesional)', () => {
  it('turno mañana: de 8 a 12, en franjas de 30 minutos', () => {
    expect(franjasDe({ turnos_trabajo: ['manana'] })).toEqual(MANANA);
  });

  it('turno tarde: de 14 a 18', () => {
    expect(franjasDe({ turnos_trabajo: ['tarde'] })).toEqual(TARDE);
  });

  it('[regresión] con los dos turnos NO aparece el mediodía (12 a 14)', () => {
    const franjas = franjasDe({ turnos_trabajo: ['manana', 'tarde'] });
    expect(franjas).toEqual([...MANANA, ...TARDE]);
    expect(franjas).not.toContain('12:00');
    expect(franjas).not.toContain('13:30');
  });

  it('se puede pedir solo las franjas de un turno', () => {
    expect(franjasDe({ turnos_trabajo: ['manana', 'tarde'] }, 'tarde')).toEqual(TARDE);
    expect(franjasDe({ turnos_trabajo: ['manana'] }, 'tarde')).toEqual([]);
  });

  it('sin turno cargado no inventa uno: devuelve vacío', () => {
    expect(franjasDe({})).toEqual([]);
  });
});

describe('claveCelda, pacienteDeCelda y contenidoCelda', () => {
  it('la clave identifica el cruce profesional × hora', () => {
    expect(claveCelda('x1', '10:00')).toBe('x1|10:00');
  });

  it('el paciente sale del vínculo cargado, o null si está vacía', () => {
    expect(pacienteDeCelda({ pacientes: { nombre_completo: 'Gálvez Santiago' } })).toBe('Gálvez Santiago');
    expect(pacienteDeCelda(null)).toBe(null);
  });

  it('la celda vacía no dibuja nada', () => {
    expect(contenidoCelda(null)).toBe('');
  });

  it('la celda cargada muestra el nombre del paciente', () => {
    expect(contenidoCelda({ pacientes: { nombre_completo: 'Gálvez Santiago' } })).toContain('Gálvez Santiago');
  });
});

describe('renderListaPacientes', () => {
  it('una sola lista, con todos los pacientes cargados', () => {
    const html = renderListaPacientes(pacientes);
    expect(html).toContain('id="ga-pacientes"');
    expect(html).toContain('value="Gálvez Santiago"');
    expect(html).toContain('value="Chein Salvador"');
  });
});

describe('renderInputCelda', () => {
  it('apunta a la lista de pacientes, con escritura libre', () => {
    const html = renderInputCelda('');
    expect(html).toContain('list="ga-pacientes"');
    expect(html).toContain('class="ga-input"');
  });

  it('viene con lo que ya tenía la celda', () => {
    expect(renderInputCelda('Gálvez Santiago')).toContain('value="Gálvez Santiago"');
  });

  it('escapa el texto (no se cuela HTML desde la base)', () => {
    expect(renderInputCelda('<b>x</b>')).not.toContain('<b>x</b>');
  });
});

describe('renderGrilla', () => {
  it('una tarjeta por profesional del turno, no por paciente', () => {
    const html = renderGrilla({ profesionales, sectores, pacientes, celdas });
    expect(html).toContain('Flores Ingrid');
    expect(html).not.toContain('<table');
  });

  it('[clave] la pestaña de la mañana muestra solo a los de la mañana, con sus franjas de 8 a 12', () => {
    const html = renderGrilla({ profesionales, sectores, pacientes, celdas, turno: 'manana' });
    expect(html).toContain('Flores Ingrid');
    expect(html).toContain('Soria Gabriela');            // hace los dos turnos
    expect(html).not.toMatch(/<b>Villafañe Mirka<\/b>/);  // es de la tarde
    expect(html).toContain('data-hora="08:00"');
    expect(html).not.toContain('data-hora="14:00"');
  });

  it('[clave] la pestaña de la tarde muestra solo a los de la tarde, con sus franjas de 14 a 18', () => {
    const html = renderGrilla({ profesionales, sectores, pacientes, celdas, turno: 'tarde' });
    expect(html).toContain('Villafañe Mirka');
    expect(html).toContain('Soria Gabriela');
    expect(html).not.toMatch(/<b>Flores Ingrid<\/b>/);
    expect(html).toContain('data-hora="14:00"');
    expect(html).not.toContain('data-hora="08:00"');
  });

  it('trae las dos pestañas de turno, marcando la activa y cuántos hay en cada una', () => {
    const html = renderGrilla({ profesionales, sectores, pacientes, celdas, turno: 'tarde' });
    expect(html).toMatch(/class="tab" data-turno="manana"[\s\S]*?8 a 12 hs · 2/);
    expect(html).toMatch(/class="tab active" data-turno="tarde"[\s\S]*?14 a 18 hs · 2/);
  });

  it('el que no tiene turno no desaparece sin aviso', () => {
    const sinTurno = [...profesionales, { id: 'x4', nombre_completo: 'Nuevo Prof', sector: 'psicologia' }];
    const html = renderGrilla({ profesionales: sinTurno, sectores, pacientes, celdas });
    expect(html).toContain('Sin turno cargado');
    expect(html).toContain('Nuevo Prof');
  });

  it('turno sin nadie: lo dice en vez de quedar en blanco', () => {
    const html = renderGrilla({ profesionales: [profesionales[0]], sectores, pacientes, celdas, turno: 'tarde' });
    expect(html).toContain('Nadie trabaja en el turno tarde');
  });

  it('la celda identifica el cruce profesional × hora, y trae el paciente', () => {
    const html = renderGrilla({ profesionales, sectores, pacientes, celdas });
    expect(html).toMatch(/data-profesional="x1"[^>]*data-hora="08:00"/);
    expect(html).toContain('data-asignacion="a1"');
    expect(html).toContain('Gálvez Santiago');
  });

  it('las franjas sin cargar quedan en blanco, como en una planilla', () => {
    const html = renderGrilla({ profesionales, sectores, pacientes, celdas: {} });
    expect(html).toContain('ga-celda');
    expect(html).not.toContain('ga-nombre');
  });

  it('cada tarjeta lleva su cabecera "HS | PACIENTE", como en la planilla en papel', () => {
    const html = renderGrilla({ profesionales, sectores, pacientes, celdas });
    expect(html).toContain('>HS<');
    expect(html).toContain('>PACIENTE<');
  });

  it('[clave] cada tarjeta se colorea según su sector (ga-area-N)', () => {
    // Psicología es el sector 0 de la lista, Fonoaudiología el 1.
    expect(renderGrilla({ profesionales, sectores, pacientes, celdas, turno: 'manana' }))
      .toMatch(/class="ga-tarjeta ga-area-0"[^>]*>[\s\S]*?Flores Ingrid/);
    expect(renderGrilla({ profesionales, sectores, pacientes, celdas, turno: 'tarde' }))
      .toMatch(/class="ga-tarjeta ga-area-1"[^>]*>[\s\S]*?Villafañe Mirka/);
  });

  it('un profesional sin sector conocido va en un grupo aparte, no se pierde', () => {
    const conSuelto = [...profesionales, { id: 'x3', nombre_completo: 'Roldán Ceci', profesion: 'Musicoterapia', turnos_trabajo: ['manana'] }];
    const html = renderGrilla({ profesionales: conSuelto, sectores, pacientes, celdas });
    expect(html).toContain('Roldán Ceci');
    expect(html).toContain('Sin sector');
  });

  it('cada tarjeta lleva su texto de búsqueda: profesional, sector y sus pacientes de hoy', () => {
    const html = renderGrilla({ profesionales, sectores, pacientes, celdas });
    expect(html).toMatch(/data-buscar="[^"]*flores ingrid[^"]*"/);
    expect(html).toMatch(/data-buscar="[^"]*g[aá]lvez santiago[^"]*"/i);
    expect(html).toContain('ga-buscar'); // el buscador está en la barra
  });

  it('sin permiso de operar se ve pero no se edita', () => {
    const html = renderGrilla({ profesionales, sectores, pacientes, celdas, editable: false });
    expect(html).toContain('bloqueada');
  });

  it('avisos escritos para el usuario cuando falta cargar datos', () => {
    expect(renderGrilla({ profesionales: [], sectores, pacientes })).toContain('No hay profesionales activos');
    expect(renderGrilla({ profesionales, sectores: [], pacientes })).toContain('No hay profesiones cargadas');
  });

  it('trae el carrusel con sus flechas, ocultas hasta que el controlador las use', () => {
    const html = renderGrilla({ profesionales, sectores, pacientes, celdas });
    expect(html).toContain('ga-carrusel');
    expect(html).toContain('id="ga-tarjetas"');
    expect(html).toContain('id="ga-prev"');
    expect(html).toContain('id="ga-next"');
    expect(html).toContain('id="ga-pager-info"');
    expect(html).toMatch(/id="ga-pager"[^>]*hidden/); // arrancan ocultas
    expect(html).toContain('aria-label="Profesional anterior"');
    expect(html).toContain('aria-label="Profesional siguiente"');
  });
});
