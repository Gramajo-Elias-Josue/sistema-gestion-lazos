// =====================================================================
// CONTROLADOR: Inicio
// ---------------------------------------------------------------------
// CAPA CONTROLADOR. Une vista + modelo: pide los datos a los modelos,
// maneja los estados de carga/error y se los entrega a la vista.
// =====================================================================

import * as pacienteModel from '../models/pacienteModel.js';
import * as profesionalModel from '../models/profesionalModel.js';
import * as asistenciaModel from '../models/asistenciaModel.js';
import * as documentoModel from '../models/documentoModel.js';
import * as turnoModel from '../models/turnoModel.js';
import * as asistenciaProfModel from '../models/asistenciaProfesionalModel.js';
import { renderInicio, renderKpis, renderAlertas, renderGrillaDia, renderDisponibilidad } from '../views/inicioView.js';
import { htmlCargando, htmlError } from '../utils/ui.js';
import { hoyISO } from '../utils/fechas.js';

// Punto de entrada de la sección Inicio (lo llama el router).
export async function iniciarInicio() {
  const contenedor = document.getElementById('v-inicio');
  contenedor.innerHTML = renderInicio();

  const cajaKpis = document.getElementById('inicio-kpis');
  const cajaGrilla = document.getElementById('inicio-grilla');
  const cajaDisp = document.getElementById('inicio-disponibilidad');
  const cajaAlertas = document.getElementById('inicio-alertas');
  cajaKpis.innerHTML = htmlCargando('Cargando indicadores…');
  cajaGrilla.innerHTML = htmlCargando('Cargando turnos del día…');
  cajaDisp.innerHTML = htmlCargando('Cargando profesionales…');
  cajaAlertas.innerHTML = htmlCargando('Buscando vencimientos…');

  // Atajos: tocar una tarjeta KPI navega a su sección (el router escucha
  // el cambio de hash). Delegación sobre el contenedor, que persiste.
  cajaKpis.addEventListener('click', (e) => {
    const card = e.target.closest('[data-goto]');
    if (card) location.hash = card.dataset.goto;
  });

  const hoy = hoyISO();

  // --- KPIs (consultas en paralelo) ---
  try {
    const [pacientesActivos, profesionalesActivos, asistenciasHoy, turnosHoy] = await Promise.all([
      pacienteModel.contarPacientesActivos(),
      profesionalModel.contarProfesionalesActivos(),
      asistenciaModel.contarAsistenciasHoy(hoy),
      turnoModel.contarTurnosFecha(hoy),
    ]);
    cajaKpis.innerHTML = renderKpis({ pacientesActivos, profesionalesActivos, asistenciasHoy, turnosHoy });
  } catch (err) {
    console.error('Error cargando KPIs:', err);
    cajaKpis.innerHTML = htmlError('No se pudieron cargar los indicadores.');
  }

  // --- Grilla del día (turnos de hoy: paciente ↔ profesional) ---
  try {
    const turnos = await turnoModel.listarTurnosPorFecha(hoy);
    cajaGrilla.innerHTML = renderGrillaDia(turnos);
  } catch (err) {
    console.error('Error cargando la grilla del día:', err);
    cajaGrilla.innerHTML = htmlError('No se pudo cargar la grilla del día.');
  }

  // --- Disponibilidad de hoy (profesionales presentes según el fichaje) ---
  try {
    const [profs, fichajes] = await Promise.all([
      profesionalModel.listarProfesionales({ soloActivos: true }),
      asistenciaProfModel.listarPorFecha(hoy),
    ]);
    const porId = {};
    fichajes.forEach(f => { porId[f.profesional_id] = f; });
    cajaDisp.innerHTML = renderDisponibilidad(profs, porId);
  } catch (err) {
    console.error('Error cargando la disponibilidad:', err);
    cajaDisp.innerHTML = htmlError('No se pudo cargar la disponibilidad.');
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
