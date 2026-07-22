// Tests de las VISTAS (capa de presentación). Las vistas son funciones
// PURAS: reciben datos y devuelven un string de HTML, sin tocar el DOM ni
// Supabase. Por eso se testean como los utils: se las llama y se hacen
// asserts sobre el HTML devuelto.
//
// Además de comprobar lo básico (que los datos aparezcan, estados vacíos),
// varios de estos tests BLINDAN bugs ya corregidos: si alguien los
// reintroduce, el test falla. Se anota "[regresión: …]" en esos casos.
import { describe, it, expect } from 'vitest';
import { renderTabla as tablaPacientes, renderFormPaciente } from '../src/views/pacientesView.js';
import { renderTabla as tablaProfesionales, renderFormProfesional } from '../src/views/profesionalesView.js';
import { renderAlertas } from '../src/views/inicioView.js';

// Fecha ISO a N días de hoy (para armar vencimientos relativos).
const isoDesdeHoy = (dias) => {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  return new Date(d.getTime() + dias * 86400000).toISOString().slice(0, 10);
};

describe('pacientesView.renderTabla', () => {
  const base = { id: 1, nombre_completo: 'Ana Test', dni: '12345678', estado: 'activo' };

  it('muestra el estado vacío cuando no hay pacientes', () => {
    expect(tablaPacientes([])).toContain('No hay pacientes');
  });

  it('muestra el nombre y el DNI del paciente', () => {
    const html = tablaPacientes([base]);
    expect(html).toContain('Ana Test');
    expect(html).toContain('12345678');
  });

  it('[regresión escaping] escapa un nombre con HTML (no lo inyecta crudo)', () => {
    const html = tablaPacientes([{ ...base, nombre_completo: '<script>x</script>' }]);
    expect(html).not.toContain('<script>x</script>'); // no debe aparecer crudo
    expect(html).toContain('&lt;script&gt;');          // sí, escapado
  });

  it('un paciente inactivo se marca como tal', () => {
    const html = tablaPacientes([{ ...base, estado: 'inactivo' }]);
    expect(html).toContain('Inactivo');
  });
});

describe('pacientesView.renderFormPaciente', () => {
  it('[regresión] el formulario NO pide el campo "estado" (es interno)', () => {
    expect(renderFormPaciente({})).not.toContain('name="estado"');       // alta
    expect(renderFormPaciente({ id: 5, estado: 'inactivo' })).not.toContain('name="estado"'); // edición
  });

  it('conserva los datos al editar', () => {
    const html = renderFormPaciente({ id: 5, nombre_completo: 'Juan Pérez', dni: '30111222' });
    expect(html).toContain('Juan Pérez');
    expect(html).toContain('30111222');
    expect(html).toContain('Guardar cambios');
  });
});

describe('profesionalesView.renderTabla (baja lógica)', () => {
  const base = { id: 3, nombre_completo: 'Lic. María', estado: 'activo', asignaciones: [{ count: 2 }] };

  it('[regresión] ya no existe el botón "Eliminar" (borrado real)', () => {
    expect(tablaProfesionales([base])).not.toContain('Eliminar');
    expect(tablaProfesionales([{ ...base, estado: 'inactivo' }])).not.toContain('Eliminar');
  });

  it('activo muestra "Dar de baja"; inactivo muestra "Reactivar"', () => {
    expect(tablaProfesionales([base])).toContain('Dar de baja');
    expect(tablaProfesionales([{ ...base, estado: 'inactivo' }])).toContain('Reactivar');
  });

  it('el botón lleva los data-* que lee el controlador', () => {
    const html = tablaProfesionales([base]);
    expect(html).toContain('btn-baja-prof');
    expect(html).toContain('data-estado="activo"');
  });
});

describe('profesionalesView.renderFormProfesional', () => {
  it('[regresión] el formulario NO pide el campo "estado"', () => {
    expect(renderFormProfesional({})).not.toContain('name="estado"');
    expect(renderFormProfesional({ id: 3, estado: 'inactivo' })).not.toContain('name="estado"');
  });
});

describe('inicioView.renderAlertas (gramática de vencimientos)', () => {
  const doc = (dias) => ({ tipo: 'cud', fecha_vencimiento: isoDesdeHoy(dias), pacientes: { nombre_completo: 'Ana' } });

  it('[regresión] un documento que vence hoy dice "Vence hoy" (no "en 0 días")', () => {
    const html = renderAlertas([doc(0)]);
    expect(html).toContain('Vence hoy');
    expect(html).not.toContain('0 días');
  });

  it('[regresión] singular/plural correcto', () => {
    expect(renderAlertas([doc(1)])).toContain('Vence en 1 día');    // singular
    expect(renderAlertas([doc(1)])).not.toContain('1 días');
    expect(renderAlertas([doc(10)])).toContain('Vence en 10 días'); // plural
    expect(renderAlertas([doc(-1)])).toContain('Vencido hace 1 día');
  });

  it('sin vencimientos próximos muestra el estado tranquilo', () => {
    expect(renderAlertas([doc(200)])).toContain('Sin documentos');
  });
});
