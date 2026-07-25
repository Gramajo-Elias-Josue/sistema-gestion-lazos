// Tests de la vista de Administración/Usuarios (pura: datos -> HTML).
import { describe, it, expect } from 'vitest';
import { renderListaUsuarios, renderFormUsuario } from '../src/views/administracionView.js';

const usuario = (over = {}) => ({
  id: 'u1', nombre: 'Ana Gómez', email: 'ana@lazos.test', rol: 'secretaria', secciones: null, ...over,
});

describe('administracionView.renderListaUsuarios', () => {
  it('estado vacío cuando no hay usuarios', () => {
    expect(renderListaUsuarios([])).toContain('No hay usuarios');
  });

  it('muestra nombre, email y el select de rol', () => {
    const html = renderListaUsuarios([usuario()]);
    expect(html).toContain('Ana Gómez');
    expect(html).toContain('ana@lazos.test');
    expect(html).toMatch(/<option value="secretaria"[^>]*selected/);
  });

  it('secretaría: muestra los checkboxes de secciones y el botón Guardar', () => {
    const html = renderListaUsuarios([usuario()]);
    expect(html).toContain('usr-sec');
    expect(html).toContain('btn-guardar-usr');
    // Sin secciones propias, usa el default del rol: pacientes marcado.
    expect(html).toMatch(/data-sec="pacientes"[^>]*checked/);
  });

  it('respeta las secciones propias del usuario', () => {
    const html = renderListaUsuarios([usuario({ secciones: ['inicio', 'pacientes'] })]);
    expect(html).toMatch(/data-sec="pacientes"[^>]*checked/);
    // "agenda" NO debe estar marcada (no está en sus secciones).
    expect(html).not.toMatch(/data-sec="agenda"[^>]*checked/);
  });

  it('[regresión] al director NO se le editan permisos (acceso total, sin Guardar)', () => {
    const html = renderListaUsuarios([usuario({ rol: 'director', nombre: 'Dir' })]);
    expect(html).toContain('Acceso total');
    // No hay checkboxes ni botón de guardar para el director.
    expect(html).not.toContain('usr-sec');
    expect(html).not.toContain('btn-guardar-usr');
  });

  it('no ofrece tildar "administración" ni "inicio" (reservadas / siempre on)', () => {
    const html = renderListaUsuarios([usuario()]);
    expect(html).not.toContain('data-sec="administracion"');
    expect(html).not.toContain('data-sec="inicio"');
  });

  it('escapa los datos del usuario', () => {
    const html = renderListaUsuarios([usuario({ nombre: '<x>' })]);
    expect(html).not.toContain('<x>');
    expect(html).toContain('&lt;x&gt;');
  });
});

describe('administracionView.renderFormUsuario', () => {
  it('tiene los campos email, contraseña y rol', () => {
    const html = renderFormUsuario();
    expect(html).toContain('name="email"');
    expect(html).toContain('name="password"');
    expect(html).toContain('name="rol"');
    expect(html).toContain('id="form-usuario"');
  });

  it('el alta NO permite crear un director (solo secretaría/profesional)', () => {
    const html = renderFormUsuario();
    expect(html).toContain('value="secretaria"');
    expect(html).toContain('value="profesional"');
    expect(html).not.toContain('value="director"');
  });
});
