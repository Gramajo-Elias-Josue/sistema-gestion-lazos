// =====================================================================
// CONTROLADOR: Evoluciones (evaluación diaria + informe PDF)
// ---------------------------------------------------------------------
// CAPA CONTROLADOR. Elegido un profesional y una fecha, lista sus
// pacientes en turno ese día para cargar la evaluación de cada uno y
// permite descargar el informe diario en PDF (firmable / sellable).
// =====================================================================

import * as profesionalModel from '../models/profesionalModel.js';
import * as turnoModel from '../models/turnoModel.js';
import * as evaluacionModel from '../models/evaluacionModel.js';
import * as asistenciaProfModel from '../models/asistenciaProfesionalModel.js';
import { renderEstructura, renderFilas } from '../views/evolucionesView.js';
import { hoyISO, sumarDias, nombreDia } from '../utils/fechas.js';
import { estadoCargaEvaluacion, diasRestantesEvaluacion } from '../utils/evaluacion.js';
import { htmlCargando, htmlError, toast } from '../utils/ui.js';
import { validarEvaluacion } from '../utils/validacion.js';
import { mensajeError } from '../utils/errores.js';

let profesionales = [];
let profId = null;
let fechaActual = hoyISO();
let items = [];          // { pacienteId, turnoId, nombre, hora, contenido }
let bloqueado = false;   // true si la fecha no admite carga (futura o vencida)
let avisoPlazo = null;   // el porqué, escrito para el usuario

// Punto de entrada de la sección Evoluciones (lo llama el router).
export async function iniciarEvoluciones() {
  fechaActual = hoyISO();
  const cont = document.getElementById('v-evoluciones');
  cont.innerHTML = htmlCargando('Cargando profesionales…');
  try {
    profesionales = await profesionalModel.listarProfesionales({ soloActivos: true });
  } catch (err) {
    console.error('Error cargando profesionales:', err);
    cont.innerHTML = htmlError('No se pudieron cargar los profesionales.');
    return;
  }

  profId = profesionales[0]?.id || null;
  cont.innerHTML = renderEstructura(fechaActual, profesionales, profId);

  document.getElementById('evo-prof').addEventListener('change', (e) => { profId = e.target.value; cargar(); });
  document.getElementById('evo-prev').addEventListener('click', () => irAFecha(sumarDias(fechaActual, -1)));
  document.getElementById('evo-next').addEventListener('click', () => irAFecha(sumarDias(fechaActual, 1)));
  document.getElementById('evo-hoy').addEventListener('click', () => irAFecha(hoyISO()));
  document.getElementById('evo-fecha').addEventListener('change', (e) => { if (e.target.value) irAFecha(e.target.value); });
  document.getElementById('evo-pdf').addEventListener('click', descargarPdf);
  document.getElementById('evo-body').addEventListener('click', (e) => {
    const b = e.target.closest('.evo-guardar');
    if (b) guardar(b.dataset.paciente);
  });

  await cargar();
}

function irAFecha(fecha) {
  fechaActual = fecha;
  document.getElementById('evo-fecha').value = fecha;
  document.getElementById('evo-dia').textContent = nombreDia(fecha);
  cargar();
}

// Lista los turnos del profesional en la fecha + sus evaluaciones.
async function cargar() {
  // La evaluación diaria es opcional, pero tiene plazo: se puede cargar
  // hasta una semana después. Fecha futura o vencida => solo lectura.
  const plazo = estadoCargaEvaluacion(fechaActual, hoyISO());
  bloqueado = !plazo.editable;
  avisoPlazo = plazo.mensaje;

  // El informe no tiene sentido para un día que todavía no ocurrió; sí
  // para uno viejo (se puede reimprimir lo que ya está cargado).
  const btnPdf = document.getElementById('evo-pdf');
  if (btnPdf) btnPdf.disabled = plazo.motivo === 'futuro';

  const caja = document.getElementById('evo-body');
  if (!profId) {
    caja.innerHTML = `<div class="tablewrap"><div class="state">Elegí un profesional para cargar sus evaluaciones.</div></div>`;
    return;
  }
  caja.innerHTML = htmlCargando('Cargando turnos y evaluaciones…');
  items = [];
  try {
    const [turnos, evals] = await Promise.all([
      turnoModel.listarTurnosPorFecha(fechaActual),
      evaluacionModel.listarPorProfesionalFecha(profId, fechaActual),
    ]);
    const evalPorPac = {};
    evals.forEach(ev => { evalPorPac[ev.paciente_id] = ev.contenido || ''; });
    items = turnos
      .filter(t => String(t.profesional_id) === String(profId))
      .filter(t => t.estado !== 'cancelado') // un turno cancelado no se evalúa
      .map(t => ({
        pacienteId: t.paciente_id,
        turnoId: t.id,
        nombre: t.pacientes?.nombre_completo || '—',
        hora: t.hora,
        estado: t.estado, // solo 'atendido' habilita la evaluación
        contenido: evalPorPac[t.paciente_id] || '',
      }));
    caja.innerHTML = renderFilas(items, {
      bloqueado,
      aviso: avisoPlazo,
      diasRestantes: diasRestantesEvaluacion(fechaActual, hoyISO()),
    });
  } catch (err) {
    console.error('Error cargando evoluciones:', err);
    caja.innerHTML = htmlError('No se pudieron cargar las evaluaciones.');
  }
}

// Guarda la evaluación de un paciente (upsert por paciente/prof/fecha).
async function guardar(pacienteId) {
  if (bloqueado) {
    if (avisoPlazo) toast(avisoPlazo, 'bad');
    return;
  }
  // Gate: solo se evalúa a un paciente YA ATENDIDO (turno 'atendido').
  const it = items.find(i => String(i.pacienteId) === String(pacienteId));
  if (!it || it.estado !== 'atendido') {
    toast('Este paciente todavía no figura atendido hoy. La evaluación se habilita cuando su turno esté marcado como Atendido.', 'bad');
    return;
  }
  const ta = document.querySelector(`.evo-eval[data-paciente="${pacienteId}"]`);
  if (!ta) return;
  const contenido = ta.value;
  const v = validarEvaluacion({ contenido });
  if (!v.ok) { toast(v.mensaje, 'bad'); return; }

  try {
    await evaluacionModel.guardarEvaluacion({
      pacienteId, profesionalId: profId, fecha: fechaActual,
      contenido, turnoId: ta.dataset.turno || null,
      tipo: evaluacionModel.TIPO_DIARIA,  // no se mezcla con los informes
    });
    toast('Evaluación guardada.');
  } catch (err) {
    console.error('Error guardando evaluación:', err);
    toast(mensajeError(err, 'No se pudo guardar la evaluación. Probá de nuevo.'), 'bad');
  }
}

// Genera y descarga el informe diario en PDF del profesional elegido.
async function descargarPdf() {
  if (bloqueado) { toast('No se puede generar un informe de una fecha que todavía no llegó.', 'bad'); return; }
  if (!profId) { toast('Elegí un profesional.', 'bad'); return; }
  const profesional = profesionales.find(p => String(p.id) === String(profId)) || {};

  // Evaluaciones desde lo que hay en pantalla (no exige guardar antes).
  const evaluaciones = [...document.querySelectorAll('.evo-eval')].map(ta => ({
    paciente: (items.find(i => String(i.pacienteId) === String(ta.dataset.paciente)) || {}).nombre || '—',
    contenido: ta.value,
  }));

  // Fichaje del profesional ese día, para la entrada/salida del informe.
  let fichaje = null;
  try {
    const regs = await asistenciaProfModel.listarPorFecha(fechaActual);
    fichaje = regs.find(r => String(r.profesional_id) === String(profId)) || null;
  } catch (err) {
    console.error('No se pudo leer el fichaje para el informe:', err);
  }

  try {
    // Import dinámico: jsPDF solo se carga al pedir el informe (code-split,
    // así no pesa en el bundle inicial de la app).
    const { generarInformeDiario } = await import('../utils/informePdf.js');
    generarInformeDiario({ profesional, fecha: fechaActual, evaluaciones, fichaje });
  } catch (err) {
    console.error('Error generando PDF:', err);
    toast('No se pudo generar el PDF. Probá de nuevo.', 'bad');
  }
}
