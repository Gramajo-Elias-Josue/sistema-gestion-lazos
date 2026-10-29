// =====================================================================
// CONTROLADOR: Control de horas (pestaña de Asistencia, SOLO dirección)
// ---------------------------------------------------------------------
// CAPA CONTROLADOR. Trae, para el mes elegido, la planilla de la
// secretaría y los fichajes propios de los profesionales, los compara
// (utils/controlHoras.js) y los muestra; se pueden bajar en Excel para
// los sueldos. La pestaña solo aparece para la dirección, y la base
// tampoco le da los fichajes propios a nadie más (script 19).
// =====================================================================

import * as profesionalModel from '../models/profesionalModel.js';
import * as asistenciaProfModel from '../models/asistenciaProfesionalModel.js';
import { renderEstructuraControl, renderResumenControl, renderDetalleControl } from '../views/controlHorasView.js';
import { htmlCargando, htmlError, toast } from '../utils/ui.js';
import { periodoMensual, moverPeriodo, etiquetaPeriodo } from '../utils/periodos.js';
import { resumenControlHoras } from '../utils/controlHoras.js';
import { hojasControlHoras, descargarExcel } from '../utils/excel.js';

let periodoActual = periodoMensual();
let resumen = [];
let seleccionado = null; // profesional_id del detalle abierto

// Arranca la pestaña (lo llama Asistencia la primera vez que se abre).
export async function iniciarControlHoras() {
  periodoActual = periodoMensual();
  const cont = document.getElementById('asis-pane-ctl');
  cont.innerHTML = renderEstructuraControl(periodoActual);

  document.getElementById('ctl-prev').addEventListener('click', () => cargarPeriodo(moverPeriodo(periodoActual, -1)));
  document.getElementById('ctl-next').addEventListener('click', () => cargarPeriodo(moverPeriodo(periodoActual, 1)));
  document.getElementById('ctl-hoy').addEventListener('click', () => cargarPeriodo(periodoMensual()));
  document.getElementById('btn-excel-control').addEventListener('click', exportarExcel);

  // Tocar un profesional abre (o cierra) su detalle día por día.
  document.getElementById('ctl-resumen').addEventListener('click', (e) => {
    const fila = e.target.closest('[data-ctl-prof]');
    if (!fila) return;
    seleccionado = String(seleccionado) === fila.dataset.ctlProf ? null : fila.dataset.ctlProf;
    pintar();
    if (seleccionado) document.getElementById('ctl-detalle').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  await cargarPeriodo(periodoActual);
}

async function cargarPeriodo(periodo) {
  periodoActual = periodo;
  seleccionado = null;
  document.getElementById('ctl-periodo').textContent = etiquetaPeriodo(periodo);
  const caja = document.getElementById('ctl-resumen');
  document.getElementById('ctl-detalle').innerHTML = '';
  caja.innerHTML = htmlCargando('Comparando la planilla con los fichajes…');

  const [anio, mes] = periodo.split('-').map(Number);
  const desde = `${periodo}-01`;
  const hasta = `${periodo}-${String(new Date(anio, mes, 0).getDate()).padStart(2, '0')}`;
  try {
    const [profesionales, planillas, propios] = await Promise.all([
      profesionalModel.listarProfesionales({ soloActivos: true }),
      asistenciaProfModel.listarPorRango(desde, hasta),
      asistenciaProfModel.listarPropiosPorRango(desde, hasta),
    ]);
    if (periodo !== periodoActual) return; // ya se cambió de mes
    resumen = resumenControlHoras({ profesionales, planillas, propios });
    pintar();
  } catch (err) {
    console.error('Error cargando el control de horas:', err);
    caja.innerHTML = htmlError('No se pudo cargar el control de horas. Revisá la conexión.');
  }
}

function pintar() {
  document.getElementById('ctl-resumen').innerHTML = renderResumenControl(resumen, seleccionado);
  const r = resumen.find(x => String(x.profesional.id) === String(seleccionado));
  document.getElementById('ctl-detalle').innerHTML = renderDetalleControl(r);
}

async function exportarExcel() {
  if (!resumen.length) { toast('No hay datos para exportar en este mes.', 'bad'); return; }
  const btn = document.getElementById('btn-excel-control');
  const texto = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Generando…';
  try {
    await descargarExcel(`control-horas-${periodoActual}.xlsx`, hojasControlHoras(resumen, periodoActual));
    toast('Planilla descargada.');
  } catch (err) {
    console.error('Error exportando el control de horas:', err);
    toast('No se pudo generar el Excel. Probá de nuevo.', 'bad');
  } finally {
    btn.disabled = false;
    btn.textContent = texto;
  }
}
