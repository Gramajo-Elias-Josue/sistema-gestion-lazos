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
import { renderTabla as tablaProfesionales, renderFormProfesional, renderListaSectores, renderModalSector } from '../src/views/profesionalesView.js';
import { renderAlertas, renderEntregas } from '../src/views/inicioView.js';
import { renderLista as listaTurnos, renderFormTurno, renderEstructura } from '../src/views/turnosView.js';
import { renderLista as listaAdmision, renderAdmision } from '../src/views/admisionView.js';
import { renderFilas as filasAsistencia, filaHtml as filaAsistencia } from '../src/views/asistenciaView.js';
import { filaHtml as filaFichaje, renderFilas as filasFichaje } from '../src/views/asistenciaProfView.js';
import { renderLogin, renderPedirRecuperacion, renderNuevaContrasena, renderLinkDelMail } from '../src/views/loginView.js';
import { renderCalendario, renderModalCalendario } from '../src/views/calendarioAsistenciaView.js';
import {
  renderEstructura as galeriaEstructura,
  renderPendientes as galeriaPendientes,
  renderFotos as galeriaFotos,
} from '../src/views/galeriaView.js';
import { armarCalendario } from '../src/utils/calendario.js';
import { tonoDe } from '../src/utils/ui.js';

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

  it('[clave] la lista arranca OCULTA, con el aviso de buscar o usar Filtros', () => {
    const html = tablaPacientes([base]);
    expect(html).toMatch(/id="pac-lista-wrap"[^>]*hidden/);
    expect(html).toContain('id="pac-inicial"');
    expect(html).toContain('id="pac-btn-filtros"');
    expect(html).toMatch(/id="pac-filtros"[^>]*hidden/);
  });

  it('cada fila lleva los datos que leen los filtros (estado, CUD, obra social)', () => {
    const html = tablaPacientes([{ ...base, tiene_cud: true, obra_social: 'OSDE' }]);
    expect(html).toContain('data-estado="activo"');
    expect(html).toContain('data-cud="si"');
    expect(html).toContain('data-os="OSDE"');
  });

  it('conserva la búsqueda y los filtros elegidos (al volver de un legajo)', () => {
    const html = tablaPacientes([base], { termino: 'ana', filtros: { estado: 'inactivo', cud: 'todos', obraSocial: 'todas', verTodos: false } });
    expect(html).toMatch(/id="pac-buscar"[^>]*value="ana"/);
    expect(html).toMatch(/<option value="inactivo" selected>/);
  });

  it('cada paciente lleva un color fijo (el mismo en cada recarga), nunca el gris', () => {
    const html = tablaPacientes([base]);
    const tono = tonoDe(base.id);
    expect(html).toContain(`class="tono-${tono}"`);
    expect(tonoDe(base.id)).toBe(tono);
    for (const id of ['a', 'b', 'c', 'uuid-1', 'uuid-2', 42]) {
      expect([0, 1, 2, 3, 4, 6, 7]).toContain(tonoDe(id));
    }
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

  it('lleva las marcas para volverse tarjetas en celular (sin scroll horizontal)', () => {
    const html = tablaPacientes([base]);
    expect(html).toContain('tabla-cards');          // el CSS engancha acá
    expect(html).toContain('data-t="Edad"');        // etiqueta de la fila apilada
    expect(html).toContain('data-t="Obra social"');
    expect(html).toContain('tc-acciones');          // los botones, a lo ancho
  });

  it('trae el buscador y el paginado (los maneja el controlador)', () => {
    const html = tablaPacientes([base]);
    expect(html).toContain('id="pac-buscar"');
    expect(html).toContain('id="pac-pager"');
    expect(html).toContain('id="pac-prev"');
    expect(html).toContain('id="pac-next"');
    expect(html).toMatch(/id="pac-pager"[^>]*hidden/); // arranca oculto
  });

  it('cada fila lleva su texto de búsqueda: nombre, DNI y obra social', () => {
    const html = tablaPacientes([{ ...base, nombre_completo: 'Ana Test', dni: '12345678', obra_social: 'OSDE' }]);
    expect(html).toContain('data-buscar="ana test 12345678 osde"');
  });
});

describe('pacientesView.renderFormPaciente', () => {
  it('[regresión] el formulario NO pide el campo "estado" (es interno)', () => {
    expect(renderFormPaciente({})).not.toContain('name="estado"');       // alta
    expect(renderFormPaciente({ id: 5, estado: 'inactivo' })).not.toContain('name="estado"'); // edición
  });

  it('primero pregunta si tiene CUD; el diagnóstico según CUD solo se ve si tiene', () => {
    const alta = renderFormPaciente({});
    expect(alta.indexOf('name="tiene_cud"')).toBeLessThan(alta.indexOf('name="diagnostico"'));
    expect(alta).toMatch(/id="pac-campo-diagnostico"\s+hidden/);
    expect(renderFormPaciente({ id: 5, tiene_cud: true, diagnostico: 'TEA' }))
      .not.toMatch(/id="pac-campo-diagnostico"\s+hidden/);
  });

  it('conserva los datos al editar', () => {
    const html = renderFormPaciente({ id: 5, nombre_completo: 'Juan Pérez', dni: '30111222' });
    expect(html).toContain('Juan Pérez');
    expect(html).toContain('30111222');
    expect(html).toContain('Guardar cambios');
  });

  it('la fecha de ingreso es obligatoria al ALTA, no al editar', () => {
    expect(renderFormPaciente({})).toMatch(/name="fecha_ingreso"[^>]*required/);       // alta
    expect(renderFormPaciente({ id: 5 })).not.toMatch(/name="fecha_ingreso"[^>]*required/); // edición
  });
});

describe('profesionalesView.renderTabla (baja lógica)', () => {
  const base = { id: 3, nombre_completo: 'Lic. María', estado: 'activo', asignaciones: [{ count: 2 }] };

  it('[regresión] ya no existe el botón "Eliminar" (borrado real)', () => {
    expect(tablaProfesionales([base])).not.toContain('Eliminar');
    expect(tablaProfesionales([{ ...base, estado: 'inactivo' }])).not.toContain('Eliminar');
  });

  it('activo muestra "Desactivar"; inactivo muestra "Activar"', () => {
    expect(tablaProfesionales([base])).toContain('Desactivar');
    expect(tablaProfesionales([{ ...base, estado: 'inactivo' }])).toContain('Activar');
  });

  it('el botón lleva los data-* que lee el controlador', () => {
    const html = tablaProfesionales([base]);
    expect(html).toContain('btn-baja-prof');
    expect(html).toContain('data-estado="activo"');
  });

  it('trae el buscador y las marcas para volverse tarjetas en celular', () => {
    const html = tablaProfesionales([base]);
    expect(html).toContain('id="prof-buscar"');
    expect(html).toContain('tabla-cards');
    expect(html).toContain('data-t="Especialidad"');
    expect(html).toContain('data-t="Matrícula"');
    expect(html).toContain('tc-acciones');
  });

  it('cada fila lleva su texto de búsqueda (nombre, email, especialidad)', () => {
    const html = tablaProfesionales([{ ...base, nombre_completo: 'Lic. María', email: 'maria@lazos.test', profesion: 'Psicología' }]);
    expect(html).toMatch(/data-buscar="[^"]*maría[^"]*maria@lazos\.test[^"]*psicología[^"]*"/);
  });
});

describe('profesionalesView.renderFormProfesional', () => {
  it('[regresión] el formulario NO pide el campo "estado"', () => {
    expect(renderFormProfesional({})).not.toContain('name="estado"');
    expect(renderFormProfesional({ id: 3, estado: 'inactivo' })).not.toContain('name="estado"');
  });

  it('el aviso de "se crea su usuario" solo aparece al CREAR y si lo puede usar (director)', () => {
    expect(renderFormProfesional({})).not.toContain('Le vamos a crear su usuario'); // sin permiso
    expect(renderFormProfesional({}, { permiteCrearUsuario: true })).toContain('Le vamos a crear su usuario');
    // Editando uno existente, ni con permiso: no tiene sentido ahí.
    expect(renderFormProfesional({ id: 3 }, { permiteCrearUsuario: true })).not.toContain('Le vamos a crear su usuario');
  });

  it('el desplegable de sector lista las profesiones cargadas y marca la elegida', () => {
    const sectores = [{ clave: 'psicologia', etiqueta: 'Psicología' }, { clave: 'fono', etiqueta: 'Fonoaudiología' }];
    const html = renderFormProfesional({ id: 3, sector: 'fono' }, { sectores });
    expect(html).toContain('name="sector"');
    expect(html).toMatch(/<option value="psicologia"\s*>Psicología<\/option>/);
    expect(html).toMatch(/<option value="fono" selected>Fonoaudiología<\/option>/);
  });

  it('[regresión] los datos obligatorios llevan required solo al CREAR, no al editar', () => {
    const alta = renderFormProfesional({});
    for (const campo of ['dni', 'fecha_nacimiento', 'profesion', 'sector', 'especialidad', 'telefono', 'email', 'direccion']) {
      expect(alta, `"${campo}" debería ser required al crear`).toMatch(new RegExp(`name="${campo}"[^>]*required`));
    }
    const edicion = renderFormProfesional({ id: 3 });
    for (const campo of ['dni', 'fecha_nacimiento', 'profesion', 'sector', 'especialidad', 'telefono', 'email', 'direccion']) {
      expect(edicion, `"${campo}" NO debería ser required al editar`).not.toMatch(new RegExp(`name="${campo}"[^>]*required`));
    }
  });

  it('pide el turno (mañana / tarde) con casillas, ya no horario de entrada y salida', () => {
    const alta = renderFormProfesional({});
    expect(alta).toContain('name="turnos_trabajo" value="manana"');
    expect(alta).toContain('name="turnos_trabajo" value="tarde"');
    expect(alta).not.toContain('name="horario_entrada"');
    expect(alta).not.toContain('name="horario_salida"');
  });

  it('al editar, vienen tildados los turnos que ya tenía', () => {
    const html = renderFormProfesional({ id: 3, turnos_trabajo: ['manana', 'tarde'] });
    expect(html).toMatch(/value="manana" checked/);
    expect(html).toMatch(/value="tarde" checked/);
  });

  it('matrícula y teléfono 2 nunca llevan required', () => {
    const alta = renderFormProfesional({});
    expect(alta).not.toMatch(/name="matricula"[^>]*required/);
    expect(alta).not.toMatch(/name="telefono2"[^>]*required/);
  });
});

describe('profesionalesView.renderListaSectores (pestaña "Profesiones")', () => {
  it('estado vacío cuando no hay ninguna cargada', () => {
    expect(renderListaSectores([])).toContain('No hay profesiones cargadas');
  });

  it('lista cada profesión con su botón de quitar', () => {
    const html = renderListaSectores([{ id: 's1', clave: 'psicologia', etiqueta: 'Psicología' }]);
    expect(html).toContain('Psicología');
    expect(html).toContain('btn-quitar-sector');
    expect(html).toContain('data-clave="psicologia"');
  });
});

describe('profesionalesView.renderModalSector', () => {
  it('tiene el campo y el formulario que espera el controlador', () => {
    const html = renderModalSector();
    expect(html).toContain('id="form-sector"');
    expect(html).toContain('name="etiqueta"');
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

describe('galeriaView (solo fotos)', () => {
  const equipo = [
    { id: 'x1', nombre_completo: 'Flores Ingrid', profesion: 'Psicología' },
    { id: 'x2', nombre_completo: 'Villafañe Mirka', profesion: 'Fonoaudiología' },
  ];

  it('[regresión] la Galería no habla de informes: son del paciente', () => {
    const pantalla = [
      galeriaEstructura('2026-08'),
      galeriaPendientes({ periodo: '2026-08', fotos: equipo }),
      galeriaFotos({ fotos: [], miNombre: 'Flores Ingrid', periodo: '2026-08' }),
    ].join(' ');
    expect(pantalla.toLowerCase()).not.toContain('informe');
  });

  it('avisa quién todavía no subió su foto, con singular y plural', () => {
    expect(galeriaPendientes({ periodo: '2026-08', fotos: [equipo[0]] }))
      .toContain('1 profesional todavía no subió su foto');
    expect(galeriaPendientes({ periodo: '2026-08', fotos: equipo }))
      .toContain('2 profesionales todavía no subieron su foto');
  });

  it('cuando están todas subidas, lo dice', () => {
    expect(galeriaPendientes({ periodo: '2026-08', fotos: [] })).toContain('Todo el equipo subió su foto');
  });

  it('[regresión] el formulario ya no dice que la foto se borra sola', () => {
    const html = galeriaFotos({ fotos: [], miNombre: 'Flores Ingrid', periodo: '2026-08' });
    expect(html).not.toContain('se borra a los 3 meses');
  });

  it('el formulario sube a nombre del profesional logueado, sin elegir a quién', () => {
    const html = galeriaFotos({ fotos: [], miNombre: 'Flores Ingrid', periodo: '2026-08' });
    expect(html).toContain('Flores Ingrid'); // aviso de a nombre de quién se sube
    expect(html).not.toContain('name="profesional_id"'); // ya no se elige de un desplegable
  });

  it('quien no es profesional (CM, director, secretaría) ve las fotos pero no el formulario de carga', () => {
    const html = galeriaFotos({
      fotos: [{ id: 'f1', storage_path: 'x', url: '', profesionales: { nombre_completo: 'Flores Ingrid' } }],
      periodo: '2026-08', puedeSubir: false,
    });
    expect(html).toContain('gal-foto');
    expect(html).not.toContain('gal-form-foto');
    expect(html).not.toContain('gal-borrar');
  });

  it('el profesional ve la × para borrar solo en sus propias fotos', () => {
    const html = galeriaFotos({
      fotos: [
        { id: 'mia', profesional_id: 'p1', storage_path: 'a', url: '', profesionales: { nombre_completo: 'Flores Ingrid' } },
        { id: 'otra', profesional_id: 'p2', storage_path: 'b', url: '', profesionales: { nombre_completo: 'Villafañe Mirka' } },
      ],
      periodo: '2026-08', puedeSubir: true, miProfesionalId: 'p1',
    });
    expect(html.match(/gal-borrar/g)).toHaveLength(1);
    const otra = html.slice(html.indexOf('data-foto="otra"'));
    expect(otra).not.toContain('gal-borrar');
  });
});

describe('inicioView.renderEntregas (lo que debe cada profesional)', () => {
  const periodo = '2026-08';
  const uno = [{ id: 'x1', nombre_completo: 'Flores Ingrid' }];
  const dos = [...uno, { id: 'x2', nombre_completo: 'Villafañe Mirka' }];

  it('dice quién debe el informe y quién la foto, con el mes', () => {
    const html = renderEntregas({ periodo, informes: dos, fotos: uno });
    expect(html).toContain('Agosto 2026');
    expect(html).toContain('Flores Ingrid');
    expect(html).toContain('Villafañe Mirka');
  });

  it('[regresión] singular y plural bien escritos', () => {
    const html = renderEntregas({ periodo, informes: uno, fotos: uno });
    expect(html).toContain('1 profesional debe el informe del mes');
    expect(html).toContain('1 profesional no subió su foto del mes');
    expect(html).not.toContain('1 profesional no subieron');

    const plural = renderEntregas({ periodo, informes: dos, fotos: dos });
    expect(plural).toContain('2 profesionales deben el informe del mes');
    expect(plural).toContain('2 profesionales no subieron su foto del mes');
  });

  it('cuando está todo entregado, lo dice y no muestra listas', () => {
    const html = renderEntregas({ periodo, informes: [], fotos: [], alDia: true });
    expect(html).toContain('Todo el equipo entregó');
    expect(html).not.toContain('alert');
  });
});

describe('calendarioAsistenciaView.renderCalendario', () => {
  const calendario = armarCalendario({
    anio: 2026, mes: 7, hoy: '2026-07-20',
    registros: [
      { fecha: '2026-07-01', estado: 'presente' },
      { fecha: '2026-07-02', estado: 'ausente' },
      { fecha: '2026-07-03', estado: 'ausente_con_aviso', observaciones: 'Control médico' },
    ],
  });

  it('pinta verde lo asistido, rojo lo faltado y gris el fin de semana', () => {
    const html = renderCalendario(calendario);
    expect(html).toContain('cal-ok');    // presente
    expect(html).toContain('cal-bad');   // ausente
    expect(html).toContain('cerrado');   // sábado / domingo: la clínica no abre
  });

  it('el motivo del aviso se lee al pasar el mouse por el día', () => {
    expect(renderCalendario(calendario)).toContain('Control médico');
  });

  it('muestra el resumen del mes y la referencia de colores', () => {
    const html = renderCalendario(calendario);
    expect(html).toContain('Presentes');
    expect(html).toContain('Asistió');
    expect(html).toContain('Fin de semana (la clínica no abre)');
  });

  it('el modal trae el nombre de la persona y el botón de PDF', () => {
    const html = renderModalCalendario({
      persona: { nombre_completo: 'Ana Test' }, subtitulo: 'Psicología', anio: 2026, mes: 7,
    });
    expect(html).toContain('Ana Test');
    expect(html).toContain('Julio 2026');
    expect(html).toContain('cal-pdf');
  });
});

describe('turnosView.renderLista', () => {
  // Turno casual: los datos de la persona vienen anotados en el turno.
  const turno = {
    id: 9, estado: 'programado', hora: '10:30:00',
    paciente_nombre: 'Ana Test', paciente_dni: '12345678', paciente_telefono: '3865111222',
    profesionales: { nombre_completo: 'Lic. María', profesion: 'Psicología' },
  };

  it('muestra los datos de contacto del casual', () => {
    const html = listaTurnos([turno]);
    expect(html).toContain('DNI 12345678');
    expect(html).toContain('Tel. 3865111222');
  });

  it('los turnos viejos (de un paciente cargado) se siguen leyendo', () => {
    const viejo = { ...turno, paciente_nombre: null, paciente_dni: null, pacientes: { nombre_completo: 'Paciente Viejo', dni: '1' } };
    expect(listaTurnos([viejo])).toContain('Paciente Viejo');
  });

  it('en celular es tarjeta (tabla-cards)', () => {
    expect(listaTurnos([turno])).toContain('tabla-cards');
  });

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
    const html = listaTurnos([{ ...turno, paciente_nombre: '<x>' }]);
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

  it('[clave] evaluación / certificado: habilitado en turnos casuales ATENDIDOS (asistencia confirmada)', () => {
    // Programado: el botón se ve apagado (para que se sepa que existe) y explica qué falta.
    expect(listaTurnos([turno])).toContain('cert-pendiente');
    expect(listaTurnos([turno])).toContain('Se habilita cuando el turno está Atendido');
    expect(listaTurnos([{ ...turno, estado: 'atendido' }])).not.toContain('cert-pendiente');
    // Ausente o cancelado: no corresponde.
    expect(listaTurnos([{ ...turno, estado: 'ausente' }])).not.toContain('btn-cert-turno');
    expect(listaTurnos([{ ...turno, estado: 'cancelado' }])).not.toContain('btn-cert-turno');
    expect(listaTurnos([{ ...turno, estado: 'atendido' }])).toContain('+ Evaluación / certificado');
    expect(listaTurnos([{ ...turno, estado: 'atendido' }], false)).toContain('btn-cert-turno'); // el profesional también
    expect(listaTurnos([{ ...turno, estado: 'atendido' }], true, { 9: { id: 'c1' } })).toContain('Ver certificado');
    // Turno viejo de un paciente con legajo: el certificado se hace desde su historia clínica.
    expect(listaTurnos([{ ...turno, estado: 'atendido', paciente_id: 'p1' }])).not.toContain('btn-cert-turno');
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

describe('turnosView.renderFormTurno (paciente casual)', () => {
  const prof = { id: 2, nombre_completo: 'Lic. María', profesion: 'Psicología', turnos_trabajo: ['manana'], dias_trabajo: ['Lunes'] };

  it('avisa si no hay profesionales cargados', () => {
    expect(renderFormTurno([], '2026-07-16')).toContain('Necesitás al menos un profesional');
    expect(renderFormTurno([prof], '2026-07-16')).not.toContain('Necesitás al menos un profesional');
  });

  it('[clave] el paciente se ESCRIBE (no tiene legajo): nombre, teléfono y DNI; no hay lista de pacientes', () => {
    const html = renderFormTurno([prof], '2026-07-16');
    expect(html).toMatch(/name="paciente_nombre"[^>]*required/);
    expect(html).toContain('name="paciente_telefono"');
    expect(html).toContain('name="paciente_dni"');
    expect(html).not.toContain('name="paciente_id"');
  });

  it('la hora es obligatoria (para controlar que no pise la grilla)', () => {
    expect(renderFormTurno([prof], '2026-07-16')).toMatch(/name="hora"[^>]*required/);
  });

  it('el calendario no deja elegir fechas pasadas; mirando un día viejo, arranca en hoy', () => {
    const html = renderFormTurno([prof], '2026-07-10', '2026-07-16');
    expect(html).toMatch(/name="fecha"[^>]*min="2026-07-16"[^>]*value="2026-07-16"/);
    expect(renderFormTurno([prof], '2026-07-20', '2026-07-16')).toMatch(/name="fecha"[^>]*value="2026-07-20"/);
  });

  it('las opciones de profesional llevan los días de trabajo que lee el controlador', () => {
    expect(renderFormTurno([prof], '2026-07-16')).toContain('data-dias='); // días de trabajo serializados
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
  seleccion: {}, notas: {}, calendarios: {}, guardado: {}, editando: {},
  bloqueado: false, fecha: '2026-07-20', ...over,
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

  it('la fila trae la tira de la semana con sus colores, flechas y el porcentaje', () => {
    const calendario = armarCalendario({
      anio: 2026, mes: 7, hoy: '2026-07-20',
      registros: [
        { fecha: '2026-07-01', estado: 'presente' },
        { fecha: '2026-07-02', estado: 'presente' },
        { fecha: '2026-07-03', estado: 'ausente' },
      ],
    });
    // Semana 0 (por defecto) incluye el 1, 2 y 3 de julio.
    const html = filaAsistencia(pac, vistaAsis({ calendarios: { 1: calendario } }));
    expect(html).toContain('mini-cal');
    expect(html).toContain('cal-ok');
    expect(html).toContain('cal-bad');
    expect(html).toContain('67%');       // 2 presentes sobre 3 registros del mes
    expect(html).toContain('data-ficha="1"'); // la tira abre la ficha grande
    expect(html).toContain('sem-nav');   // flechas para moverse de semana
  });

  it('sin datos del mes la fila no se rompe', () => {
    expect(filaAsistencia(pac, vistaAsis())).toContain('vacia');
  });

  it('el botón de corregir tiene título accesible aunque sea solo ícono', () => {
    const html = filaAsistencia(pac, vistaAsis({ seleccion: { 1: 'presente' }, guardado: { 1: true } }));
    expect(html).toContain('title="Corregir la asistencia ya guardada"');
  });
});

describe('asistenciaProfView.filaHtml (fichaje)', () => {
  const prof = { id: 5, nombre_completo: 'Lic. María', profesion: 'Psicología', turnos_trabajo: ['manana'] };

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

  it('fecha pasada: usa el horario de su turno (mañana: 8 a 12)', () => {
    const html = filaFichaje(prof, undefined, { esHoy: false });
    expect(html).toContain('class="apf-entrada" value="08:00"');
    expect(html).toContain('class="apf-salida" value="12:00"');
  });

  it('con los dos turnos, el horario va de la entrada de la mañana a la salida de la tarde', () => {
    const html = filaFichaje({ ...prof, turnos_trabajo: ['manana', 'tarde'] }, undefined, { esHoy: false });
    expect(html).toContain('class="apf-entrada" value="08:00"');
    expect(html).toContain('class="apf-salida" value="18:00"');
    expect(html).toContain('Mañana y tarde');
  });
});

describe('pacientesView.renderEvaluacionesHistoria (informes)', () => {
  const evalJSON = (obj) => JSON.stringify(obj);

  it('estado vacío cuando no hay informes', () => {
    expect(renderEvaluacionesHistoria([])).toContain('Todavía no hay informes');
  });

  it('además del informe de hoy, ofrece la evaluación / certificado ocasional', () => {
    const html = renderEvaluacionesHistoria([]);
    expect(html).toContain('btn-nueva-eval');
    expect(html).toContain('btn-nuevo-certificado');
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

  it('tiene el link para recuperar la contraseña', () => {
    expect(renderLogin()).toContain('id="link-olvide"');
  });
});

describe('loginView.renderPedirRecuperacion (recuperar contraseña, paso 1)', () => {
  it('sin enviar: pide el email', () => {
    const html = renderPedirRecuperacion();
    expect(html).toContain('id="form-rec"');
    expect(html).toContain('id="rec-email"');
    expect(html).toContain('id="btn-rec"');
  });

  it('enviado: muestra el aviso con el email, sin volver a pedirlo', () => {
    const html = renderPedirRecuperacion({ enviado: true, email: 'ana@lazos.test' });
    expect(html).toContain('ana@lazos.test');
    expect(html).not.toContain('id="form-rec"');
    expect(html).toContain('id="btn-volver-login"');
  });

  it('escapa el email del aviso (XSS)', () => {
    const html = renderPedirRecuperacion({ enviado: true, email: '<script>x</script>' });
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('loginView.renderLinkDelMail (botón de un mail)', () => {
  it('bienvenida y recuperar: un botón para usar el link (el código no se gasta solo)', () => {
    const bienvenida = renderLinkDelMail({ tipo: 'invite' });
    expect(bienvenida).toContain('Bienvenido/a');
    expect(bienvenida).toContain('id="btn-usar-link"');
    expect(bienvenida).toContain('Crear mi contraseña');
    expect(renderLinkDelMail({ tipo: 'recovery' })).toContain('Elegir contraseña nueva');
  });

  it('link vencido o usado: lo explica y ofrece pedir uno nuevo', () => {
    const html = renderLinkDelMail({ error: 'otp_expired' });
    expect(html).toContain('Este link ya no sirve');
    expect(html).toContain('id="btn-link-nuevo"');
    expect(html).not.toContain('id="btn-usar-link"');
  });
});

describe('loginView.renderNuevaContrasena (recuperar contraseña, paso 2)', () => {
  it('pide la contraseña nueva dos veces', () => {
    const html = renderNuevaContrasena();
    expect(html).toContain('id="form-nueva-pass"');
    expect(html).toContain('id="nueva-pass"');
    expect(html).toContain('id="nueva-pass2"');
    expect(html).toContain('type="password"');
  });

  it('por defecto es la de recuperar; con bienvenida, el mismo form con textos de primer ingreso', () => {
    expect(renderNuevaContrasena()).toContain('Elegí una contraseña nueva');
    const html = renderNuevaContrasena({ bienvenida: true });
    expect(html).toContain('Bienvenido/a');
    expect(html).not.toContain('contraseña nueva');
    expect(html).toContain('id="form-nueva-pass"');
  });
});
