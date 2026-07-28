// Tests de la traducción de errores de Supabase/Postgres a mensajes claros
// (utils/errores.js). Es pura: recibe el error y devuelve el texto a mostrar.
import { describe, it, expect } from 'vitest';
import { mensajeError } from '../src/utils/errores.js';

describe('mensajeError', () => {
  it('23505 (duplicado): dice QUÉ campo se repitió', () => {
    expect(mensajeError({ code: '23505', message: 'duplicate key ... dni' })).toContain('DNI');
    expect(mensajeError({ code: '23505', message: 'duplicate key ... email' })).toContain('email');
    expect(mensajeError({ code: '23505', message: 'duplicate key ...' })).toContain('ya existe');
  });

  it('23503 (clave foránea) y 23502 (falta dato)', () => {
    expect(mensajeError({ code: '23503' })).toContain('relacionado');
    expect(mensajeError({ code: '23502' })).toContain('obligatorio');
  });

  it('[Fase C] 42501: la RLS por rol rechazó la operación', () => {
    expect(mensajeError({ code: '42501' })).toBe('No tenés permisos para hacer esto con tu rol.');
  });

  it('[Fase C] detecta el error de RLS aunque no venga el código', () => {
    const err = { message: 'new row violates row-level security policy for table "pacientes"' };
    expect(mensajeError(err)).toBe('No tenés permisos para hacer esto con tu rol.');
  });

  it('bucket faltante de Storage', () => {
    expect(mensajeError({ message: 'Bucket not found' })).toContain('bucket');
  });

  it('error desconocido: usa el respaldo e incluye el detalle técnico', () => {
    const msg = mensajeError({ message: 'boom' }, 'No se pudo guardar.');
    expect(msg).toContain('No se pudo guardar.');
    expect(msg).toContain('boom');
  });
});
