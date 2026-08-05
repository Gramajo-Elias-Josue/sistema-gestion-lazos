// =====================================================================
// CONTROLADOR: Calendario de asistencia (ficha grande)
// ---------------------------------------------------------------------
// CAPA CONTROLADOR. Abre el modal con el registro de asistencia de UNA
// persona —paciente o profesional— mes por mes, y permite descargarlo en
// PDF con el membrete institucional.
//
// Es el mismo flujo para los dos casos: cambia de dónde salen los
// registros (tabla `asistencias` o `asistencias_profesionales`), así que
// se resuelve con un "cargador" distinto según el tipo.
// =====================================================================

import * as asistenciaModel from '../models/asistenciaModel.js';
import * as asistenciaProfModel from '../models/asistenciaProfesionalModel.js';
import { renderModalCalendario, renderCalendario } from '../views/calendarioAsistenciaView.js';
import { htmlCargando, htmlError, toast } from '../utils/ui.js';
import { armarCalendario, etiquetaMes, mesDeFecha, moverMes, rangoDelMes } from '../utils/calendario.js';
import { generarPlanillaAsistencia } from '../utils/informePdf.js';

// Estado del modal mientras está abierto.
let actual = null; // { tipo, persona, subtitulo, anio, mes, calendario }

// Abre la ficha de asistencia de un PACIENTE.
export function abrirCalendarioPaciente(paciente) {
  abrir({
    tipo: 'paciente',
    persona: paciente,
    subtitulo: paciente.diagnostico || 'Paciente',
    cargar: (desde, hasta) => asistenciaModel.listarPorPacienteRango(paciente.id, desde, hasta),
  });
}

// Abre la ficha de asistencia (fichaje) de un PROFESIONAL.
export function abrirCalendarioProfesional(profesional) {
  const datos = [profesional.profesion, profesional.matricula ? `Mat. ${profesional.matricula}` : null]
    .filter(Boolean).join(' · ');
  abrir({
    tipo: 'profesional',
    persona: profesional,
    subtitulo: datos || 'Profesional',
    cargar: (desde, hasta) => asistenciaProfModel.listarPorProfesionalRango(profesional.id, desde, hasta),
  });
}

// Monta el modal y engancha la navegación por mes, el cierre y el PDF.
function abrir({ tipo, persona, subtitulo, cargar }) {
  const { anio, mes } = mesDeFecha();
  actual = { tipo, persona, subtitulo, anio, mes, cargar, calendario: null };

  document.body.insertAdjacentHTML('beforeend',
    renderModalCalendario({ persona, subtitulo, anio, mes, contenido: htmlCargando('Cargando asistencia…') }));

  const overlay = document.getElementById('overlay-cal');
  const cerrar = () => {
    overlay.remove();
    document.removeEventListener('keydown', alTeclado);
    actual = null;
  };
  const alTeclado = (e) => { if (e.key === 'Escape') cerrar(); };

  overlay.querySelectorAll('[data-cerrar]').forEach(b => b.addEventListener('click', cerrar));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
  document.addEventListener('keydown', alTeclado);

  overlay.querySelector('.cal-nav').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mes]');
    if (!b) return;
    if (b.dataset.mes === 'hoy') {
      const hoy = mesDeFecha();
      cargarMes(hoy.anio, hoy.mes);
    } else {
      const destino = moverMes(actual.anio, actual.mes, Number(b.dataset.mes));
      cargarMes(destino.anio, destino.mes);
    }
  });

  document.getElementById('cal-pdf').addEventListener('click', descargarPdf);

  cargarMes(anio, mes);
}

// Trae los registros del mes y pinta el calendario.
async function cargarMes(anio, mes) {
  if (!actual) return;
  actual.anio = anio;
  actual.mes = mes;
  document.getElementById('cal-mes-label').textContent = etiquetaMes(anio, mes);

  const caja = document.getElementById('cal-contenido');
  caja.innerHTML = htmlCargando('Cargando asistencia…');

  const { desde, hasta } = rangoDelMes(anio, mes);
  try {
    const registros = await actual.cargar(desde, hasta);
    // Guard anti-carrera: si ya se cambió de mes (o se cerró el modal)
    // mientras llegaban los datos, esta respuesta se descarta.
    if (!actual || actual.anio !== anio || actual.mes !== mes) return;
    actual.calendario = armarCalendario({ anio, mes, registros });
    caja.innerHTML = renderCalendario(actual.calendario);
  } catch (err) {
    console.error('Error cargando el calendario de asistencia:', err);
    caja.innerHTML = htmlError('No se pudo cargar la asistencia de este mes. Revisá la conexión.');
  }
}

// Descarga la planilla mensual en PDF (mismo membrete que los informes).
async function descargarPdf() {
  if (!actual?.calendario) {
    toast('Esperá a que termine de cargar el mes.', 'bad');
    return;
  }
  const btn = document.getElementById('cal-pdf');
  btn.disabled = true;
  const textoPrevio = btn.textContent;
  btn.textContent = 'Generando…';
  try {
    await generarPlanillaAsistencia({
      persona: actual.persona,
      tipo: actual.tipo,
      subtitulo: actual.subtitulo,
      calendario: actual.calendario,
    });
    toast('Planilla descargada.');
  } catch (err) {
    console.error('Error generando la planilla de asistencia:', err);
    toast('No se pudo generar el PDF. Probá de nuevo.', 'bad');
  } finally {
    btn.disabled = false;
    btn.textContent = textoPrevio;
  }
}
