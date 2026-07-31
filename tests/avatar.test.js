// Tests del avatar del perfil (utils/avatar.js). Puro: interpreta y arma
// el valor que se guarda en `perfiles.avatar`.
//
// Los avatares predefinidos son ARCHIVOS de src/assets/avatares/, así que
// el catálogo puede estar vacío (si todavía no se cargó ninguno). Por eso
// los tests del catálogo verifican REGLAS, no una lista fija.
import { describe, it, expect } from 'vitest';
import { AVATARES, parseAvatar, valorPreset, valorFoto, rutaFoto, inicialesDe, claveDeArchivo } from '../src/utils/avatar.js';

describe('avatar.parseAvatar', () => {
  it('sin avatar guardado -> iniciales', () => {
    expect(parseAvatar(null).tipo).toBe('iniciales');
    expect(parseAvatar(undefined).tipo).toBe('iniciales');
    expect(parseAvatar('').tipo).toBe('iniciales');
  });

  it('reconoce un avatar del catálogo', () => {
    if (!AVATARES.length) return; // todavía no hay archivos cargados
    const primero = AVATARES[0];
    const r = parseAvatar(valorPreset(primero.clave));
    expect(r.tipo).toBe('preset');
    expect(r.preset.clave).toBe(primero.clave);
    expect(r.preset.url).toBeTruthy();
  });

  it('[robustez] si el archivo del avatar ya no existe -> cae en iniciales', () => {
    // Pasa si se borra un archivo que algún usuario tenía elegido: se
    // muestran sus iniciales en vez de romper la pantalla.
    expect(parseAvatar('preset:archivo_que_no_existe').tipo).toBe('iniciales');
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
    expect(valorPreset('medico')).toBe('preset:medico');
    expect(valorFoto('u1/123-x.png')).toBe('foto:u1/123-x.png');
  });

  it('ida y vuelta de una foto', () => {
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

describe('avatar.inicialesDe (cuando no hay avatar elegido)', () => {
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

describe('avatar.AVATARES (catálogo leído de la carpeta)', () => {
  it('cada avatar tiene clave, nombre legible y url', () => {
    AVATARES.forEach(a => {
      expect(a.clave).toBeTruthy();
      expect(a.nombre).toBeTruthy();
      expect(a.url).toBeTruthy();
    });
  });

  it('las claves no se repiten (dos archivos no pueden pisarse)', () => {
    expect(new Set(AVATARES.map(a => a.clave)).size).toBe(AVATARES.length);
  });

  it('las claves sirven como valor a guardar: sin espacios ni mayúsculas', () => {
    AVATARES.forEach(a => {
      expect(a.clave).toBe(a.clave.toLowerCase());
      expect(a.clave).not.toMatch(/\s/);
      expect(a.clave).toMatch(/^[a-z0-9-]+$/);
    });
  });
});

describe('avatar.claveDeArchivo (el archivo se puede llamar como venga)', () => {
  it('saca la extensión y pasa a minúsculas', () => {
    expect(claveDeArchivo('Secretaria2.png')).toBe('secretaria2');
    expect(claveDeArchivo('doctor.svg')).toBe('doctor');
  });

  it('reemplaza espacios y símbolos por guiones', () => {
    // Nombres típicos de una descarga: "empresario (1).png"
    expect(claveDeArchivo('empresario (1).png')).toBe('empresario-1');
    expect(claveDeArchivo('perfil (2).png')).toBe('perfil-2');
    expect(claveDeArchivo('mujer de negocios.png')).toBe('mujer-de-negocios');
  });

  it('saca los acentos', () => {
    expect(claveDeArchivo('médico.png')).toBe('medico');
    expect(claveDeArchivo('Psicólogá.webp')).toBe('psicologa');
  });

  it('no deja guiones sueltos en los bordes', () => {
    expect(claveDeArchivo('  perfil  .png')).toBe('perfil');
    expect(claveDeArchivo('(1).png')).toBe('1');
  });
});
