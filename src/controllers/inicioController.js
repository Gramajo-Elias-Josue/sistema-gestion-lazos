// =====================================================================
// CONTROLADOR: Inicio
// ---------------------------------------------------------------------
// CAPA CONTROLADOR. Une vista + modelo: pide los datos a los modelos,
// maneja los estados de carga/error y se los entrega a la vista.
// =====================================================================

import * as profesionalModel from '../models/profesionalModel.js';
import * as asistenciaModel from '../models/asistenciaModel.js';
import * as documentoModel from '../models/documentoModel.js';
import * as asistenciaProfModel from '../models/asistenciaProfesionalModel.js';
import * as fotoModel from '../models/fotoModel.js';
import * as evaluacionModel from '../models/evaluacionModel.js';
import {
  renderInicio, renderKpis, renderAlertas, renderDisponibilidad, renderEntregas,
  renderInicioProfesional, renderRecordatorioFichaje, renderMisEntregas,
} from '../views/inicioView.js';
import * as asignacionModel from '../models/asignacionModel.js';
import { iniciarGrillaAtencion } from './grillaAtencionController.js';
import { htmlCargando, htmlError } from '../utils/ui.js';
import { pasoFichaje, esDobleTurno } from '../utils/tramosFichaje.js';
import { perfilActual } from '../sesion.js';
import { hoyISO, rangoMes } from '../utils/fechas.js';
import { periodoMensual, pendientesDelMes } from '../utils/periodos.js';

// Punto de entrada de la sección Inicio (lo llama el router).
export async function iniciarInicio() {
  const contenedor = document.getElementById('v-inicio');
  // El profesional tiene su propio Inicio: su grilla y el recordatorio
  // del fichaje.
  const perfil = perfilActual();
  if (perfil?.rol === 'profesional') {
    await iniciarInicioProfesional(contenedor, perfil.profesional_id);
    return;
  }
  contenedor.innerHTML = renderInicio();

  const cajaKpis = document.getElementById('inicio-kpis');
  const cajaGrilla = document.getElementById('inicio-grilla');
  const cajaDisp = document.getElementById('inicio-disponibilidad');
  const cajaAlertas = document.getElementById('inicio-alertas');
  const cajaEntregas = document.getElementById('inicio-entregas');
  cajaKpis.innerHTML = htmlCargando('Cargando indicadores…');
  cajaEntregas.innerHTML = htmlCargando('Revisando entregas del mes…');
  cajaDisp.innerHTML = htmlCargando('Cargando profesionales…');
  cajaAlertas.innerHTML = htmlCargando('Buscando vencimientos…');

  // Atajos: tocar una tarjeta KPI navega a su sección (el router escucha
  // el cambio de hash). Delegación sobre el contenedor, que persiste.
  cajaKpis.addEventListener('click', (e) => {
    const card = e.target.closest('[data-goto]');
    if (card) location.hash = card.dataset.goto;
  });

  const hoy = hoyISO();

  // --- KPI (Asistencias hoy: el único número que cambia en el día) ---
  try {
    const asistenciasHoy = await asistenciaModel.contarAsistenciasHoy(hoy);
    cajaKpis.innerHTML = renderKpis({ asistenciasHoy });
  } catch (err) {
    console.error('Error cargando KPIs:', err);
    cajaKpis.innerHTML = htmlError('No se pudieron cargar los indicadores.');
  }

  // --- Grilla de atención (pacientes × profesionales, editable) ---
  // Es la planilla fija del centro: se llena a mano y se repite todos
  // los días. La maneja su propio controlador.
  iniciarGrillaAtencion(cajaGrilla);

  // --- Disponibilidad de hoy (profesionales presentes según el fichaje) ---
  // La planilla de la secretaría manda; si todavía no lo cargó pero el
  // profesional fichó con su ubicación, también figura presente (eso lo
  // ve solo la dirección: a la secretaría la base no le da los fichajes).
  try {
    const [profs, fichajes, propios] = await Promise.all([
      profesionalModel.listarProfesionales({ soloActivos: true }),
      asistenciaProfModel.listarPorFecha(hoy),
      asistenciaProfModel.listarPropiosPorRango(hoy, hoy).catch(() => []),
    ]);
    const porId = {};
    propios.forEach(f => { porId[f.profesional_id] = { ...f, estado: 'presente' }; });
    fichajes.forEach(f => { porId[f.profesional_id] = f; });
    cajaDisp.innerHTML = renderDisponibilidad(profs, porId);
  } catch (err) {
    console.error('Error cargando la disponibilidad:', err);
    cajaDisp.innerHTML = htmlError('No se pudo cargar la disponibilidad.');
  }

  // --- Entregas del mes (informe mensual + foto de trabajo) ---
  // El informe mensual es el MISMO que se carga en la historia clínica
  // del paciente, y es UNO POR PACIENTE: cada profesional debe el de cada
  // paciente que tiene en la grilla.
  try {
    const periodo = periodoMensual();
    const { desde, hasta } = rangoMes(hoy);
    const [profs, informes, fotos, asignaciones] = await Promise.all([
      profesionalModel.listarProfesionales({ soloActivos: true }),
      evaluacionModel.listarInformesPorRango('mensual', desde, hasta),
      fotoModel.listarTodas(),
      asignacionModel.listarVigentes(),
    ]);
    cajaEntregas.innerHTML = renderEntregas(
      pendientesDelMes({ profesionales: profs, informes, fotos, asignaciones, periodo })
    );
  } catch (err) {
    console.error('Error cargando las entregas del mes:', err);
    cajaEntregas.innerHTML = htmlError('No se pudieron cargar las entregas del mes.');
  }

  // --- Panel de alertas de documentación ---
  try {
    const vencimientos = await documentoModel.listarVencimientos(30);
    cajaAlertas.innerHTML = renderAlertas(vencimientos);
  } catch (err) {
    console.error('Error cargando alertas:', err);
    cajaAlertas.innerHTML = htmlError('No se pudieron cargar las alertas.');
  }
}

// ---------------------------------------------------------------------
// INICIO DEL PROFESIONAL
// ---------------------------------------------------------------------
// Solo su grilla (sus horarios y pacientes, sin editar) y, si le falta
// algo, recordatorios: fichar hoy (lleva a "Mi fichaje") y lo que debe
// entregar este mes (el informe de cada paciente, su foto).
async function iniciarInicioProfesional(contenedor, profesionalId) {
  contenedor.innerHTML = renderInicioProfesional();
  if (!profesionalId) {
    document.getElementById('inicio-grilla').innerHTML =
      `<div class="state">Tu usuario no está vinculado a un profesional. Avisale a la dirección.</div>`;
    return;
  }
  iniciarGrillaAtencion(document.getElementById('inicio-grilla'), { soloProfesionalId: profesionalId });

  // El recordatorio es un agregado: si falla, el Inicio sigue igual.
  try {
    const [fila, prof] = await Promise.all([
      asistenciaProfModel.miFichajeDelDia(profesionalId, hoyISO()),
      profesionalModel.obtenerProfesional(profesionalId),
    ]);
    const doble = esDobleTurno(prof);
    document.getElementById('inicio-recordatorio').innerHTML =
      renderRecordatorioFichaje({ paso: pasoFichaje(fila, doble), fila, doble });
  } catch (err) {
    console.error('Error cargando el recordatorio del fichaje:', err);
  }

  // Lo que debe entregar este mes (también es un agregado).
  try {
    const hoy = hoyISO();
    const periodo = periodoMensual(hoy);
    const { desde, hasta } = rangoMes(hoy);
    const [prof, informes, fotos, asignaciones] = await Promise.all([
      profesionalModel.obtenerProfesional(profesionalId),
      evaluacionModel.listarInformesPorRango('mensual', desde, hasta),
      fotoModel.listarTodas(),
      asignacionModel.listarVigentes(),
    ]);
    const pend = pendientesDelMes({ profesionales: [prof], informes, fotos, asignaciones, periodo });
    document.getElementById('inicio-mis-entregas').innerHTML = renderMisEntregas({
      periodo,
      pacientes: pend.informes[0]?.pacientesPendientes || [],
      debeFoto: pend.fotos.length > 0,
    });
  } catch (err) {
    console.error('Error cargando lo que falta entregar:', err);
  }
}
