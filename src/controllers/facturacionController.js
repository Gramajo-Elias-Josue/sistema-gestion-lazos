// =====================================================================
// CONTROLADOR: Facturación
// ---------------------------------------------------------------------
// CAPA CONTROLADOR. Planilla de CONTROL de facturación por paciente y
// por mes (no genera facturas, no calcula montos). Misma mecánica que
// la planilla de asistencia, pero navegando por mes en vez de por día.
// =====================================================================

import * as pacienteModel from '../models/pacienteModel.js';
import * as facturacionModel from '../models/facturacionModel.js';
import { renderEstructura, renderResumen, renderFilas, filaHtml } from '../views/facturacionView.js';
import { resumenFacturacion } from '../utils/facturacion.js';
import { periodoMensual, moverPeriodo, etiquetaPeriodo } from '../utils/periodos.js';
import { htmlCargando, htmlError, toast } from '../utils/ui.js';

// Estado en memoria de la vista mientras está abierta.
let pacientes = [];        // pacientes activos cargados
let estadosPorId = {};     // { paciente_id: estado } del período visible
let periodoActual = periodoMensual();

export async function iniciarFacturacion() {
  const contenedor = document.getElementById('v-facturacion');
  periodoActual = periodoMensual();
  contenedor.innerHTML = renderEstructura(periodoActual);

  document.getElementById('fac-prev').addEventListener('click', () => cargarPeriodo(moverPeriodo(periodoActual, -1)));
  document.getElementById('fac-next').addEventListener('click', () => cargarPeriodo(moverPeriodo(periodoActual, 1)));
  document.getElementById('fac-hoy').addEventListener('click', () => cargarPeriodo(periodoMensual()));
  document.getElementById('fac-buscar').addEventListener('input', aplicarFiltro);

  // Delegación de eventos: un solo listener sobrevive a los re-render de filas.
  document.getElementById('fac-body').addEventListener('click', (e) => {
    const btn = e.target.closest('.seg button');
    if (btn) marcar(btn.dataset.paciente, btn.dataset.estado);
  });

  await cargarPeriodo(periodoActual);
}

// ---------------------------------------------------------------------
// CARGA DE UN PERÍODO
// ---------------------------------------------------------------------
async function cargarPeriodo(periodo) {
  periodoActual = periodo;
  document.getElementById('fac-periodo').textContent = etiquetaPeriodo(periodo);

  const caja = document.getElementById('fac-body');
  caja.innerHTML = htmlCargando('Cargando pacientes…');

  try {
    const [activos, registros] = await Promise.all([
      pacienteModel.listarPacientes({ soloActivos: true }),
      facturacionModel.listarPorPeriodo(periodo),
    ]);
    // Guard anti-carrera: si ya se cambió de mes mientras se pedían estos
    // datos, se descarta esta respuesta (llegó tarde).
    if (periodo !== periodoActual) return;

    pacientes = activos;
    estadosPorId = {};
    registros.forEach(r => { estadosPorId[r.paciente_id] = r.estado; });

    caja.innerHTML = renderFilas(pacientes, estadosPorId);
    aplicarFiltro();
    recalcular();
  } catch (err) {
    console.error('Error cargando facturación:', err);
    caja.innerHTML = htmlError('No se pudo cargar la facturación. Revisá la conexión.');
  }
}

// ---------------------------------------------------------------------
// MARCAR (guarda con actualización optimista y reversión si falla)
// ---------------------------------------------------------------------
async function marcar(pacienteId, estado) {
  const previo = estadosPorId[pacienteId];
  estadosPorId[pacienteId] = estado;
  refrescarFila(pacienteId);
  recalcular();

  try {
    await facturacionModel.guardarEstado({ pacienteId, periodo: periodoActual, estado });
  } catch (err) {
    console.error('Error guardando facturación:', err);
    if (previo) estadosPorId[pacienteId] = previo; else delete estadosPorId[pacienteId];
    refrescarFila(pacienteId);
    recalcular();
    toast('No se pudo guardar. Probá de nuevo.', 'bad');
  }
}

// ---------------------------------------------------------------------
// RE-RENDER Y RESUMEN
// ---------------------------------------------------------------------
function refrescarFila(pacienteId) {
  const fila = document.querySelector(`#fac-body .asis-row[data-fila="${pacienteId}"]`);
  if (!fila) return;
  const paciente = pacientes.find(p => String(p.id) === String(pacienteId));
  if (!paciente) return;
  fila.outerHTML = filaHtml(paciente, estadosPorId[pacienteId]);
  aplicarFiltro();
}

function aplicarFiltro() {
  const termino = (document.getElementById('fac-buscar').value || '').trim().toLowerCase();
  document.querySelectorAll('#fac-body .asis-row').forEach(fila => {
    fila.style.display = !termino || fila.dataset.buscar.includes(termino) ? '' : 'none';
  });
}

function recalcular() {
  document.getElementById('fac-resumen').innerHTML = renderResumen(resumenFacturacion(pacientes, estadosPorId));
}
