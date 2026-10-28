// =====================================================================
// CONTROLADOR: Estadísticas
// ---------------------------------------------------------------------
// CAPA CONTROLADOR. Pide los datos de los últimos meses (un solo viaje a
// la base), calcula los números con utils/estadisticas.js y dibuja los
// cuatro bloques. Navegación por mes, como Facturación y Gastos.
// =====================================================================

import * as estadisticaModel from '../models/estadisticaModel.js';
import { renderEstructura, renderAsistencia, renderAtencion, renderInformes, renderGestion } from '../views/estadisticasView.js';
import * as E from '../utils/estadisticas.js';
import { resumenFacturacion } from '../utils/facturacion.js';
import { resumenPorSocio, totalGastos } from '../utils/gastos.js';
import { periodoMensual, moverPeriodo, etiquetaPeriodo } from '../utils/periodos.js';
import { htmlCargando, htmlError } from '../utils/ui.js';

let periodoActual = periodoMensual();
const BLOQUES = ['es-asistencia', 'es-atencion', 'es-informes', 'es-gestion'];

export async function iniciarEstadisticas() {
  const contenedor = document.getElementById('v-estadisticas');
  periodoActual = periodoMensual();
  contenedor.innerHTML = renderEstructura(periodoActual);

  document.getElementById('es-prev').addEventListener('click', () => cargarPeriodo(moverPeriodo(periodoActual, -1)));
  document.getElementById('es-next').addEventListener('click', () => cargarPeriodo(moverPeriodo(periodoActual, 1)));
  document.getElementById('es-hoy').addEventListener('click', () => cargarPeriodo(periodoMensual()));

  await cargarPeriodo(periodoActual);
}

async function cargarPeriodo(periodo) {
  periodoActual = periodo;
  document.getElementById('es-periodo').textContent = etiquetaPeriodo(periodo);
  BLOQUES.forEach((id, i) => {
    document.getElementById(id).innerHTML = i ? '' : htmlCargando('Calculando estadísticas…');
  });

  try {
    const meses = E.mesesHasta(periodo);
    const d = await estadisticaModel.datosDelRango({ ...E.rangoDeMeses(meses), meses });
    // Guard anti-carrera: si ya se cambió de mes mientras llegaban los
    // datos, esta respuesta se descarta.
    if (periodo !== periodoActual) return;

    const enMes = (fila) => periodoMensual(fila.fecha) === periodo;
    const activos = d.pacientes.filter(p => p.estado_admision === 'admitido' && p.estado === 'activo');
    const estadosFact = Object.fromEntries(d.facturacion.filter(f => f.periodo === periodo).map(f => [f.paciente_id, f.estado]));
    const gastosDelMes = d.gastos.filter(enMes);

    document.getElementById('es-asistencia').innerHTML = renderAsistencia({
      periodo,
      porMes: E.asistenciaPorMes(d.asistencias, meses),
      ausentismo: E.ausentismoPorPaciente(d.asistencias, d.pacientes, periodo),
      fichaje: E.fichajePorProfesional(d.fichajes, d.profesionales, periodo),
    });
    document.getElementById('es-atencion').innerHTML = renderAtencion({
      resumen: E.resumenPacientes(d.pacientes),
      ingresos: E.ingresosPorMes(d.pacientes, meses),
      porProfesion: E.pacientesPorProfesion(d.asignaciones, d.profesionales, d.sectores),
    });
    document.getElementById('es-informes').innerHTML = renderInformes({
      periodo,
      documentos: E.documentosPorMes(d.evaluaciones, meses),
      entregas: E.entregasDeInformes(d.evaluaciones, d.profesionales, d.asignaciones, periodo),
      casuales: E.turnosCasualesPorMes(d.turnos, meses),
    });
    document.getElementById('es-gestion').innerHTML = renderGestion({
      periodo,
      facturacion: E.facturacionPorMes(d.facturacion, meses),
      resumenMes: resumenFacturacion(activos, estadosFact),
      gastosMes: E.gastosPorMes(d.gastos, meses),
      porSocio: resumenPorSocio(gastosDelMes),
      porCategoria: E.gastosPorCategoria(gastosDelMes),
      total: totalGastos(gastosDelMes),
    });
  } catch (err) {
    console.error('Error cargando estadísticas:', err);
    if (periodo !== periodoActual) return;
    document.getElementById('es-asistencia').innerHTML = htmlError('No se pudieron cargar las estadísticas. Revisá la conexión.');
  }
}
