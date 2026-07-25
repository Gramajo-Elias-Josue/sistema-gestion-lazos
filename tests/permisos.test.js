// Tests de la matriz de permisos por rol (permisos.js). Es pura: define
// qué secciones ve cada rol. La seguridad real la pone la RLS (Fase C);
// esto es la capa de UX del front.
import { describe, it, expect } from 'vitest';
import { seccionesDe, puedeVer, etiquetaRol } from '../src/permisos.js';

describe('permisos.puedeVer', () => {
  it('director ve TODO (incluidas estadísticas y administración)', () => {
    for (const s of ['inicio', 'admision', 'pacientes', 'agenda', 'asistencia', 'profesionales', 'estadisticas', 'administracion']) {
      expect(puedeVer('director', s)).toBe(true);
    }
  });

  it('secretaría: operativo completo, SIN estadísticas ni administración', () => {
    for (const s of ['inicio', 'admision', 'pacientes', 'agenda', 'asistencia', 'profesionales']) {
      expect(puedeVer('secretaria', s)).toBe(true);
    }
    expect(puedeVer('secretaria', 'estadisticas')).toBe(false);
    expect(puedeVer('secretaria', 'administracion')).toBe(false);
  });

  it('profesional: solo inicio, pacientes y agenda', () => {
    expect(puedeVer('profesional', 'inicio')).toBe(true);
    expect(puedeVer('profesional', 'pacientes')).toBe(true);
    expect(puedeVer('profesional', 'agenda')).toBe(true);
    for (const s of ['admision', 'asistencia', 'profesionales', 'estadisticas', 'administracion']) {
      expect(puedeVer('profesional', s)).toBe(false);
    }
  });

  it('rol desconocido o null usa el fallback conservador (como secretaría, nunca director)', () => {
    expect(puedeVer(null, 'pacientes')).toBe(true);
    expect(puedeVer(undefined, 'inicio')).toBe(true);
    // El fallback NO da acceso de director:
    expect(puedeVer(null, 'administracion')).toBe(false);
    expect(puedeVer('rol_inventado', 'estadisticas')).toBe(false);
  });
});

describe('permisos.seccionesDe', () => {
  it('devuelve la lista del rol', () => {
    expect(seccionesDe('profesional')).toEqual(['inicio', 'pacientes', 'agenda']);
  });
  it('inicio está permitido para todos los roles', () => {
    for (const rol of ['director', 'secretaria', 'profesional']) {
      expect(seccionesDe(rol)).toContain('inicio');
    }
  });
});

describe('permisos.etiquetaRol', () => {
  it('traduce el rol a una etiqueta legible', () => {
    expect(etiquetaRol('director')).toBe('Director');
    expect(etiquetaRol('secretaria')).toBe('Secretaría');
    expect(etiquetaRol('profesional')).toBe('Profesional');
    expect(etiquetaRol(null)).toBe('Usuario'); // fallback
  });
});
