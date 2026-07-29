// Tests del avatar del perfil (utils/avatar.js). Puro: interpreta y arma
// el valor que se guarda en `perfiles.avatar`.
import { describe, it, expect } from 'vitest';
import { AVATARES, parseAvatar, valorPreset, valorFoto, rutaFoto, inicialesDe } from '../src/utils/avatar.js';

describe('avatar.parseAvatar', () => {
  it('sin avatar guardado -> iniciales', () => {
    expect(parseAvatar(null).tipo).toBe('iniciales');
    expect(parseAvatar(undefined).tipo).toBe('iniciales');
    expect(parseAvatar('').tipo).toBe('iniciales');
  });

  it('reconoce un avatar predefinido y devuelve sus datos', () => {
    const r = parseAvatar('preset:navy');
    expect(r.tipo).toBe('preset');
    expect(r.preset.clave).toBe('navy');
    expect(r.preset.color).toBeTruthy();
    expect(r.preset.texto).toBeTruthy();
  });

  it('[compatibilidad] un avatar viejo (emojis) ya no existe -> cae en iniciales', () => {
    expect(parseAvatar('preset:gato').tipo).toBe('iniciales');
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
    expect(parseAvatar(valorPreset('pizarra')).preset.clave).toBe('pizarra');
    expect(parseAvatar(valorFoto('u1/x.png')).ruta).toBe('u1/x.png');
  });
});

describe('avatar.inicialesDe (monograma)', () => {
  it('nombre y apellido -> una letra de cada uno', () => {
    expect(inicialesDe('Ana Gómez')).toBe('AG');
    expect(inicialesDe('  juan  perez  ')).toBe('JP'); // tolera espacios de más
  });

  it('nombre de una sola palabra o email -> dos primeras letras', () => {
    expect(inicialesDe('Director')).toBe('DI');
    expect(inicialesDe('admin@lazos.test')).toBe('AD');
  });

  it('con más de dos palabras usa las dos primeras', () => {
    expect(inicialesDe('María del Carmen Ruiz')).toBe('MD');
  });

  it('vacío o nulo -> US (nunca queda en blanco)', () => {
    expect(inicialesDe('')).toBe('US');
    expect(inicialesDe(null)).toBe('US');
    expect(inicialesDe(undefined)).toBe('US');
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

describe('avatar.AVATARES (catálogo de monogramas)', () => {
  it('todos tienen clave, nombre legible y colores válidos', () => {
    expect(AVATARES.length).toBeGreaterThan(4);
    AVATARES.forEach(a => {
      expect(a.clave).toBeTruthy();
      expect(a.nombre).toBeTruthy();     // se muestra como tooltip
      expect(a.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(a.texto).toMatch(/^#[0-9a-f]{6}$/i);  // color de la letra
    });
  });

  it('las claves y los colores no se repiten', () => {
    expect(new Set(AVATARES.map(a => a.clave)).size).toBe(AVATARES.length);
    expect(new Set(AVATARES.map(a => a.color)).size).toBe(AVATARES.length);
  });

  it('[legibilidad] ningún avatar usa emojis (se ven distinto en cada sistema)', () => {
    AVATARES.forEach(a => expect(a.emoji).toBeUndefined());
  });
});
