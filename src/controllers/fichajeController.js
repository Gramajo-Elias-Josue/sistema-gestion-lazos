// =====================================================================
// CONTROLADOR: Mi fichaje (solo el profesional)
// ---------------------------------------------------------------------
// CAPA CONTROLADOR. Cada botón (entrada / salida) pide la ubicación al
// navegador y se la manda a la base junto con QUÉ se ficha. La base
// (función fichar(), script 16) decide: que esté en el centro, que le
// toque fichar eso, y pone la hora. Acá solo se redibuja con lo que vuelve.
// =====================================================================

import * as asistenciaProfModel from '../models/asistenciaProfesionalModel.js';
import { renderFichaje } from '../views/fichajeView.js';
import { htmlCargando, htmlError, toast } from '../utils/ui.js';
import { mensajeError } from '../utils/errores.js';
import { obtenerUbicacion, mensajeErrorUbicacion } from '../utils/ubicacion.js';
import { hoyISO } from '../utils/fechas.js';
import { perfilActual } from '../sesion.js';

// Punto de entrada de la sección (lo llama el router).
export async function iniciarFichaje() {
  const caja = document.getElementById('v-fichaje');
  const profesionalId = perfilActual()?.profesional_id;
  if (!profesionalId) {
    caja.innerHTML = `<div class="state">Tu usuario no está vinculado a un profesional. Avisale a la dirección.</div>`;
    return;
  }

  caja.innerHTML = `<div class="panel"><div class="panel-b" id="fich-cuerpo"></div></div>`;
  const cuerpo = document.getElementById('fich-cuerpo');
  cuerpo.innerHTML = htmlCargando('Cargando tu fichaje…');

  // Delegación: los botones se vuelven a dibujar después de cada fichaje.
  cuerpo.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-fichar]');
    if (btn && !btn.disabled) fichar(btn, cuerpo);
  });

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
  try {
    const { lat, lng } = await obtenerUbicacion();
    btn.textContent = 'Fichando…';
    const fila = await asistenciaProfModel.ficharConUbicacion(lat, lng, que);
    // Sin la hora de vuelta no se guardó nada: no se avisa "fichada".
    const hora = que === 'entrada' ? fila?.hora_entrada : fila?.hora_salida;
    if (!hora) throw new Error('fichar() no devolvió la hora');
    cuerpo.innerHTML = renderFichaje({ fila });
    toast(que === 'entrada' ? `Entrada fichada a las ${String(hora).slice(0, 5)}.` : `Salida fichada a las ${String(hora).slice(0, 5)}.`);
  } catch (err) {
    console.error('Error fichando:', err);
    toast(esErrorDeUbicacion(err) ? mensajeErrorUbicacion(err) : mensajeError(err, 'No se pudo fichar. Probá de nuevo.'), 'bad');
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

// Los errores del navegador traen un código numérico (1, 2, 3); los de
// la base, un código de texto ('P0001', '42501'…).
function esErrorDeUbicacion(err) {
  return typeof err?.code === 'number' || err?.code === 'NO_SOPORTADO';
}
