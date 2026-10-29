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
import { renderInicio, renderKpis, renderAlertas, renderDisponibilidad, renderEntregas, renderMiFichaje } from '../views/inicioView.js';
import { iniciarGrillaAtencion } from './grillaAtencionController.js';
import { htmlCargando, htmlError, toast } from '../utils/ui.js';
import { mensajeError } from '../utils/errores.js';
import { obtenerUbicacion, mensajeErrorUbicacion, proximoPaso } from '../utils/ubicacion.js';
import { perfilActual } from '../sesion.js';
import { hoyISO, rangoMes } from '../utils/fechas.js';
import { periodoMensual, pendientesDelMes } from '../utils/periodos.js';

// Punto de entrada de la sección Inicio (lo llama el router).
export async function iniciarInicio() {
  const contenedor = document.getElementById('v-inicio');
  // El profesional (usuario vinculado a un profesional) ficha desde acá.
  const perfil = perfilActual();
  const miProfesionalId = perfil?.rol === 'profesional' ? perfil?.profesional_id : null;
  contenedor.innerHTML = renderInicio({ conFichaje: !!miProfesionalId });
  if (miProfesionalId) iniciarMiFichaje(miProfesionalId);

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

  // --- Entregas del mes (informe mensual + foto de trabajo) ---
  // El informe mensual es el MISMO que se carga en la historia clínica
  // del paciente: acá solo se mira quién cargó al menos uno este mes.
  try {
    const periodo = periodoMensual();
    const { desde, hasta } = rangoMes(hoy);
    const [profs, informes, fotos] = await Promise.all([
      profesionalModel.listarProfesionales({ soloActivos: true }),
      evaluacionModel.listarInformesPorRango('mensual', desde, hasta),
      fotoModel.listarTodas(),
    ]);
    cajaEntregas.innerHTML = renderEntregas(
      pendientesDelMes({ profesionales: profs, informes, fotos, periodo })
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
// MI FICHAJE (solo el profesional)
// ---------------------------------------------------------------------
// El botón manda la ubicación a la base; la base decide (distancia, hora,
// entrada o salida) y devuelve la fila del día, que se vuelve a dibujar.
async function iniciarMiFichaje(profesionalId) {
  const caja = document.getElementById('inicio-fichaje');
  caja.innerHTML = htmlCargando('Cargando tu fichaje…');

  const dibujar = (fila) => {
    caja.innerHTML = renderMiFichaje({ paso: proximoPaso(fila), fila });
  };

  // Delegación: el botón se vuelve a dibujar después de cada fichaje.
  caja.addEventListener('click', async (e) => {
    const btn = e.target.closest('#btn-fichar');
    if (!btn || btn.disabled) return;
    const textoOriginal = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Buscando tu ubicación…';
    try {
      const { lat, lng } = await obtenerUbicacion();
      btn.textContent = 'Fichando…';
      const fila = await asistenciaProfModel.ficharConUbicacion(lat, lng);
      // Sin hora de vuelta no se guardó nada: no se avisa "fichada".
      if (!fila?.hora_entrada) throw new Error('fichar() no devolvió el fichaje');
      dibujar(fila);
      toast(fila?.hora_salida ? 'Salida fichada.' : 'Entrada fichada.');
    } catch (err) {
      console.error('Error fichando:', err);
      toast(esErrorDeUbicacion(err) ? mensajeErrorUbicacion(err) : mensajeError(err, 'No se pudo fichar. Probá de nuevo.'), 'bad');
      btn.disabled = false;
      btn.textContent = textoOriginal;
    }
  });

  try {
    dibujar(await asistenciaProfModel.fichajeDelDia(profesionalId, hoyISO()));
  } catch (err) {
    console.error('Error cargando mi fichaje:', err);
    caja.innerHTML = htmlError('No se pudo cargar tu fichaje.');
  }
}

// Los errores del navegador traen un código numérico (1, 2, 3); los de
// la base, un código de texto ('P0001', '42501'…).
function esErrorDeUbicacion(err) {
  return typeof err?.code === 'number' || err?.code === 'NO_SOPORTADO';
}
