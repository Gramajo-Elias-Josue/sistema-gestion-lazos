// Tests del avatar del perfil (utils/avatar.js). Puro: interpreta y arma
// el valor que se guarda en `perfiles.avatar`.
import { describe, it, expect } from 'vitest';
import { AVATARES, parseAvatar, valorPreset, valorFoto, rutaFoto } from '../src/utils/avatar.js';

describe('avatar.parseAvatar', () => {
  it('sin avatar guardado -> iniciales', () => {
    expect(parseAvatar(null).tipo).toBe('iniciales');
    expect(parseAvatar(undefined).tipo).toBe('iniciales');
    expect(parseAvatar('').tipo).toBe('iniciales');
  });

  it('reconoce un avatar predefinido y devuelve sus datos', () => {
    const r = parseAvatar('preset:sonrisa');
    expect(r.tipo).toBe('preset');
    expect(r.preset.clave).toBe('sonrisa');
    expect(r.preset.emoji).toBeTruthy();
  });

  it('un preset inexistente cae en iniciales (no rompe)', () => {
    expect(parseAvatar('preset:no_existe').tipo).toBe('iniciales');
  });

  it('reconoce una foto y extrae su ruta', () => {
    const r = parseAvatar('foto:abc-123/1720000000-yo.png');
    expect(r.tipo).toBe('foto');
    expect(r.ruta).toBe('abc-123/1720000000-yo.png');
  });

  it('valor basura -> iniciales', () => {
    expect(parseAvatar('cualquier cosa').tipo).toBe('iniciales');
    expect(parseAvatar('foto:').tipo).toBe('iniciales'); // sin ruta
  });
});

describe('avatar: valores que se guardan', () => {
  it('arma el valor de un preset y de una foto', () => {
    expect(valorPreset('gato')).toBe('preset:gato');
    expect(valorFoto('u1/123-x.png')).toBe('foto:u1/123-x.png');
  });

  it('ida y vuelta: lo que se guarda se vuelve a interpretar igual', () => {
    expect(parseAvatar(valorPreset('luna')).preset.clave).toBe('luna');
    expect(parseAvatar(valorFoto('u1/x.png')).ruta).toBe('u1/x.png');
  });
});

describe('avatar.rutaFoto', () => {
  it('[seguridad] la primera carpeta es el id del usuario', () => {
    // Las políticas del bucket comparan esa carpeta con auth.uid(): así
    // nadie puede pisar la foto de otro.
    const ruta = rutaFoto('usuario-123', 'foto.png');
    expect(ruta.split('/')[0]).toBe('usuario-123');
  });

  it('limpia el nombre del archivo', () => {
    const ruta = rutaFoto('u1', 'mi foto (1).png');
    expect(ruta).not.toContain(' ');
    expect(ruta).not.toContain('(');
    expect(ruta.endsWith('.png')).toBe(true);
  });
});

describe('avatar.AVATARES (catálogo)', () => {
  it('todos tienen clave, emoji y color, y las claves no se repiten', () => {
    expect(AVATARES.length).toBeGreaterThan(4);
    AVATARES.forEach(a => {
      expect(a.clave).toBeTruthy();
      expect(a.emoji).toBeTruthy();
      expect(a.color).toMatch(/^#/);
    });
    expect(new Set(AVATARES.map(a => a.clave)).size).toBe(AVATARES.length);
  });
});
