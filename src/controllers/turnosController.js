// =====================================================================
// CONTROLADOR: Agenda de turnos
// ---------------------------------------------------------------------
// CAPA CONTROLADOR. Navegación por fecha, listado de turnos del día y
// alta/edición de estado/baja de turnos. Reutiliza el patrón de barra de
// fecha de la asistencia.
//
// La agenda es SOLO para pacientes CASUALES (sin legajo). Los fijos están
// en la Grilla de atención, y un turno casual nunca puede caer encima de
// uno de ellos.
// =====================================================================

import * as turnoModel from '../models/turnoModel.js';
import * as profesionalModel from '../models/profesionalModel.js';
import * as asistenciaProfModel from '../models/asistenciaProfesionalModel.js';
import * as asignacionModel from '../models/asignacionModel.js';
import * as evaluacionModel from '../models/evaluacionModel.js';
import { abrirEditorInforme } from './editorInforme.js';
import { parseEvaluacion, TIPO_CERTIFICADO } from '../utils/evaluacion.js';
import { renderEstructura, renderLista, renderFormTurno, nombreDelTurno } from '../views/turnosView.js';
import { hoyISO, sumarDias, nombreDia, horaAMinutos, ahoraHHMM } from '../utils/fechas.js';
import { turnosDe, atiendeALaHora, rangoTurno } from '../utils/turnosCentro.js';
import { htmlCargando, htmlError, toast, confirmar } from '../utils/ui.js';
import { validarTurno, normalizarDni, conflictoDniCasual } from '../utils/validacion.js';
import * as pacienteModel from '../models/pacienteModel.js';
import { mensajeError } from '../utils/errores.js';
import { perfilActual } from '../sesion.js';
import { puedeOperar } from '../permisos.js';

let fechaActual = hoyISO();
let turnosCargados = [];  // turnos de la fecha visible (para buscar por id)
let certificados = {};    // { turnoId: certificado } de los casuales de esa fecha

// Punto de entrada de la sección Agenda (lo llama el router).
export async function iniciarTurnos() {
  fechaActual = hoyISO();
  // La agenda la gestionan director y secretaría. El profesional la ve en
  // modo consulta: no crea turnos ni cambia su estado (lo hace cumplir la
  // RLS de la base; acá sólo se evita mostrarle controles que fallarían).
  const gestiona = puedeOperar(perfilActual());
  const cont = document.getElementById('v-agenda');
  cont.innerHTML = renderEstructura(fechaActual, gestiona);

  document.getElementById('t-prev').addEventListener('click', () => irAFecha(sumarDias(fechaActual, -1)));
  document.getElementById('t-next').addEventListener('click', () => irAFecha(sumarDias(fechaActual, 1)));
  document.getElementById('t-hoy').addEventListener('click', () => irAFecha(hoyISO()));
  document.getElementById('t-fecha').addEventListener('change', (e) => { if (e.target.value) irAFecha(e.target.value); });
  const btnNuevo = document.getElementById('btn-nuevo-turno');
  if (btnNuevo) btnNuevo.addEventListener('click', nuevoTurno);

  await cargarFecha(fechaActual);
}

// Cambia la fecha visible y recarga.
function irAFecha(fecha) {
  fechaActual = fecha;
  document.getElementById('t-fecha').value = fecha;
  document.getElementById('t-dia').textContent = nombreDia(fecha);
  cargarFecha(fecha);
}

// Lista los turnos de la fecha actual.
async function cargarFecha(fecha) {
  const caja = document.getElementById('turnos-lista');
  caja.innerHTML = htmlCargando('Cargando turnos…');
  try {
    const turnos = await turnoModel.listarTurnosPorFecha(fecha);
    const certs = await evaluacionModel.listarCertificadosDeTurnos(turnos.map(t => t.id));
    // Guard anti-carrera: si el usuario ya navegó a otra fecha mientras se
    // pedían estos datos, descartamos esta respuesta (llegó tarde y pintaría
    // una fecha que ya no es la visible).
    if (fecha !== fechaActual) return;
    turnosCargados = turnos;
    certificados = {};
    certs.forEach(c => { certificados[c.turno_id] = c; });
    caja.innerHTML = renderLista(turnos, puedeOperar(perfilActual()), certificados);
    caja.querySelectorAll('.turno-estado').forEach(sel =>
      sel.addEventListener('change', () => cambiarEstado(sel.dataset.id, sel.value)));
    caja.querySelectorAll('.btn-eliminar-turno').forEach(b =>
      b.addEventListener('click', () => eliminar(b.dataset.id)));
    caja.querySelectorAll('.btn-cert-turno').forEach(b =>
      b.addEventListener('click', () => abrirCertificadoCasual(b.dataset.id)));
  } catch (err) {
    console.error('Error listando turnos:', err);
    caja.innerHTML = htmlError('No se pudo cargar la agenda. Revisá la conexión.');
  }
}

// ---------------------------------------------------------------------
// NUEVO TURNO
// ---------------------------------------------------------------------
async function nuevoTurno() {
  let profesionales = [];
  try {
    profesionales = await profesionalModel.listarProfesionales({ soloActivos: true });
  } catch (err) {
    console.error('Error cargando profesionales para turno:', err);
    toast('No se pudo cargar la información. Revisá la conexión.', 'bad');
    return;
  }

  document.body.insertAdjacentHTML('beforeend', renderFormTurno(profesionales, fechaActual));
  const overlay = document.getElementById('overlay-turno');
  const form = document.getElementById('form-turno');
  const cerrar = () => overlay.remove();
  overlay.querySelectorAll('[data-cerrar]').forEach(b => b.addEventListener('click', cerrar));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-guardar-turno');
    const fd = new FormData(form);
    const datos = {
      paciente_nombre: (fd.get('paciente_nombre') || '').trim(),
      paciente_telefono: (fd.get('paciente_telefono') || '').trim() || null,
      paciente_dni: (fd.get('paciente_dni') || '').trim() || null,
      profesional_id: fd.get('profesional_id'),
      fecha: fd.get('fecha'),
      hora: fd.get('hora') || null,
      observaciones: fd.get('observaciones') || null,
    };

    // No se dan turnos en el pasado: la hora se compara con la de AHORA
    // (a las 16:50 no se puede sacar un turno de hoy a las 14:30).
    const v = validarTurno(datos, { hoy: hoyISO(), ahora: ahoraHHMM() });
    if (!v.ok) { toast(v.mensaje, 'bad'); return; }
    if (datos.paciente_dni) datos.paciente_dni = normalizarDni(datos.paciente_dni);

    btn.disabled = true;
    btn.textContent = 'Verificando…';
    const reactivar = () => {
      btn.disabled = false;
      btn.textContent = 'Crear turno';
    };

    // 0) EL DNI NO PUEDE REPETIRSE (ver conflictoDniCasual): ni ser de un
    //    paciente del centro, ni de otro casual con otro nombre, ni sacar
    //    dos turnos el mismo día. Si no se puede verificar, no se crea.
    if (datos.paciente_dni) {
      let conflicto;
      try {
        const [paciente, turnosDni] = await Promise.all([
          pacienteModel.buscarPorDni(datos.paciente_dni),
          turnoModel.listarCasualesPorDni(datos.paciente_dni),
        ]);
        conflicto = conflictoDniCasual({ nombre: datos.paciente_nombre, fecha: datos.fecha, paciente, turnosDni });
      } catch (err) {
        console.error('Error verificando el DNI:', err);
        toast('No se pudo verificar el DNI. Revisá la conexión.', 'bad');
        reactivar();
        return;
      }
      if (conflicto) { toast(conflicto, 'bad'); reactivar(); return; }
    }

    // 1) EL HORARIO TIENE QUE ESTAR LIBRE (ventana de 30 min de sesión):
    //    A) Sin pisar a un paciente FIJO del profesional en la grilla, los
    //       días que trabaja (la grilla se repite todos esos días). Bloquea.
    //    B) Sin pisar otro turno casual del mismo profesional ese día.
    //    Dos horarios se pisan si |horaA - horaB| < DURACION_SESION.
    const DURACION_SESION = 30; // minutos
    const prof = profesionales.find(p => String(p.id) === String(datos.profesional_id));
    let fijos, turnosProfDia;
    try {
      [fijos, turnosProfDia] = await Promise.all([
        asignacionModel.listarVigentesDeProfesional(datos.profesional_id),
        turnoModel.listarTurnosProfesionalPorFecha(datos.profesional_id, datos.fecha),
      ]);
    } catch (err) {
      // Si no se pudo verificar (p. ej. corte de red), NO se crea el turno
      // a ciegas: se aborta y se avisa, para no dejar pasar superposiciones.
      console.error('Error al verificar si el horario está libre:', err);
      toast('No se pudo verificar si el horario está libre. Revisá la conexión.', 'bad');
      reactivar();
      return;
    }

    const minNuevo = horaAMinutos(datos.hora);
    const pisa = (otro) => {
      const m = horaAMinutos(otro.hora);
      return m !== null && Math.abs(minNuevo - m) < DURACION_SESION;
    };

    const dias = prof?.dias_trabajo || [];
    const trabajaEseDia = !dias.length || dias.includes(nombreDia(datos.fecha));
    const fijo = trabajaEseDia ? fijos.find(pisa) : null;
    if (fijo) {
      toast(
        `A las ${String(fijo.hora).slice(0, 5)} ${prof?.nombre_completo || 'el profesional'} atiende a ` +
        `${fijo.pacientes?.nombre_completo || 'un paciente fijo'} (Grilla de atención). Elegí otro horario.`,
        'bad'
      );
      reactivar();
      return;
    }

    const turnoProf = turnosProfDia.find(pisa);
    if (turnoProf) {
      toast(
        `Ese profesional ya tiene un turno a las ${(turnoProf.hora || '').slice(0, 5)} con ${nombreDelTurno(turnoProf)}. ` +
        `Dejá al menos ${DURACION_SESION} minutos entre turnos.`,
        'bad'
      );
      reactivar();
      return;
    }

    // 2) VALIDACIÓN DE HORARIO Y DÍAS LABORALES DEL PROFESIONAL:
    const selProf = form.querySelector('[name="profesional_id"]');
    const opt = selProf.options[selProf.selectedIndex];
    const diasRaw = opt?.dataset.dias || '[]';
    let diasTrabajo = [];
    try {
      diasTrabajo = JSON.parse(diasRaw);
    } catch (e) {
      console.error('Error parseando días de trabajo:', e);
    }

    // A) Aviso si la fecha cae en un día no laborable del profesional
    if (diasTrabajo && diasTrabajo.length > 0) {
      const diaSemana = nombreDia(datos.fecha);
      if (!diasTrabajo.includes(diaSemana)) {
        const prof = profesionales.find(p => String(p.id) === String(datos.profesional_id));
        const nombreProf = prof?.nombre_completo || 'el profesional';
        const seguir = await confirmar({
          titulo: 'Día no laboral',
          mensaje: `${nombreProf} no atiende los ${diaSemana.toLowerCase()}. ¿Lo agendás igual?`,
          textoOk: 'Agendar igual',
          textoCancelar: 'Volver',
        });
        if (!seguir) {
          btn.disabled = false;
          btn.textContent = 'Crear turno';
          return;
        }
      }
    }

    // B) Aviso (no bloqueo) si la hora cae fuera de sus turnos (mañana /
    //    tarde): con los dos turnos, el mediodía también queda afuera.
    const profTurno = profesionales.find(p => String(p.id) === String(datos.profesional_id));
    if (datos.hora && turnosDe(profTurno).length && !atiendeALaHora(profTurno, datos.hora)) {
      const nombreProf = profTurno?.nombre_completo || 'el profesional';
      const seguir = await confirmar({
        titulo: 'Turno fuera de horario',
        mensaje: `${nombreProf} atiende ${turnosDe(profTurno).map(t => `${t.corto.toLowerCase()} de ${rangoTurno(t)}`).join(' y ')}. El turno de las ${datos.hora} queda fuera de ese horario. ¿Lo agendás igual?`,
        textoOk: 'Agendar igual',
        textoCancelar: 'Volver',
      });
      if (!seguir) {
        btn.disabled = false;
        btn.textContent = 'Crear turno';
        return;
      }
    }

    btn.textContent = 'Guardando…';
    try {
      await turnoModel.crearTurno({
        pacienteNombre: datos.paciente_nombre,
        pacienteTelefono: datos.paciente_telefono,
        pacienteDni: datos.paciente_dni,
        profesionalId: datos.profesional_id,
        fecha: datos.fecha,
        hora: datos.hora,
        observaciones: datos.observaciones,
      });
      toast('Turno creado.');
      cerrar();
      // Si el turno cae en otra fecha, navegamos a ella; si no, refrescamos.
      if (datos.fecha === fechaActual) await cargarFecha(fechaActual);
      else irAFecha(datos.fecha);
    } catch (err) {
      console.error('Error creando turno:', err);
      btn.disabled = false;
      btn.textContent = 'Crear turno';
      toast(mensajeError(err, 'No se pudo crear el turno. Probá de nuevo.'), 'bad');
    }
  });
}

// ---------------------------------------------------------------------
// CAMBIAR ESTADO / ELIMINAR
// ---------------------------------------------------------------------
async function cambiarEstado(id, estado) {
  // No se puede marcar "atendido" si el profesional no está presente en su
  // fichaje de esa fecha. (El paciente casual no tiene legajo ni planilla
  // de asistencia: que vino lo dice el mismo "Atendido".) Se verifica antes
  // de guardar y, si no corresponde, se revierte el <select>.
  if (estado === 'atendido') {
    const turno = turnosCargados.find(t => String(t.id) === String(id));
    const revertir = () => {
      const sel = document.querySelector(`.turno-estado[data-id="${id}"]`);
      if (sel && turno) sel.value = turno.estado;
    };
    if (turno) {
      try {
        const fichajesProf = await asistenciaProfModel.listarPorFecha(turno.fecha);
        const profPresente = fichajesProf.some(f =>
          String(f.profesional_id) === String(turno.profesional_id) && f.estado === 'presente');

        if (!profPresente) {
          const cuando = turno.fecha === hoyISO() ? 'de hoy' : 'de ese día';
          toast(`Para marcar Atendido, el profesional tiene que figurar presente. Completá su fichaje ${cuando} en Asistencia.`, 'bad');
          revertir();
          return;
        }
      } catch (err) {
        console.error('Error verificando la presencia para "atendido":', err);
        toast('No se pudo verificar la asistencia. Probá de nuevo.', 'bad');
        revertir();
        return;
      }
    }
  }

  try {
    await turnoModel.actualizarEstadoTurno(id, estado);
    toast('Turno actualizado.');
    await cargarFecha(fechaActual);
  } catch (err) {
    console.error('Error actualizando turno:', err);
    toast('No se pudo actualizar el turno. Probá de nuevo.', 'bad');
  }
}

async function eliminar(id) {
  const turno = turnosCargados.find(t => String(t.id) === String(id));
  const paciente = turno ? nombreDelTurno(turno) : null;
  const hora = (turno?.hora || '').slice(0, 5);
  const tieneCert = !!certificados[id];
  const seguir = await confirmar({
    titulo: 'Eliminar turno',
    mensaje: (paciente
      ? `Se borra el turno de ${paciente}${hora ? ` de las ${hora}` : ''}.`
      : 'Se borra este turno.')
      + (tieneCert ? ' También se borra su evaluación / certificado.' : '')
      + ' Esta acción no se puede deshacer.',
    textoOk: 'Eliminar',
    textoCancelar: 'Volver',
    peligro: true,
  });
  if (!seguir) return;
  try {
    // El certificado de un casual no tiene paciente: sin el turno quedaría
    // huérfano (y la base no lo admite), así que se borra primero.
    if (tieneCert) await evaluacionModel.eliminarCertificadoDeTurno(id);
    await turnoModel.eliminarTurno(id);
    toast('Turno eliminado.');
    await cargarFecha(fechaActual);
  } catch (err) {
    console.error('Error eliminando turno:', err);
    toast('No se pudo eliminar el turno. Probá de nuevo.', 'bad');
  }
}

// ---------------------------------------------------------------------
// EVALUACIÓN / CERTIFICADO DE UN CASUAL
// ---------------------------------------------------------------------
// Ocasional: se hace cuando la persona lo pide. Requisito: el turno
// marcado "Atendido" (que vino está confirmado). Lo firma el profesional
// del turno. Queda guardado atado al turno (no hay legajo donde
// adjuntarlo) y se descarga el PDF para imprimir. Si ya existía, se abre
// con lo cargado: volver a guardar lo actualiza y reimprime.
function abrirCertificadoCasual(turnoId) {
  const turno = turnosCargados.find(t => String(t.id) === String(turnoId));
  if (!turno) return;
  if (turno.estado !== 'atendido') {
    toast('Primero marcá el turno como Atendido: así queda confirmado que la persona vino.', 'bad');
    return;
  }

  const existente = certificados[turno.id];
  const paciente = { nombre_completo: nombreDelTurno(turno), dni: turno.paciente_dni };
  const profesional = turno.profesionales || {};

  abrirEditorInforme({
    paciente,
    autores: [{ id: turno.id, profesional_id: turno.profesional_id, profesionales: profesional, hora: turno.hora }],
    datosPorProf: existente ? { [String(turno.profesional_id)]: parseEvaluacion(existente.contenido) } : {},
    vista: {
      tipos: [TIPO_CERTIFICADO],
      titulo: 'Evaluación / certificado',
      etiquetaProf: 'Profesional que lo atendió',
      nota: 'Paciente casual (sin legajo): queda guardado en su turno y se descarga el PDF para imprimir.',
    },
    alGuardar: async ({ datos, contenido }) => {
      const hoy = hoyISO();
      await evaluacionModel.guardarCertificadoCasual({
        turnoId: turno.id, profesionalId: turno.profesional_id, fecha: hoy, contenido,
      });
      try {
        const { generarInformeEvaluacion } = await import('../utils/informePdf.js');
        await generarInformeEvaluacion({ paciente, profesional, fecha: hoy, informe: datos });
        toast('Guardado. Se descargó el PDF.');
      } catch (errPdf) {
        console.error('Certificado guardado, pero falló el PDF:', errPdf);
        toast('Se guardó, pero no se pudo generar el PDF.', 'bad');
      }
      await cargarFecha(fechaActual);
    },
  });
}
