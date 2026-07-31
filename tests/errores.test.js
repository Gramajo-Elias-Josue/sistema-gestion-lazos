// Tests de la traducción de errores de Supabase/Postgres a mensajes claros
// (utils/errores.js). Es pura: recibe el error y devuelve el texto a mostrar.
//
// Criterio de los mensajes: se le habla AL USUARIO (personal del centro).
// Nada de códigos, nombres de tablas ni el error técnico en inglés: eso va
// a la consola, no a la pantalla.
import { describe, it, expect } from 'vitest';
import { mensajeError } from '../src/utils/errores.js';

describe('mensajeError', () => {
  it('23505 (duplicado): dice QUÉ campo se repitió', () => {
    expect(mensajeError({ code: '23505', message: 'duplicate key ... dni' })).toContain('DNI');
    expect(mensajeError({ code: '23505', message: 'duplicate key ... email' })).toContain('email');
    expect(mensajeError({ code: '23505', message: 'duplicate key ...' })).toContain('ya está cargado');
  });

  it('23503 (clave foránea) y 23502 (falta dato)', () => {
    expect(mensajeError({ code: '23503' })).toContain('en uso');
    expect(mensajeError({ code: '23502' })).toContain('obligatorio');
  });

  it('[Fase C] 42501: la RLS por rol rechazó la operación', () => {
    expect(mensajeError({ code: '42501' })).toBe('Tu usuario no tiene permiso para hacer esto.');
  });

  it('[Fase C] detecta el error de RLS aunque no venga el código', () => {
    const err = { message: 'new row violates row-level security policy for table "pacientes"' };
    expect(mensajeError(err)).toBe('Tu usuario no tiene permiso para hacer esto.');
  });

  it('bucket faltante de Storage: se avisa sin jerga técnica', () => {
    const msg = mensajeError({ message: 'Bucket not found' });
    expect(msg).toContain('administrador');
    expect(msg.toLowerCase()).not.toContain('bucket'); // el detalle va a la consola
  });

  it('[legibilidad] un error desconocido NO muestra el texto técnico', () => {
    // Antes se agregaba el mensaje original de Supabase (en inglés) entre
    // paréntesis: al usuario no le decía nada y asustaba.
    const msg = mensajeError({ message: 'TypeError: failed to fetch' }, 'No se pudo guardar.');
    expect(msg).toBe('No se pudo guardar.');
    expect(msg).not.toContain('TypeError');
  });

  it('[legibilidad] ningún mensaje deja jerga de programación a la vista', () => {
    const casos = [
      { code: '23505' }, { code: '23503' }, { code: '23502' }, { code: '42501' },
      { message: 'Bucket not found' }, { message: 'algo raro' },
    ];
    casos.forEach(err => {
      const msg = mensajeError(err);
      expect(msg).not.toMatch(/null|undefined|error:|row-level|policy|bucket|constraint/i);
      expect(msg.endsWith('.')).toBe(true);  // siempre una frase terminada
    });
  });
});
