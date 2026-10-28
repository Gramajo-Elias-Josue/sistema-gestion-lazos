// Tests de utils/linkMail.js: qué trae la dirección cuando la página se
// abre desde el botón de un mail (bienvenida o recuperar contraseña).
import { describe, it, expect } from 'vitest';
import { leerLinkDelMail } from '../src/utils/linkMail.js';

describe('leerLinkDelMail', () => {
  it('bienvenida y recuperar: devuelve el tipo y el código', () => {
    expect(leerLinkDelMail('?token_hash=abc&type=invite', '')).toEqual({ tipo: 'invite', tokenHash: 'abc' });
    expect(leerLinkDelMail('?token_hash=xyz&type=recovery', '')).toEqual({ tipo: 'recovery', tokenHash: 'xyz' });
  });

  it('un tipo que no es de estos mails no cuenta', () => {
    expect(leerLinkDelMail('?token_hash=abc&type=signup', '')).toBeNull();
    expect(leerLinkDelMail('?type=invite', '')).toBeNull();
  });

  it('link vencido o ya usado: Supabase vuelve con el error en el hash', () => {
    const hash = '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&sb=';
    expect(leerLinkDelMail('', hash)).toEqual({ error: 'otp_expired' });
  });

  it('una sección normal de la app no es un link de mail', () => {
    expect(leerLinkDelMail('', '#pacientes')).toBeNull();
    expect(leerLinkDelMail('', '')).toBeNull();
  });
});
