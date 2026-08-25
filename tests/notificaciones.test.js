// Tests de las notificaciones globales (campana del encabezado):
// utils/notificaciones.js. Junta informes/fotos pendientes (lo que sí
// requiere atención) con cumpleaños próximos (aviso menor), calculados
// de nuevo cada vez (sin persistencia ni "marcar como visto").
import { describe, it, expect } from 'vitest';
import { proximoCumpleanos, cumpleañosProximos, notificacionesCumpleanos, notificacionesGlobales, DIAS_AVISO_CUMPLEANOS } from '../src/utils/notificaciones.js';

describe('proximoCumpleanos', () => {
  it('es hoy: 0 días y la edad que cumple hoy', () => {
    expect(proximoCumpleanos('1990-08-09', '2026-08-09')).toEqual({ faltan: 0, edad: 36 });
  });

  it('todavía no llegó este año: cuenta los días que faltan', () => {
    expect(proximoCumpleanos('1990-08-15', '2026-08-09')).toEqual({ faltan: 6, edad: 36 });
  });

  it('ya pasó este año: cuenta para el del año que viene', () => {
    expect(proximoCumpleanos('1990-01-05', '2026-08-09')).toEqual({ faltan: 149, edad: 37 });
  });

  it('cruza fin de año sin romperse: diciembre mirando un cumpleaños de enero', () => {
    const r = proximoCumpleanos('1985-01-05', '2026-12-30');
    expect(r.faltan).toBe(6);   // 31 dic + 4 ene + el 5 ene = 6 días
    expect(r.edad).toBe(42);    // cumple en 2027
  });

  it('sin fecha cargada, no rompe: devuelve null', () => {
    expect(proximoCumpleanos(null, '2026-08-09')).toBeNull();
    expect(proximoCumpleanos(undefined, '2026-08-09')).toBeNull();
  });
});

describe('cumpleañosProximos', () => {
  const personas = [
    { id: 1, nombre_completo: 'Hoy Mismo', fecha_nacimiento: '1990-08-09' },
    { id: 2, nombre_completo: 'En Tres Días', fecha_nacimiento: '1990-08-12' },
    { id: 3, nombre_completo: 'Lejos', fecha_nacimiento: '1990-11-20' },
    { id: 4, nombre_completo: 'Sin Fecha', fecha_nacimiento: null },
  ];

  it('solo trae los que están dentro de la ventana, ordenados por cercanía', () => {
    const r = cumpleañosProximos(personas, { hoy: '2026-08-09', dias: DIAS_AVISO_CUMPLEANOS });
    expect(r.map(x => x.persona.nombre_completo)).toEqual(['Hoy Mismo', 'En Tres Días']);
    expect(r[0].faltan).toBe(0);
    expect(r[1].faltan).toBe(3);
  });

  it('ventana en 0 días: solo los que cumplen hoy', () => {
    const r = cumpleañosProximos(personas, { hoy: '2026-08-09', dias: 0 });
    expect(r.map(x => x.persona.nombre_completo)).toEqual(['Hoy Mismo']);
  });
});

describe('notificacionesCumpleanos', () => {
  const pacientes = [{ id: 'p1', nombre_completo: 'Paciente Hoy', diagnostico: 'TEA', fecha_nacimiento: '2015-08-09' }];
  const profesionales = [{ id: 'f1', nombre_completo: 'Profesional Hoy', profesion: 'Psicología', fecha_nacimiento: '1980-08-09' }];

  it('junta pacientes y profesionales, cada uno con su tipo', () => {
    const r = notificacionesCumpleanos({ pacientes, profesionales, hoy: '2026-08-09' });
    expect(r).toHaveLength(2);
    expect(r.find(x => x.tipo === 'paciente').persona.nombre_completo).toBe('Paciente Hoy');
    expect(r.find(x => x.tipo === 'profesional').persona.nombre_completo).toBe('Profesional Hoy');
  });

  it('respeta lo que el perfil puede ver: sin permiso, no trae ese grupo', () => {
    const r = notificacionesCumpleanos({
      pacientes, profesionales, hoy: '2026-08-09',
      verPacientes: false, verProfesionales: true,
    });
    expect(r).toHaveLength(1);
    expect(r[0].tipo).toBe('profesional');
  });
});

describe('notificacionesGlobales', () => {
  const cumpleanos = [{ tipo: 'paciente', persona: { nombre_completo: 'Ana' }, faltan: 0, edad: 10 }];
  const pendientes = {
    informes: [{ id: 'f1', nombre_completo: 'Flores Ingrid' }],
    fotos: [{ id: 'f2', nombre_completo: 'Villafañe Mirka' }],
  };

  it('los pendientes (informe y foto) van primero, los cumpleaños al final', () => {
    const r = notificacionesGlobales({ cumpleanos, pendientes });
    expect(r.map(x => x.tipo)).toEqual(['informe', 'foto', 'cumpleanos']);
  });

  it('arma el texto de cada tipo', () => {
    const [informe, foto, cumple] = notificacionesGlobales({ cumpleanos, pendientes });
    expect(informe.titulo).toBe('Flores Ingrid');
    expect(informe.detalle).toBe('Debe el informe del mes');
    expect(foto.detalle).toBe('No subió su foto del mes');
    expect(cumple.titulo).toBe('Ana');
    expect(cumple.detalle).toBe('Cumple 10 años · Hoy');
  });

  it('sin nada pendiente ni cumpleaños, devuelve lista vacía', () => {
    expect(notificacionesGlobales()).toEqual([]);
  });

  it('avisarEntregas en false: los pendientes no molestan, los cumpleaños siguen', () => {
    const r = notificacionesGlobales({ cumpleanos, pendientes, avisarEntregas: false });
    expect(r.map(x => x.tipo)).toEqual(['cumpleanos']);
  });
});
