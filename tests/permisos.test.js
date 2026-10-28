// Tests de la matriz de permisos por USUARIO (permisos.js). Es pura: el rol
// da un set por defecto, cada perfil puede tener secciones propias, y el
// director siempre ve todo. La seguridad real la pone la RLS (Fase C).
import { describe, it, expect } from 'vitest';
import { seccionesPorDefecto, seccionesEfectivas, puedeVer, puedeOperar, etiquetaRol, SECCIONES } from '../src/permisos.js';

// Helper: perfil de prueba.
const perfil = (rol, secciones) => ({ rol, secciones });

describe('permisos.puedeVer (por defecto según rol)', () => {
  it('director ve TODO (incluidas estadísticas y administración)', () => {
    for (const s of SECCIONES.map(x => x.clave)) {
      expect(puedeVer(perfil('director'), s)).toBe(true);
    }
  });

  it('secretaría: operativo completo y estadísticas, SIN administración', () => {
    for (const s of ['inicio', 'admision', 'pacientes', 'agenda', 'asistencia', 'profesionales', 'estadisticas']) {
      expect(puedeVer(perfil('secretaria'), s)).toBe(true);
    }
    expect(puedeVer(perfil('secretaria'), 'administracion')).toBe(false);
  });

  it('profesional: solo inicio, pacientes y agenda', () => {
    expect(puedeVer(perfil('profesional'), 'pacientes')).toBe(true);
    for (const s of ['admision', 'asistencia', 'profesionales', 'estadisticas', 'administracion']) {
      expect(puedeVer(perfil('profesional'), s)).toBe(false);
    }
  });
});

describe('permisos: secciones PROPIAS del usuario (las que asigna el director)', () => {
  it('usa las secciones propias cuando el perfil las tiene', () => {
    const p = perfil('secretaria', ['inicio', 'pacientes']); // recortada por el director
    expect(puedeVer(p, 'pacientes')).toBe(true);
    expect(puedeVer(p, 'agenda')).toBe(false);   // se la quitaron
    expect(puedeVer(p, 'admision')).toBe(false);
  });

  it('secciones propias vacías o null -> cae al set por defecto del rol', () => {
    expect(puedeVer(perfil('profesional', null), 'agenda')).toBe(true);
    expect(puedeVer(perfil('profesional', []), 'agenda')).toBe(true);
  });

  it('al director NO se le pueden recortar secciones (siempre ve todo)', () => {
    const p = perfil('director', ['inicio']); // aunque tenga solo una
    expect(puedeVer(p, 'administracion')).toBe(true);
    expect(puedeVer(p, 'profesionales')).toBe(true);
  });

  it('"inicio" siempre está disponible aunque no esté en la lista', () => {
    const p = perfil('secretaria', ['pacientes']); // sin inicio
    expect(puedeVer(p, 'inicio')).toBe(true);
  });
});

describe('permisos: perfil ausente / fallback', () => {
  it('perfil null usa el fallback conservador (secretaría, nunca director)', () => {
    expect(puedeVer(null, 'pacientes')).toBe(true);
    expect(puedeVer(null, 'administracion')).toBe(false);
  });
});

describe('permisos.seccionesPorDefecto', () => {
  it('devuelve el set por defecto del rol', () => {
    expect(seccionesPorDefecto('profesional')).toEqual(['inicio', 'pacientes', 'agenda', 'galeria']);
  });

  it('la Galería es solo para el profesional (sube su foto) y el CM (usa el material)', () => {
    expect(seccionesPorDefecto('profesional')).toContain('galeria');
    expect(seccionesPorDefecto('cm')).toContain('galeria');
    expect(seccionesPorDefecto('secretaria')).not.toContain('galeria');
  });

  it('el CM no ve nada clínico: solo inicio y galería', () => {
    expect(seccionesPorDefecto('cm')).toEqual(['inicio', 'galeria']);
    expect(seccionesPorDefecto('cm')).not.toContain('pacientes');
    expect(seccionesPorDefecto('cm')).not.toContain('administracion');
  });
});

describe('permisos.seccionesEfectivas', () => {
  it('inicio siempre presente', () => {
    expect(seccionesEfectivas(perfil('secretaria', ['pacientes']))).toContain('inicio');
  });

  it('[regresión] Convenios está oculta: no aparece para nadie, aunque un usuario la tenga guardada', () => {
    expect(SECCIONES.map(s => s.clave)).not.toContain('convenios');
    expect(puedeVer(perfil('director'), 'convenios')).toBe(false);
    expect(puedeVer(perfil('secretaria'), 'convenios')).toBe(false);
    expect(seccionesEfectivas(perfil('secretaria', ['pacientes', 'convenios']))).toEqual(['inicio', 'pacientes']);
  });
});

describe('permisos.puedeOperar (gestionar lo administrativo: agenda, altas…)', () => {
  it('director y secretaría operan; el profesional no', () => {
    expect(puedeOperar(perfil('director'))).toBe(true);
    expect(puedeOperar(perfil('secretaria'))).toBe(true);
    expect(puedeOperar(perfil('profesional'))).toBe(false);
  });

  it('sin perfil no opera (conservador)', () => {
    expect(puedeOperar(null)).toBe(false);
    expect(puedeOperar({})).toBe(false);
  });
});

describe('permisos.etiquetaRol', () => {
  it('traduce el rol a una etiqueta legible', () => {
    expect(etiquetaRol('director')).toBe('Director');
    expect(etiquetaRol('secretaria')).toBe('Secretaría');
    expect(etiquetaRol('profesional')).toBe('Profesional');
    expect(etiquetaRol(null)).toBe('Usuario');
  });
});
