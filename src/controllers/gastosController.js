// =====================================================================
// CONTROLADOR: Gastos
// ---------------------------------------------------------------------
// CAPA CONTROLADOR. Alta y listado de gastos del mes, con rendición de
// cuentas por socio (quién pagó cuánto). Navegación por mes, como
// Facturación.
// =====================================================================

import * as gastoModel from '../models/gastoModel.js';
import { renderEstructura, renderResumen, renderLista, renderFormGasto } from '../views/gastosView.js';
import { validarGasto } from '../utils/validacion.js';
import { htmlCargando, htmlError, toast, confirmar } from '../utils/ui.js';
import { mensajeError } from '../utils/errores.js';
import { periodoMensual, moverPeriodo, etiquetaPeriodo } from '../utils/periodos.js';
import { rangoMes } from '../utils/fechas.js';
import { hojasGastos, descargarExcel } from '../utils/excel.js';

let periodoActual = periodoMensual();
let gastosCargados = []; // los del mes visible (para exportar sin volver a pedirlos)

export async function iniciarGastos() {
  const contenedor = document.getElementById('v-gastos');
  periodoActual = periodoMensual();
  contenedor.innerHTML = renderEstructura(periodoActual);

  document.getElementById('ga-prev').addEventListener('click', () => cargarPeriodo(moverPeriodo(periodoActual, -1)));
  document.getElementById('ga-next').addEventListener('click', () => cargarPeriodo(moverPeriodo(periodoActual, 1)));
  document.getElementById('ga-hoy').addEventListener('click', () => cargarPeriodo(periodoMensual()));
  document.getElementById('btn-nuevo-gasto').addEventListener('click', () => abrirForm());
  document.getElementById('btn-excel-gastos').addEventListener('click', exportarExcel);

  document.getElementById('ga-lista').addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-eliminar-gasto');
    if (btn) eliminar(btn.dataset.id);
  });

  await cargarPeriodo(periodoActual);
}

// ---------------------------------------------------------------------
// CARGA DE UN PERÍODO
// ---------------------------------------------------------------------
async function cargarPeriodo(periodo) {
  periodoActual = periodo;
  gastosCargados = []; // hasta que lleguen los del mes nuevo, no se exporta el anterior
  document.getElementById('ga-periodo').textContent = etiquetaPeriodo(periodo);

  const cajaResumen = document.getElementById('ga-resumen');
  const cajaLista = document.getElementById('ga-lista');
  cajaLista.innerHTML = htmlCargando('Cargando gastos…');

  try {
    const { desde, hasta } = rangoMes(`${periodo}-01`);
    const gastos = await gastoModel.listarPorRango(desde, hasta);
    // Guard anti-carrera: si ya se cambió de mes mientras se pedían estos
    // datos, se descarta esta respuesta (llegó tarde).
    if (periodo !== periodoActual) return;

    gastosCargados = gastos;
    cajaResumen.innerHTML = renderResumen(gastos);
    cajaLista.innerHTML = renderLista(gastos);
  } catch (err) {
    console.error('Error cargando gastos:', err);
    cajaLista.innerHTML = htmlError('No se pudieron cargar los gastos. Revisá la conexión.');
  }
}

// ---------------------------------------------------------------------
// EXPORTAR A EXCEL (el mes visible: detalle + rendición por socio)
// ---------------------------------------------------------------------
async function exportarExcel() {
  if (!gastosCargados.length) {
    toast('No hay gastos en este mes para exportar.', 'bad');
    return;
  }
  try {
    await descargarExcel(`gastos-${periodoActual}.xlsx`, hojasGastos(gastosCargados, periodoActual));
  } catch (err) {
    console.error('Error exportando gastos a Excel:', err);
    toast('No se pudo generar el Excel. Probá de nuevo.', 'bad');
  }
}

// ---------------------------------------------------------------------
// ALTA (nuevo gasto)
// ---------------------------------------------------------------------
function abrirForm() {
  document.body.insertAdjacentHTML('beforeend', renderFormGasto());
  const overlay = document.getElementById('overlay-gasto');
  const form = document.getElementById('form-gasto');
  const cerrar = () => overlay.remove();

  overlay.querySelectorAll('[data-cerrar]').forEach(b => b.addEventListener('click', cerrar));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-guardar-gasto');
    const datos = Object.fromEntries(new FormData(form).entries());

    const v = validarGasto(datos);
    if (!v.ok) { toast(v.mensaje, 'bad'); return; }

    btn.disabled = true;
    btn.textContent = 'Guardando…';
    try {
      await gastoModel.crearGasto(datos);
      toast('Gasto guardado.');
      cerrar();
      await cargarPeriodo(periodoActual);
    } catch (err) {
      console.error('Error guardando gasto:', err);
      btn.disabled = false;
      btn.textContent = 'Guardar gasto';
      toast(mensajeError(err, 'No se pudo guardar el gasto. Probá de nuevo.'), 'bad');
    }
  });
}

// ---------------------------------------------------------------------
// ELIMINAR
// ---------------------------------------------------------------------
async function eliminar(id) {
  const seguir = await confirmar({
    titulo: 'Eliminar gasto',
    mensaje: 'Esta acción no se puede deshacer.',
    textoOk: 'Eliminar',
    textoCancelar: 'Volver',
    peligro: true,
  });
  if (!seguir) return;

  try {
    await gastoModel.eliminarGasto(id);
    toast('Gasto eliminado.');
    await cargarPeriodo(periodoActual);
  } catch (err) {
    console.error('Error eliminando gasto:', err);
    toast(mensajeError(err, 'No se pudo eliminar el gasto. Probá de nuevo.'), 'bad');
  }
}
