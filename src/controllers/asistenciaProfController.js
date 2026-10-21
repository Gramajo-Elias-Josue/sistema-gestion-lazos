// =====================================================================
// CONTROLADOR: Asistencia de profesionales (fichaje)
// ---------------------------------------------------------------------
// CAPA CONTROLADOR. Renderiza dentro del panel "Profesionales" de la
// sección Asistencia. Una fila por profesional con su estado del día y
// los horarios de entrada / salida; se guarda fila por fila (upsert).
// =====================================================================

import * as profesionalModel from '../models/profesionalModel.js';
import * as asistenciaProfModel from '../models/asistenciaProfesionalModel.js';
import { renderEstructura, renderFilas, filaHtml } from '../views/asistenciaProfView.js';
import { abrirCalendarioProfesional } from './calendarioAsistenciaController.js';
import { hoyISO, sumarDias, nombreDia, ahoraHHMM, horaAMinutos } from '../utils/fechas.js';
import { horarioDe } from '../utils/turnosCentro.js';
import { htmlCargando, htmlError, toast, confirmar } from '../utils/ui.js';
import { validarFichajeProfesional } from '../utils/validacion.js';
import { mensajeError } from '../utils/errores.js';

let fechaActual = hoyISO();
let profesionales = [];
let fichajes = {};       // { profesional_id: fichaje }
let bloqueado = false;   // true si la fecha elegida es futura

// Contexto temporal que necesita la vista (prefill y deshabilitados).
function ctx() {
  return { bloqueado, esHoy: fechaActual === hoyISO(), ahora: ahoraHHMM() };
}

// Arranca el panel de fichaje de profesionales (lo llama el shell de
// asistencia al activar la pestaña por primera vez).
export async function iniciarAsistenciaProf() {
  fechaActual = hoyISO();
  const cont = document.getElementById('asis-pane-prof');
  cont.innerHTML = renderEstructura(fechaActual);

  document.getElementById('apf-prev').addEventListener('click', () => irAFecha(sumarDias(fechaActual, -1)));
  document.getElementById('apf-next').addEventListener('click', () => irAFecha(sumarDias(fechaActual, 1)));
  document.getElementById('apf-hoy').addEventListener('click', () => irAFecha(hoyISO()));
  document.getElementById('apf-fecha').addEventListener('change', (e) => { if (e.target.value) irAFecha(e.target.value); });

  // Delegación: botón "Guardar" de cada fila (sobrevive al re-render de filas).
  document.getElementById('apf-body').addEventListener('click', (e) => {
    const b = e.target.closest('.apf-guardar');
    if (b && !b.disabled) {
      guardar(b.dataset.prof);
      return;
    }
    // Tocar el nombre abre la ficha grande: el calendario mensual de
    // fichajes de ese profesional, con opción de descargarlo en PDF.
    const ficha = e.target.closest('[data-ficha-prof]');
    if (ficha) {
      const prof = profesionales.find(p => String(p.id) === String(ficha.dataset.fichaProf));
      if (prof) abrirCalendarioProfesional(prof);
    }
  });

  // Al cambiar el estado de una fila: las horas solo aplican a "presente".
  // Ausente / licencia -> se deshabilitan y limpian. Al volver a presente
  // -> se re-sugiere la hora actual en la entrada (si está vacía).
  document.getElementById('apf-body').addEventListener('change', (e) => {
    const sel = e.target.closest('.apf-estado');
    if (!sel) return;
    const fila = sel.closest('.asis-row');
    const conHoras = sel.value === 'presente';
    const ent = fila.querySelector('.apf-entrada');
    const sal = fila.querySelector('.apf-salida');
    ent.disabled = sal.disabled = !conHoras || bloqueado;
    if (!conHoras) {
      ent.value = ''; sal.value = '';
    } else if (!ent.value && fechaActual === hoyISO()) {
      ent.value = ahoraHHMM();  // re-sugerencia al reactivar presente
    }
  });

  await cargarFecha(fechaActual);
}

function irAFecha(fecha) {
  fechaActual = fecha;
  document.getElementById('apf-fecha').value = fecha;
  document.getElementById('apf-dia').textContent = nombreDia(fecha);
  cargarFecha(fecha);
}

async function cargarFecha(fecha) {
  bloqueado = fecha > hoyISO(); // comparación de strings ISO (yyyy-mm-dd)
  const caja = document.getElementById('apf-body');
  caja.innerHTML = htmlCargando('Cargando profesionales…');
  fichajes = {};
  try {
    const [profs, regs] = await Promise.all([
      profesionalModel.listarProfesionales({ soloActivos: true }),
      asistenciaProfModel.listarPorFecha(fecha),
    ]);
    // Guard anti-carrera: si ya se cambió de fecha mientras se pedían estos
    // datos, descartamos esta respuesta (misma protección que en la planilla
    // de pacientes y en la agenda de turnos).
    if (fecha !== fechaActual) return;
    profesionales = profs;
    regs.forEach(r => { fichajes[r.profesional_id] = r; });
    caja.innerHTML = renderFilas(profesionales, fichajes, ctx());
    recalcularStats();
  } catch (err) {
    console.error('Error cargando fichajes:', err);
    caja.innerHTML = htmlError('No se pudo cargar el fichaje. Revisá la conexión.');
  }
}

// Recalcula los contadores del día: presentes / ausentes / licencia /
// sin fichar, y el % de presentes sobre el total de profesionales activos.
function recalcularStats() {
  const total = profesionales.length;
  let pres = 0, aus = 0, lic = 0;
  profesionales.forEach(p => {
    const f = fichajes[p.id];
    if (!f) return;                       // sin fichar
    if (f.estado === 'presente') pres++;
    else if (f.estado === 'licencia') lic++;
    else aus++;                           // ausente
  });
  const sf = total - pres - aus - lic;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('apf-pres', pres);
  set('apf-aus', aus);
  set('apf-lic', lic);
  set('apf-sf', sf);
  set('apf-pct', (total ? Math.round((pres / total) * 100) : 0) + '%');
}

// Si las horas fichadas difieren mucho (>1h) del horario habitual del
// perfil, pide confirmación (el profesional pudo venir en otro horario
// real, pero también puede ser un error de tipeo). Devuelve true si se
// puede seguir.
async function confirmarFueraDeHorario(prof, entrada, salida) {
  const { entrada: habEnt, salida: habSal } = horarioDe(prof);
  if (!habEnt && !habSal) return true; // sin horario habitual: nada que comparar

  const TOLERANCIA = 60; // minutos
  const difEnt = (entrada && habEnt) ? Math.abs(horaAMinutos(entrada) - horaAMinutos(habEnt)) : 0;
  const difSal = (salida && habSal) ? Math.abs(horaAMinutos(salida) - horaAMinutos(habSal)) : 0;
  if (difEnt <= TOLERANCIA && difSal <= TOLERANCIA) return true;

  return confirmar({
    titulo: 'Fichaje fuera de horario',
    mensaje: `${prof.nombre_completo} suele trabajar de ${habEnt || '—'} a ${habSal || '—'}. Estás cargando ${entrada || '—'}${salida ? ` a ${salida}` : ''}. ¿Es correcto?`,
    textoOk: 'Sí, es correcto',
    textoCancelar: 'Volver',
  });
}

// Guarda el fichaje de una fila (estado + entrada + salida).
async function guardar(profId) {
  if (bloqueado) return; // fecha futura: no se ficha
  const fila = document.querySelector(`.asis-row[data-prof="${profId}"]`);
  if (!fila) return;
  const estado = fila.querySelector('.apf-estado').value;
  // Las horas solo aplican a "presente" (ausente / licencia van sin horas).
  const conHoras = estado === 'presente';
  const entrada = conHoras ? (fila.querySelector('.apf-entrada').value || null) : null;
  const salida = conHoras ? (fila.querySelector('.apf-salida').value || null) : null;

  // Reglas duras: salida sin entrada, salida < entrada y, si es HOY, horas
  // que todavía no ocurrieron (no se ficha el futuro). "Presente" sin horas
  // es válido: confirma que asiste hoy; las horas se cargan cuando ocurren.
  const v = validarFichajeProfesional(
    { estado, hora_entrada: entrada, hora_salida: salida },
    { esHoy: fechaActual === hoyISO(), ahora: ahoraHHMM() }
  );
  if (!v.ok) { toast(v.mensaje, 'bad'); return; }

  // Regla blanda: muy lejos del horario habitual -> confirmar con nombre.
  const prof = profesionales.find(p => String(p.id) === String(profId));
  if (conHoras && prof && !(await confirmarFueraDeHorario(prof, entrada, salida))) return;

  const btn = fila.querySelector('.apf-guardar');
  btn.disabled = true;
  btn.textContent = '…';
  try {
    const saved = await asistenciaProfModel.guardarFichaje({
      profesionalId: profId, fecha: fechaActual,
      horaEntrada: entrada, horaSalida: salida, estado,
    });
    fichajes[profId] = saved;
    fila.outerHTML = filaHtml(prof, saved, ctx()); // tilde verde
    recalcularStats();
    toast('Fichaje guardado.');
  } catch (err) {
    console.error('Error guardando fichaje:', err);
    btn.disabled = false;
    btn.textContent = 'Guardar';
    toast(mensajeError(err, 'No se pudo guardar el fichaje. Probá de nuevo.'), 'bad');
  }
}
