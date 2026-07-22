// =====================================================================
// CONTROLADOR: Agenda de turnos
// ---------------------------------------------------------------------
// CAPA CONTROLADOR. Navegación por fecha, listado de turnos del día y
// alta/edición de estado/baja de turnos. Reutiliza el patrón de barra de
// fecha de la asistencia.
// =====================================================================

import * as turnoModel from '../models/turnoModel.js';
import * as pacienteModel from '../models/pacienteModel.js';
import * as profesionalModel from '../models/profesionalModel.js';
import * as asistenciaProfModel from '../models/asistenciaProfesionalModel.js';
import * as asistenciaModel from '../models/asistenciaModel.js';
import { renderEstructura, renderLista, renderFormTurno } from '../views/turnosView.js';
import { hoyISO, sumarDias, nombreDia, horaEnRango, horaAMinutos } from '../utils/fechas.js';
import { htmlCargando, htmlError, toast, confirmar } from '../utils/ui.js';
import { validarTurno } from '../utils/validacion.js';
import { mensajeError } from '../utils/errores.js';

let fechaActual = hoyISO();
let turnosCargados = [];  // turnos de la fecha visible (para buscar por id)

// Punto de entrada de la sección Agenda (lo llama el router).
export async function iniciarTurnos() {
  fechaActual = hoyISO();
  const cont = document.getElementById('v-agenda');
  cont.innerHTML = renderEstructura(fechaActual);

  document.getElementById('t-prev').addEventListener('click', () => irAFecha(sumarDias(fechaActual, -1)));
  document.getElementById('t-next').addEventListener('click', () => irAFecha(sumarDias(fechaActual, 1)));
  document.getElementById('t-hoy').addEventListener('click', () => irAFecha(hoyISO()));
  document.getElementById('t-fecha').addEventListener('change', (e) => { if (e.target.value) irAFecha(e.target.value); });
  document.getElementById('btn-nuevo-turno').addEventListener('click', nuevoTurno);

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
    // Guard anti-carrera: si el usuario ya navegó a otra fecha mientras se
    // pedían estos datos, descartamos esta respuesta (llegó tarde y pintaría
    // una fecha que ya no es la visible).
    if (fecha !== fechaActual) return;
    turnosCargados = turnos;
    caja.innerHTML = renderLista(turnos);
    caja.querySelectorAll('.turno-estado').forEach(sel =>
      sel.addEventListener('change', () => cambiarEstado(sel.dataset.id, sel.value)));
    caja.querySelectorAll('.btn-eliminar-turno').forEach(b =>
      b.addEventListener('click', () => eliminar(b.dataset.id)));
  } catch (err) {
    console.error('Error listando turnos:', err);
    caja.innerHTML = htmlError('No se pudieron cargar los turnos.');
  }
}

// ---------------------------------------------------------------------
// NUEVO TURNO
// ---------------------------------------------------------------------
async function nuevoTurno() {
  let pacientes = [], profesionales = [];
  try {
    [pacientes, profesionales] = await Promise.all([
      pacienteModel.listarPacientes({ soloActivos: true }),
      profesionalModel.listarProfesionales({ soloActivos: true }),
    ]);
  } catch (err) {
    console.error('Error cargando listas para turno:', err);
    toast('No se pudieron cargar pacientes / profesionales.', 'bad');
    return;
  }

  document.body.insertAdjacentHTML('beforeend', renderFormTurno(pacientes, profesionales, fechaActual));
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
      paciente_id: fd.get('paciente_id'),
      profesional_id: fd.get('profesional_id'),
      fecha: fd.get('fecha'),
      hora: fd.get('hora') || null,
      observaciones: fd.get('observaciones') || null,
    };

    const v = validarTurno(datos);
    if (!v.ok) { toast(v.mensaje, 'bad'); return; }

    btn.disabled = true;
    btn.textContent = 'Verificando…';

    // 1) VALIDACIÓN DE SUPERPOSICIÓN (ventana de duración mínima de sesión):
    // A) El PACIENTE no puede tener otro turno dentro de la ventana de 30 min
    //    (aunque sea con otro profesional: no puede estar en dos sesiones a la vez).
    // B) El PROFESIONAL no puede tener otro paciente dentro de la misma ventana.
    //    Dos turnos solapan si |horaA - horaB| < DURACION_SESION.
    const DURACION_SESION = 30; // minutos
    if (datos.hora) {
      let turnosPacDia, turnosProfDia;
      try {
        [turnosPacDia, turnosProfDia] = await Promise.all([
          turnoModel.listarTurnosPacientePorFecha(datos.paciente_id, datos.fecha),
          turnoModel.listarTurnosProfesionalPorFecha(datos.profesional_id, datos.fecha),
        ]);
      } catch (err) {
        // Si no se pudo verificar (p. ej. corte de red), NO se crea el turno
        // a ciegas: se aborta y se avisa, para no dejar pasar superposiciones.
        console.error('Error al verificar superposiciones de turnos:', err);
        toast('No se pudo verificar la disponibilidad. Revisá la conexión e intentá de nuevo.', 'bad');
        btn.disabled = false;
        btn.textContent = 'Crear turno';
        return;
      }

      const minNuevo = horaAMinutos(datos.hora);
      const solapa = (t) => {
        const m = horaAMinutos(t.hora);
        return m !== null && Math.abs(minNuevo - m) < DURACION_SESION;
      };

      const turnoPac = turnosPacDia.find(solapa);
      if (turnoPac) {
        const profNombre = turnoPac.profesionales?.nombre_completo || 'otro profesional';
        const horaExistente = (turnoPac.hora || '').slice(0, 5);
        toast(
          `El paciente ya tiene un turno a las ${horaExistente} con ${profNombre}. ` +
          `Debe haber al menos ${DURACION_SESION} min entre turnos.`,
          'bad'
        );
        btn.disabled = false;
        btn.textContent = 'Crear turno';
        return;
      }

      const turnoProf = turnosProfDia.find(solapa);
      if (turnoProf) {
        const pacNombre = turnoProf.pacientes?.nombre_completo || 'otro paciente';
        const horaExistente = (turnoProf.hora || '').slice(0, 5);
        toast(
          `El profesional ya tiene un turno con ${pacNombre} a las ${horaExistente}. ` +
          `Debe haber al menos ${DURACION_SESION} min entre turnos.`,
          'bad'
        );
        btn.disabled = false;
        btn.textContent = 'Crear turno';
        return;
      }
    }

    // 2) VALIDACIÓN DE HORARIO Y DÍAS LABORALES DEL PROFESIONAL:
    const selProf = form.querySelector('[name="profesional_id"]');
    const opt = selProf.options[selProf.selectedIndex];
    const entrada = opt?.dataset.entrada || '';
    const salida = opt?.dataset.salida || '';
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
          mensaje: `${nombreProf} no trabaja los días ${diaSemana.toLowerCase()}. ¿Querés crear el turno igual?`,
          textoOk: 'Crear igual',
          textoCancelar: 'Cancelar',
        });
        if (!seguir) {
          btn.disabled = false;
          btn.textContent = 'Crear turno';
          return;
        }
      }
    }

    // B) Aviso (no bloqueo) si la hora cae fuera del horario del profesional
    if (datos.hora && entrada && salida && !horaEnRango(datos.hora, entrada, salida)) {
      const prof = profesionales.find(p => String(p.id) === String(datos.profesional_id));
      const nombreProf = prof?.nombre_completo || 'el profesional';
      const seguir = await confirmar({
        titulo: 'Turno fuera de horario',
        mensaje: `El turno de las ${datos.hora} queda fuera del horario de ${nombreProf} (${entrada}–${salida}). ¿Querés crearlo igual?`,
        textoOk: 'Crear igual',
        textoCancelar: 'Cancelar',
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
        pacienteId: datos.paciente_id,
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
      toast(mensajeError(err, 'No se pudo crear el turno.'), 'bad');
    }
  });
}

// ---------------------------------------------------------------------
// CAMBIAR ESTADO / ELIMINAR
// ---------------------------------------------------------------------
async function cambiarEstado(id, estado) {
  // No se puede marcar "atendido" si el profesional no está presente en la
  // planilla de asistencia de esa fecha. Se verifica antes de guardar y, si
  // no corresponde, se revierte el <select> a su estado anterior.
  if (estado === 'atendido') {
    const turno = turnosCargados.find(t => String(t.id) === String(id));
    const revertir = () => {
      const sel = document.querySelector(`.turno-estado[data-id="${id}"]`);
      if (sel && turno) sel.value = turno.estado;
    };
    if (turno) {
      try {
        // Para marcar "atendido" deben estar presentes AMBOS ese día: el
        // profesional (planilla de fichaje) y el paciente (asistencia).
        const [fichajesProf, asisPac] = await Promise.all([
          asistenciaProfModel.listarPorFecha(turno.fecha),
          asistenciaModel.listarAsistenciasPorFecha(turno.fecha),
        ]);
        const profPresente = fichajesProf.some(f =>
          String(f.profesional_id) === String(turno.profesional_id) && f.estado === 'presente');
        const pacPresente = asisPac.some(a =>
          String(a.paciente_id) === String(turno.paciente_id) && a.estado === 'presente');

        if (!profPresente || !pacPresente) {
          const quien = (!profPresente && !pacPresente) ? 'el profesional ni el paciente'
            : !profPresente ? 'el profesional' : 'el paciente';
          const cuando = turno.fecha === hoyISO() ? 'de hoy' : 'de ese día';
          toast(`No se puede marcar atendido: ${quien} no figura presente en la asistencia ${cuando}.`, 'bad');
          revertir();
          return;
        }
      } catch (err) {
        console.error('Error verificando la presencia para "atendido":', err);
        toast('No se pudo verificar la presencia; intentá de nuevo.', 'bad');
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
    toast('No se pudo actualizar el turno.', 'bad');
  }
}

async function eliminar(id) {
  if (!window.confirm('¿Eliminar este turno?')) return;
  try {
    await turnoModel.eliminarTurno(id);
    toast('Turno eliminado.');
    await cargarFecha(fechaActual);
  } catch (err) {
    console.error('Error eliminando turno:', err);
    toast('No se pudo eliminar el turno.', 'bad');
  }
}
