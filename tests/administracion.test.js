// Tests de la vista de Administración/Usuarios (pura: datos -> HTML).
// La lista muestra un RESUMEN (rol + chips de secciones) y el detalle se
// edita en el panel de permisos (renderModalPermisos).
import { describe, it, expect } from 'vitest';
import {
  renderListaUsuarios, renderFormUsuario, renderModalPermisos,
} from '../src/views/administracionView.js';

const usuario = (over = {}) => ({
  id: 'u1', nombre: 'Ana Gómez', email: 'ana@lazos.test', rol: 'secretaria', secciones: null, ...over,
});

describe('administracionView.renderListaUsuarios', () => {
  it('estado vacío cuando no hay usuarios', () => {
    expect(renderListaUsuarios([])).toContain('No hay usuarios');
  });

  it('muestra nombre, email, rol y el botón de permisos', () => {
    const html = renderListaUsuarios([usuario()]);
    expect(html).toContain('Ana Gómez');
    expect(html).toContain('ana@lazos.test');
    expect(html).toContain('Secretaría');
    expect(html).toContain('btn-permisos');
  });

  it('resume las secciones como chips (sin inicio ni administración)', () => {
    const html = renderListaUsuarios([usuario({ secciones: ['inicio', 'pacientes', 'agenda'] })]);
    expect(html).toContain('Pacientes');
    expect(html).toContain('Turnos');
    expect(html).not.toContain('>Inicio<');
  });

  it('[regresión] al director NO se le editan permisos (acceso total, sin botón)', () => {
    const html = renderListaUsuarios([usuario({ rol: 'director', nombre: 'Dir' })]);
    expect(html).toContain('Acceso total');
    expect(html).toContain('No editable');
    expect(html).not.toContain('btn-permisos');
  });

  it('escapa los datos del usuario', () => {
    const html = renderListaUsuarios([usuario({ nombre: '<x>' })]);
    expect(html).not.toContain('<x>');
    expect(html).toContain('&lt;x&gt;');
  });
});

describe('administracionView.renderModalPermisos', () => {
  it('trae el rol actual y los checkboxes de secciones', () => {
    const html = renderModalPermisos(usuario());
    expect(html).toContain('id="form-permisos"');
    expect(html).toContain('id="perm-rol"');
    expect(html).toContain('usr-sec');
    expect(html).toMatch(/<option value="secretaria"[^>]*selected/);
  });

  it('marca las secciones efectivas del usuario', () => {
    const html = renderModalPermisos(usuario({ secciones: ['inicio', 'pacientes'] }));
    expect(html).toMatch(/data-sec="pacientes"[^>]*checked/);
    expect(html).not.toMatch(/data-sec="agenda"[^>]*checked/);
  });

  it('sin secciones propias usa el default del rol', () => {
    const html = renderModalPermisos(usuario({ rol: 'profesional' }));
    expect(html).toMatch(/data-sec="pacientes"[^>]*checked/);
    expect(html).not.toMatch(/data-sec="admision"[^>]*checked/);
  });

  it('[regresión] NO se puede asignar el rol Director desde el panel', () => {
    const html = renderModalPermisos(usuario());
    expect(html).not.toContain('value="director"');
  });

  it('no ofrece tildar "administración" ni "inicio" (reservada / siempre on)', () => {
    const html = renderModalPermisos(usuario());
    expect(html).not.toContain('data-sec="administracion"');
    expect(html).not.toContain('data-sec="inicio"');
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

  it('el alta SÍ permite crear un director (es una sociedad, puede haber varios)', () => {
    const html = renderFormUsuario();
    expect(html).toContain('value="secretaria"');
    expect(html).toContain('value="profesional"');
    expect(html).toContain('value="director"');
  });
});
