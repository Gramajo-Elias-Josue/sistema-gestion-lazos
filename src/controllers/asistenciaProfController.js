// =====================================================================
// CONTROLADOR: Asistencia de profesionales (fichaje)
// ---------------------------------------------------------------------
// CAPA CONTROLADOR. Renderiza dentro del panel "Profesionales" de la
// sección Asistencia. Una fila por profesional con su estado del día y
// los horarios de entrada / salida; se guarda fila por fila (upsert).
// =====================================================================

import * as profesionalModel from '../models/profesionalModel.js';
import * as asistenciaProfModel from '../models/asistenciaProfesionalModel.js';
import { renderEstructura, renderFilas, filaHtml, renderPestanasTurnoAsistencia, tramoEnTurno } from '../views/asistenciaProfView.js';
import { abrirCalendarioProfesional } from './calendarioAsistenciaController.js';
import { hoyISO, sumarDias, nombreDia, ahoraHHMM, horaAMinutos } from '../utils/fechas.js';
import { horarioDe, turnoSegunHora } from '../utils/turnosCentro.js';
import { htmlCargando, htmlError, toast, confirmar } from '../utils/ui.js';
import { validarFichajeProfesional, validarTramosFichaje } from '../utils/validacion.js';
import { esDobleTurno } from '../utils/tramosFichaje.js';
import { mensajeError } from '../utils/errores.js';

let fechaActual = hoyISO();
let profesionales = [];
let fichajes = {};       // { profesional_id: fichaje }
let bloqueado = false;   // true si la fecha elegida es futura
let turno = 'manana';    // pestaña visible: 'manana' | 'tarde'

// Contexto que necesita la vista (prefill, deshabilitados y la pestaña).
function ctx() {
  return { bloqueado, esHoy: fechaActual === hoyISO(), ahora: ahoraHHMM(), turno };
}

// Pinta las pestañas y las filas del turno visible.
function pintarFilas() {
  document.getElementById('apf-turnos').innerHTML = renderPestanasTurnoAsistencia(profesionales, turno);
  document.getElementById('apf-body').innerHTML = renderFilas(profesionales, fichajes, ctx());
}

// Arranca el panel de fichaje de profesionales (lo llama el shell de
// asistencia al activar la pestaña por primera vez).
export async function iniciarAsistenciaProf() {
  fechaActual = hoyISO();
  // Abre en el turno en curso: a la tarde nadie busca la mañana.
  turno = turnoSegunHora(ahoraHHMM());
  const cont = document.getElementById('asis-pane-prof');
  cont.innerHTML = renderEstructura(fechaActual);

  // Pestañas Turno mañana / Turno tarde.
  document.getElementById('apf-turnos').addEventListener('click', (e) => {
    const b = e.target.closest('[data-turno]');
    if (!b || b.dataset.turno === turno) return;
    turno = b.dataset.turno;
    pintarFilas();
  });

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
    // Todas las horas de la fila (uno o dos tramos).
    const inputs = fila.querySelectorAll('.apf-horas input');
    inputs.forEach(i => { i.disabled = !conHoras || bloqueado; });
    const ent = fila.querySelector('.apf-horas[data-tramo="1"] .apf-entrada');
    if (!conHoras) {
      inputs.forEach(i => { i.value = ''; });
    } else if (ent && !ent.value && fechaActual === hoyISO()) {
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
    pintarFilas();
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

// Si las horas fichadas difieren mucho (>1h) del horario habitual,
// pide confirmación (el profesional pudo venir en otro horario real,
// pero también puede ser un error de tipeo). `tramos` = [{ habitual:
// { entrada, salida }, entrada, salida }]: uno, o dos (mañana y tarde).
// Devuelve true si se puede seguir.
async function confirmarFueraDeHorario(prof, tramos) {
  const TOLERANCIA = 60; // minutos
  const lejos = (hora, habitual) => hora && habitual && Math.abs(horaAMinutos(hora) - horaAMinutos(habitual)) > TOLERANCIA;
  const fuera = tramos.filter(t => lejos(t.entrada, t.habitual.entrada) || lejos(t.salida, t.habitual.salida));
  if (!fuera.length) return true;

  const habitual = tramos.map(t => `${t.habitual.entrada || '—'} a ${t.habitual.salida || '—'}`).join(' y ');
  const cargado = tramos.filter(t => t.entrada || t.salida)
    .map(t => `${t.entrada || '—'}${t.salida ? ` a ${t.salida}` : ''}`).join(' y ');
  return confirmar({
    titulo: 'Fichaje fuera de horario',
    mensaje: `${prof.nombre_completo} suele trabajar de ${habitual}. Estás cargando ${cargado || '—'}. ¿Es correcto?`,
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
  const prof = profesionales.find(p => String(p.id) === String(profId));
  // La fila muestra UN tramo: el del turno de la pestaña (1 = mañana o su
  // único turno; 2 = la tarde de quien hace los dos).
  const caja = fila.querySelector('.apf-horas');
  const tramo = Number(caja?.dataset.tramo) || 1;
  const entrada = conHoras ? (caja.querySelector('.apf-entrada').value || null) : null;
  const salida = conHoras ? (caja.querySelector('.apf-salida').value || null) : null;

  // Reglas duras: salida sin entrada, salida < entrada y, si es HOY, horas
  // que todavía no ocurrieron (no se ficha el futuro). "Presente" sin horas
  // es válido: confirma que asiste hoy; las horas se cargan cuando ocurren.
  // Con doble turno, además, la tarde va después de la mañana (se compara
  // con lo que ya está guardado del otro tramo).
  const ctxHoy = { esHoy: fechaActual === hoyISO(), ahora: ahoraHHMM() };
  const guardado = fichajes[profId] || {};
  const hhmm = (t) => (t ? String(t).slice(0, 5) : null);
  const actual = { estado, hora_entrada: entrada, hora_salida: salida };
  const doble = prof && esDobleTurno(prof);
  const v = !doble
    ? validarFichajeProfesional(actual, ctxHoy)
    : tramo === 1
      ? validarTramosFichaje(actual, { estado, hora_entrada: hhmm(guardado.hora_entrada_2), hora_salida: hhmm(guardado.hora_salida_2) }, ctxHoy)
      : validarTramosFichaje({ estado, hora_entrada: hhmm(guardado.hora_entrada), hora_salida: hhmm(guardado.hora_salida) }, actual, ctxHoy);
  if (!v.ok) { toast(v.mensaje, 'bad'); return; }

  // Regla blanda: muy lejos del horario habitual -> confirmar con nombre.
  if (conHoras && prof) {
    const { turno: suTurno } = tramoEnTurno(prof, turno);
    const habitual = suTurno ? { entrada: suTurno.desde, salida: suTurno.hasta } : horarioDe(prof);
    if (!(await confirmarFueraDeHorario(prof, [{ habitual, entrada, salida }]))) return;
  }

  // Se guardan solo las horas de este tramo (el otro no se toca). Si el día
  // no es "presente", el día entero va sin horas: se borran las de los dos.
  const horas = !conHoras
    ? { horaEntrada: null, horaSalida: null, ...(doble ? { horaEntrada2: null, horaSalida2: null } : {}) }
    : tramo === 2
      ? { horaEntrada2: entrada, horaSalida2: salida }
      : { horaEntrada: entrada, horaSalida: salida };

  const btn = fila.querySelector('.apf-guardar');
  btn.disabled = true;
  btn.textContent = '…';
  try {
    const saved = await asistenciaProfModel.guardarFichaje({
      profesionalId: profId, fecha: fechaActual, estado, ...horas,
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
