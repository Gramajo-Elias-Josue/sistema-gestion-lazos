// =====================================================================
// CONTROLADOR: Mi fichaje (solo el profesional)
// ---------------------------------------------------------------------
// CAPA CONTROLADOR. Cada botón (entrada / salida) pide la ubicación al
// navegador y se la manda a la base junto con QUÉ se ficha. La base
// (función fichar(), script 16) decide: que esté en el centro, que le
// toque fichar eso, y pone la hora. Acá solo se redibuja con lo que vuelve.
//
// Debajo, el calendario del mes ("Mi asistencia"): el mismo de la ficha
// del profesional, con el detalle del día al tocarlo y el PDF.
// =====================================================================

import * as asistenciaProfModel from '../models/asistenciaProfesionalModel.js';
import * as profesionalModel from '../models/profesionalModel.js';
import { renderFichaje, renderEstructuraFichaje } from '../views/fichajeView.js';
import { renderCalendario } from '../views/calendarioAsistenciaView.js';
import { engancharDetalleDia } from './calendarioAsistenciaController.js';
import { htmlCargando, htmlError, toast, confirmar } from '../utils/ui.js';
import { armarCalendario, etiquetaMes, mesDeFecha, moverMes, rangoDelMes } from '../utils/calendario.js';
import { generarPlanillaAsistencia } from '../utils/informePdf.js';
import { mensajeError } from '../utils/errores.js';
import { obtenerUbicacion, mensajeErrorUbicacion, conPrecision } from '../utils/ubicacion.js';
import { hoyISO } from '../utils/fechas.js';
import { perfilActual } from '../sesion.js';

// Mes del calendario que se está viendo.
let cal = null; // { anio, mes, calendario }

// Punto de entrada de la sección (lo llama el router).
export async function iniciarFichaje() {
  const caja = document.getElementById('v-fichaje');
  const profesionalId = perfilActual()?.profesional_id;
  if (!profesionalId) {
    caja.innerHTML = `<div class="state">Tu usuario no está vinculado a un profesional. Avisale a la dirección.</div>`;
    return;
  }

  const { anio, mes } = mesDeFecha();
  cal = { anio, mes, calendario: null };
  caja.innerHTML = renderEstructuraFichaje({ anio, mes });
  const cuerpo = document.getElementById('fich-cuerpo');
  cuerpo.innerHTML = htmlCargando('Cargando tu fichaje…');

  // Delegación: los botones se vuelven a dibujar después de cada fichaje.
  cuerpo.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-fichar]');
    if (btn && !btn.disabled) { fichar(btn, cuerpo); return; }
    const deshacer = e.target.closest('[data-deshacer-salida]');
    if (deshacer && !deshacer.disabled) deshacerSalida(deshacer, cuerpo);
  });

  // Calendario: navegación por mes, detalle del día y PDF.
  document.getElementById('fich-cal-nav').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mes]');
    if (!b) return;
    const destino = b.dataset.mes === 'hoy' ? mesDeFecha() : moverMes(cal.anio, cal.mes, Number(b.dataset.mes));
    cargarMes(destino.anio, destino.mes);
  });
  engancharDetalleDia(document.getElementById('fich-cal-contenido'), () => cal?.calendario);
  document.getElementById('fich-pdf').addEventListener('click', descargarPdf);
  cargarMes(anio, mes);

  try {
    const fila = await asistenciaProfModel.fichajeDelDia(profesionalId, hoyISO());
    cuerpo.innerHTML = renderFichaje({ fila });
  } catch (err) {
    console.error('Error cargando mi fichaje:', err);
    cuerpo.innerHTML = htmlError('No se pudo cargar tu fichaje. Revisá la conexión.');
  }
}

// Ficha la entrada o la salida (según el botón tocado).
async function fichar(btn, cuerpo) {
  const que = btn.dataset.fichar; // 'entrada' | 'salida'
  const textoOriginal = btn.textContent;
  // Mientras se ficha, ningún botón se puede tocar (evita doble toque).
  cuerpo.querySelectorAll('[data-fichar]').forEach(b => { b.disabled = true; });
  btn.textContent = 'Buscando tu ubicación…';
  let precision = null; // la del GPS en esta lectura (para el mensaje de error)
  try {
    const ubicacion = await obtenerUbicacion();
    const { lat, lng } = ubicacion;
    precision = ubicacion.precision;
    btn.textContent = 'Fichando…';
    const fila = await asistenciaProfModel.ficharConUbicacion(lat, lng, que);
    // Sin la hora de vuelta no se guardó nada: no se avisa "fichada".
    const hora = que === 'entrada' ? fila?.hora_entrada : fila?.hora_salida;
    if (!hora) throw new Error('fichar() no devolvió la hora');
    cuerpo.innerHTML = renderFichaje({ fila });
    refrescarMesActual();
    toast(que === 'entrada' ? `Entrada fichada a las ${String(hora).slice(0, 5)}.` : `Salida fichada a las ${String(hora).slice(0, 5)}.`);
  } catch (err) {
    console.error('Error fichando:', err);
    toast(esErrorDeUbicacion(err)
      ? mensajeErrorUbicacion(err)
      : conPrecision(mensajeError(err, 'No se pudo fichar. Probá de nuevo.'), precision), 'bad');
    // Se vuelve a pedir el estado real: por si cambió (lo cargó la
    // secretaría, o se fichó desde otro dispositivo).
    try {
      const fila = await asistenciaProfModel.fichajeDelDia(perfilActual()?.profesional_id, hoyISO());
      cuerpo.innerHTML = renderFichaje({ fila });
    } catch {
      btn.textContent = textoOriginal;
      btn.disabled = false;
    }
  }
}

// Deshace la salida de hoy (con confirmación). En el Inicio vuelve a
// aparecer el recordatorio de fichar la salida.
async function deshacerSalida(btn, cuerpo) {
  const ok = await confirmar({
    titulo: '¿Deshacer la salida?',
    mensaje: 'Se borra la hora de salida de hoy y vas a tener que volver a ficharla al irte.',
    textoOk: 'Sí, deshacer',
    textoCancelar: 'Volver',
  });
  if (!ok) return;
  btn.disabled = true;
  try {
    const fila = await asistenciaProfModel.deshacerSalida();
    cuerpo.innerHTML = renderFichaje({ fila });
    refrescarMesActual();
    toast('Salida deshecha. Acordate de ficharla al irte.');
  } catch (err) {
    console.error('Error deshaciendo la salida:', err);
    toast(mensajeError(err, 'No se pudo deshacer la salida. Probá de nuevo.'), 'bad');
    btn.disabled = false;
  }
}

// ---------------------------------------------------------------------
// MI ASISTENCIA (calendario del mes)
// ---------------------------------------------------------------------
async function cargarMes(anio, mes) {
  if (!cal) return;
  cal.anio = anio;
  cal.mes = mes;
  cal.calendario = null;
  document.getElementById('fich-mes-label').textContent = etiquetaMes(anio, mes);
  const caja = document.getElementById('fich-cal-contenido');
  caja.innerHTML = htmlCargando('Cargando tu asistencia…');

  const { desde, hasta } = rangoDelMes(anio, mes);
  try {
    const registros = await asistenciaProfModel.listarPorProfesionalRango(perfilActual()?.profesional_id, desde, hasta);
    // Guard anti-carrera: si ya se cambió de mes, se descarta.
    if (!cal || cal.anio !== anio || cal.mes !== mes) return;
    cal.calendario = armarCalendario({ anio, mes, registros });
    caja.innerHTML = renderCalendario(cal.calendario);
  } catch (err) {
    console.error('Error cargando mi asistencia:', err);
    caja.innerHTML = htmlError('No se pudo cargar tu asistencia de este mes.');
  }
}

// Después de fichar o deshacer, si se está mirando el mes de hoy, se
// vuelve a pedir para que el día de hoy se pinte con lo nuevo.
function refrescarMesActual() {
  const hoy = mesDeFecha();
  if (cal && cal.anio === hoy.anio && cal.mes === hoy.mes) cargarMes(hoy.anio, hoy.mes);
}

// Planilla del mes en PDF (la misma que descarga la secretaría).
async function descargarPdf() {
  if (!cal?.calendario) { toast('Esperá a que termine de cargar el mes.', 'bad'); return; }
  const btn = document.getElementById('fich-pdf');
  const textoPrevio = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Generando…';
  try {
    const persona = await profesionalModel.obtenerProfesional(perfilActual()?.profesional_id);
    const subtitulo = [persona?.profesion, persona?.matricula ? `Mat. ${persona.matricula}` : null].filter(Boolean).join(' · ');
    await generarPlanillaAsistencia({ persona: persona || {}, tipo: 'profesional', subtitulo: subtitulo || 'Profesional', calendario: cal.calendario });
    toast('Planilla descargada.');
  } catch (err) {
    console.error('Error generando mi planilla de asistencia:', err);
    toast('No se pudo generar el PDF. Probá de nuevo.', 'bad');
  } finally {
    btn.disabled = false;
    btn.textContent = textoPrevio;
  }
}

// Los errores del navegador traen un código numérico (1, 2, 3); los de
// la base, un código de texto ('P0001', '42501'…).
function esErrorDeUbicacion(err) {
  return typeof err?.code === 'number' || err?.code === 'NO_SOPORTADO';
}
