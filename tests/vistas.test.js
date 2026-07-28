// Tests de las VISTAS (capa de presentación). Las vistas son funciones
// PURAS: reciben datos y devuelven un string de HTML, sin tocar el DOM ni
// Supabase. Por eso se testean como los utils: se las llama y se hacen
// asserts sobre el HTML devuelto.
//
// Además de comprobar lo básico (que los datos aparezcan, estados vacíos),
// varios de estos tests BLINDAN bugs ya corregidos: si alguien los
// reintroduce, el test falla. Se anota "[regresión: …]" en esos casos.
import { describe, it, expect } from 'vitest';
import {
  renderTabla as tablaPacientes, renderFormPaciente, renderEvaluacionesHistoria,
} from '../src/views/pacientesView.js';
import { renderTabla as tablaProfesionales, renderFormProfesional } from '../src/views/profesionalesView.js';
import { renderAlertas } from '../src/views/inicioView.js';
import { renderLista as listaTurnos, renderFormTurno, renderEstructura } from '../src/views/turnosView.js';
import { renderLista as listaAdmision, renderAdmision } from '../src/views/admisionView.js';
import { renderFilas as filasAsistencia, filaHtml as filaAsistencia } from '../src/views/asistenciaView.js';
import { filaHtml as filaFichaje, renderFilas as filasFichaje } from '../src/views/asistenciaProfView.js';
import { renderLogin } from '../src/views/loginView.js';

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

describe('turnosView.renderLista', () => {
  const turno = {
    id: 9, estado: 'programado', hora: '10:30:00',
    pacientes: { nombre_completo: 'Ana Test', dni: '12345678' },
    profesionales: { nombre_completo: 'Lic. María', profesion: 'Psicología' },
  };

  it('muestra el estado vacío cuando no hay turnos', () => {
    expect(listaTurnos([])).toContain('No hay turnos');
  });

  it('muestra hora (HH:MM), paciente y profesional', () => {
    const html = listaTurnos([turno]);
    expect(html).toContain('10:30');
    expect(html).not.toContain('10:30:00'); // recorta los segundos
    expect(html).toContain('Ana Test');
    expect(html).toContain('Lic. María');
  });

  it('el selector de estado marca el estado actual como selected', () => {
    const html = listaTurnos([{ ...turno, estado: 'atendido' }]);
    expect(html).toMatch(/<option value="atendido"[^>]*selected/);
  });

  it('escapa el nombre del paciente', () => {
    const html = listaTurnos([{ ...turno, pacientes: { nombre_completo: '<x>', dni: '1' } }]);
    expect(html).not.toContain('<x>');
    expect(html).toContain('&lt;x&gt;');
  });

  it('[agenda de la secretaría] en modo consulta no hay selector de estado ni Eliminar', () => {
    const html = listaTurnos([turno], false); // puedeOperar = false (profesional)
    expect(html).not.toContain('turno-estado');       // no puede marcar "Atendido"
    expect(html).not.toContain('btn-eliminar-turno'); // ni eliminar
    expect(html).toContain('Ana Test');               // pero sí ve el turno
    expect(html).toContain('Programado');             // (la pill de estado sigue visible)
  });

  it('quien gestiona la agenda sí ve el selector y Eliminar', () => {
    const html = listaTurnos([turno], true);
    expect(html).toContain('turno-estado');
    expect(html).toContain('btn-eliminar-turno');
  });
});

describe('turnosView.renderEstructura (según el rol)', () => {
  it('quien gestiona la agenda ve "+ Nuevo turno"', () => {
    const html = renderEstructura('2026-07-16', true);
    expect(html).toContain('btn-nuevo-turno');
    expect(html).not.toContain('Solo consulta');
  });

  it('[agenda de la secretaría] el profesional ve "Solo consulta", sin crear turnos', () => {
    const html = renderEstructura('2026-07-16', false);
    expect(html).not.toContain('btn-nuevo-turno');
    expect(html).toContain('Solo consulta');
    expect(html).toContain('t-fecha'); // pero puede navegar las fechas
  });
});

describe('turnosView.renderFormTurno', () => {
  const pac = { id: 1, nombre_completo: 'Ana', dni: '123' };
  const prof = { id: 2, nombre_completo: 'Lic. María', profesion: 'Psicología', horario_entrada: '08:00', horario_salida: '16:00', dias_trabajo: ['Lunes'] };

  it('avisa si faltan pacientes o profesionales cargados', () => {
    expect(renderFormTurno([], [prof], '2026-07-16')).toContain('Necesitás al menos un paciente');
    expect(renderFormTurno([pac], [], '2026-07-16')).toContain('Necesitás al menos un paciente');
  });

  it('con datos completos, no muestra el aviso', () => {
    expect(renderFormTurno([pac], [prof], '2026-07-16')).not.toContain('Necesitás al menos un paciente');
  });

  it('las opciones de profesional llevan los data-* que lee el controlador', () => {
    const html = renderFormTurno([pac], [prof], '2026-07-16');
    expect(html).toContain('data-entrada="08:00"');
    expect(html).toContain('data-salida="16:00"');
    expect(html).toContain('data-dias='); // días de trabajo serializados
  });
});

describe('admisionView', () => {
  const pac = { id: 1, nombre_completo: 'Ana Test', dni: '123', tiene_cud: true };

  it('estado vacío cuando no hay admisiones', () => {
    expect(listaAdmision([])).toContain('No hay pacientes en proceso de admisión');
  });

  it('la lista muestra el paciente y su estado de CUD', () => {
    const html = listaAdmision([pac]);
    expect(html).toContain('Ana Test');
    expect(html).toContain('Con CUD');
    expect(html).toContain('Abrir admisión'); // botón de acción
  });

  it('renderAdmision arma el checklist con el progreso', () => {
    // "dni" presentado; el resto pendiente.
    const checklist = [{ requisito: 'dni', presentado: true, observaciones: '' }];
    const html = renderAdmision(pac, checklist);
    expect(html).toContain('DNI (copia)');
    expect(html).toContain('Presentado'); // el requisito marcado
    expect(html).toContain('Pendiente');  // los no marcados
    expect(html).toContain('1 / 7 presentados'); // 7 requisitos estándar
  });
});

// Helper: arma el objeto `vista` que espera asistenciaView.filaHtml.
const vistaAsis = (over = {}) => ({
  seleccion: {}, notas: {}, mesStats: {}, guardado: {}, editando: {}, bloqueado: false, ...over,
});

describe('asistenciaView.filaHtml (planilla de pacientes)', () => {
  const pac = { id: 1, nombre_completo: 'Ana Test', diagnostico: 'TEA' };

  it('estado vacío cuando no hay pacientes', () => {
    expect(filasAsistencia([], vistaAsis())).toContain('No hay pacientes');
  });

  it('sin marca: los botones de estado están habilitados', () => {
    // Ojo: el lápiz ✎ sí va disabled cuando no hay nada guardado, así que se
    // apunta específicamente al botón de estado (data-estado), no a toda la fila.
    const html = filaAsistencia(pac, vistaAsis());
    expect(html.match(/data-estado="presente"[^>]*disabled/)).toBeFalsy();
  });

  it('ya guardado y sin editar: los botones de estado quedan bloqueados', () => {
    const html = filaAsistencia(pac, vistaAsis({ seleccion: { 1: 'presente' }, guardado: { 1: true } }));
    expect(html.match(/data-estado="presente"[^>]*disabled/)).toBeTruthy();
  });

  it('fecha futura (bloqueado): los botones de estado se deshabilitan', () => {
    const html = filaAsistencia(pac, vistaAsis({ bloqueado: true }));
    expect(html.match(/data-estado="presente"[^>]*disabled/)).toBeTruthy();
  });

  it('el estado seleccionado recibe su clase activa', () => {
    const html = filaAsistencia(pac, vistaAsis({ seleccion: { 1: 'presente' } }));
    expect(html).toContain('on-p'); // clase del botón "Presente" activo
  });

  it('muestra el porcentaje mensual si hay datos', () => {
    const html = filaAsistencia(pac, vistaAsis({ mesStats: { 1: { presentes: 8, total: 10, pct: 80 } } }));
    expect(html).toContain('80%');
  });
});

describe('asistenciaProfView.filaHtml (fichaje)', () => {
  const prof = { id: 5, nombre_completo: 'Lic. María', profesion: 'Psicología', horario_entrada: '08:00', horario_salida: '16:00' };

  it('estado vacío cuando no hay profesionales', () => {
    expect(filasFichaje([], {}, {})).toContain('No hay profesionales activos');
  });

  it('fecha futura muestra el aviso', () => {
    const html = filasFichaje([prof], {}, { bloqueado: true });
    expect(html).toContain('Fecha futura');
  });

  it('presente habilita las horas; ausente las deshabilita', () => {
    const presente = filaFichaje(prof, { estado: 'presente' }, { esHoy: false });
    const ausente = filaFichaje(prof, { estado: 'ausente' }, { esHoy: false });
    // En "ausente" los inputs de hora van disabled; en "presente" no.
    expect(ausente).toContain('apf-entrada');
    expect(ausente.match(/apf-entrada[^>]*disabled/)).toBeTruthy();
    expect(presente.match(/apf-entrada[^>]*disabled/)).toBeFalsy();
  });

  it('[regla no-futuro] HOY sin fichaje: prefill de entrada = hora actual, salida vacía', () => {
    const html = filaFichaje(prof, undefined, { esHoy: true, ahora: '09:15' });
    expect(html).toContain('class="apf-entrada" value="09:15"');
    expect(html).toContain('class="apf-salida" value=""');
  });

  it('[regla no-futuro] una entrada guardada en el futuro se reemplaza por la hora actual', () => {
    const html = filaFichaje(prof, { estado: 'presente', hora_entrada: '18:00' }, { esHoy: true, ahora: '09:15' });
    expect(html).toContain('class="apf-entrada" value="09:15"'); // no 18:00 (aún no ocurrió)
  });

  it('fecha pasada: usa el horario habitual del perfil', () => {
    const html = filaFichaje(prof, undefined, { esHoy: false });
    expect(html).toContain('class="apf-entrada" value="08:00"');
    expect(html).toContain('class="apf-salida" value="16:00"');
  });
});

describe('pacientesView.renderEvaluacionesHistoria (informes)', () => {
  const evalJSON = (obj) => JSON.stringify(obj);

  it('estado vacío cuando no hay informes', () => {
    expect(renderEvaluacionesHistoria([])).toContain('Todavía no hay informes');
  });

  it('muestra el título, el profesional y los botones Ver / PDF', () => {
    const ev = {
      id: 3, fecha: '2026-07-10',
      contenido: evalJSON({ tipo: 'mensual', titulo: 'INFORME MENSUAL', cuerpo: 'Buen avance.' }),
      profesionales: { nombre_completo: 'Lic. María', profesion: 'Psicología' },
    };
    const html = renderEvaluacionesHistoria([ev]);
    expect(html).toContain('INFORME MENSUAL');
    expect(html).toContain('Lic. María');
    expect(html).toContain('btn-eval-ver');
    expect(html).toContain('btn-eval-pdf');
  });

  it('descarta los informes totalmente vacíos', () => {
    const vacio = { id: 4, fecha: '2026-07-10', contenido: evalJSON({ tipo: 'mensual', titulo: 'X', cuerpo: '' }), profesionales: {} };
    expect(renderEvaluacionesHistoria([vacio])).toContain('Todavía no hay informes');
  });

  it('escapa el contenido del informe', () => {
    const ev = { id: 5, fecha: '2026-07-10', contenido: evalJSON({ tipo: 'mensual', titulo: 'T', cuerpo: '<script>x</script>' }), profesionales: {} };
    const html = renderEvaluacionesHistoria([ev]);
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('loginView.renderLogin (Etapa 2 · Fase A)', () => {
  it('tiene los campos de email y contraseña que espera el controlador', () => {
    const html = renderLogin();
    expect(html).toContain('id="login-email"');
    expect(html).toContain('id="login-password"');
    expect(html).toContain('type="password"'); // la contraseña no se muestra
  });

  it('tiene el formulario, el botón y el contenedor de error', () => {
    const html = renderLogin();
    expect(html).toContain('id="form-login"');
    expect(html).toContain('id="btn-login"');
    expect(html).toContain('id="login-error"'); // donde va el mensaje de error
  });

  it('muestra la marca de la clínica', () => {
    expect(renderLogin()).toContain('Lazos');
  });
});
