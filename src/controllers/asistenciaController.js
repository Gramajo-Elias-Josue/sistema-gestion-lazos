// =====================================================================
// CONTROLADOR: Asistencia
// ---------------------------------------------------------------------
// CAPA CONTROLADOR. Maneja la planilla diaria de asistencia:
//   - Navegar entre fechas (anterior / siguiente / hoy / calendario).
//   - Marcar a cada paciente: se guarda solo y la fila queda BLOQUEADA
//     con un tilde verde. Para cambiarla hay que tocar el lápiz (✎),
//     cuya única función es reabrir esa fila para editarla.
//   - Al marcar "C/ aviso" se abre un modal para aclarar el motivo.
//   - "Todos presentes": completa de una a los que faltan marcar.
//   - Estadísticas en vivo y porcentaje mensual por paciente.
// Las fechas futuras se muestran pero no se pueden editar.
// =====================================================================

import * as pacienteModel from '../models/pacienteModel.js';
import * as asistenciaModel from '../models/asistenciaModel.js';
import {
  renderEstructura, renderFilas, filaHtml, renderAvisoFuturo, renderModalAviso,
} from '../views/asistenciaView.js';
import { iniciarAsistenciaProf } from './asistenciaProfController.js';
import { iniciarControlHoras } from './controlHorasController.js';
import { perfilActual } from '../sesion.js';
import { abrirCalendarioPaciente } from './calendarioAsistenciaController.js';
import { htmlCargando, htmlError, toast } from '../utils/ui.js';
import { hoyISO, sumarDias, rangoMes, nombreDia } from '../utils/fechas.js';
import { armarCalendario, mesDeFecha, semanaDeFecha, semanasDelMes } from '../utils/calendario.js';

// Estado en memoria de la vista mientras está abierta.
let pacientes = [];      // pacientes activos cargados
let seleccion = {};      // { id: estado } marcado en la fecha actual
let notas = {};          // { id: observación } del día
let guardado = {};       // { id: true } si la marca está confirmada en la base
let editando = {};       // { id: true } si la fila está reabierta para cambiar
let mesRegistros = {};   // { id: [ {fecha, estado} ] } asistencias del mes
let calendarios = {};    // { id: calendario del mes } armado desde mesRegistros
let mesVisible = null;   // { anio, mes } del mes que se está mostrando
let fechaActual = hoyISO();
let bloqueado = false;   // true si la fecha elegida es futura
let profIniciado = false; // true si ya se cargó la pestaña de profesionales
let ctlIniciado = false;  // true si ya se cargó la pestaña de control de horas
let semanaVisible = 0;   // índice de semana que se ve en la tira de cada fila (todas comparten el mismo mes)

// Reúne el estado de la pantalla para pasárselo a la vista.
function vista() {
  return { seleccion, notas, calendarios, guardado, editando, bloqueado, fecha: fechaActual, semanaVisible };
}

// Punto de entrada de la sección Asistencia (lo llama el router).
export async function iniciarAsistencia() {
  const contenedor = document.getElementById('v-asistencia');
  // Pestañas: Pacientes (planilla existente), Profesionales (planilla de
  // la secretaría) y, SOLO para la dirección, Control de horas (compara
  // esa planilla con el fichaje propio de cada profesional, para los
  // sueldos). Las dos últimas se inicializan la primera vez que se abren.
  const esDireccion = perfilActual()?.rol === 'director';
  contenedor.innerHTML = `
    <div class="tabs" id="asis-tabs">
      <button class="tab active" data-tab="pac">Pacientes</button>
      <button class="tab" data-tab="prof">Profesionales</button>
      ${esDireccion ? '<button class="tab" data-tab="ctl" title="Solo la dirección">Control de horas</button>' : ''}
    </div>
    <div id="asis-pane-pac"></div>
    <div id="asis-pane-prof" class="hidden"></div>
    ${esDireccion ? '<div id="asis-pane-ctl" class="hidden"></div>' : ''}`;
  document.getElementById('asis-pane-pac').innerHTML = renderEstructura(hoyISO());

  profIniciado = false;
  ctlIniciado = false;
  document.getElementById('asis-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('.tab');
    if (b) cambiarTab(b.dataset.tab);
  });

  // --- Navegación de fecha ---
  document.getElementById('asis-fecha').addEventListener('change', (e) => {
    if (e.target.value) cargarFecha(e.target.value);
  });
  document.getElementById('asis-prev').addEventListener('click', () => cargarFecha(sumarDias(fechaActual, -1)));
  document.getElementById('asis-sig').addEventListener('click', () => cargarFecha(sumarDias(fechaActual, 1)));
  document.getElementById('asis-hoy').addEventListener('click', () => cargarFecha(hoyISO()));

  // --- Acciones rápidas ---
  document.getElementById('asis-todos').addEventListener('click', marcarTodosPresentes);
  document.getElementById('asis-buscar').addEventListener('input', aplicarFiltro);

  // Un solo listener para todas las filas (delegación de eventos):
  // sobrevive a los re-render porque está en el contenedor, no en los botones.
  document.getElementById('asisbody').addEventListener('click', (e) => {
    const marca = e.target.closest('.seg button');
    if (marca && !marca.disabled) {
      marcar(marca.dataset.paciente, marca.dataset.estado);
      return;
    }
    const lapiz = e.target.closest('.btn-editar');
    if (lapiz && !lapiz.disabled) {
      editarFila(lapiz.dataset.editar);
      return;
    }
    // Flechas de la tira: mueven la semana visible en TODAS las filas
    // (comparten el mismo mes), sin volver a pedir datos a la base.
    const semNav = e.target.closest('.sem-nav');
    if (semNav && !semNav.disabled) {
      cambiarSemana(semNav.hasAttribute('data-semana-prev') ? -1 : 1);
      return;
    }
    // Tocar el nombre abre la ficha grande: el calendario mensual de
    // asistencia de ese paciente, con opción de descargarlo en PDF.
    const ficha = e.target.closest('[data-ficha]');
    if (ficha) {
      const paciente = pacientes.find(p => String(p.id) === String(ficha.dataset.ficha));
      if (paciente) abrirCalendarioPaciente(paciente);
    }
  });

  await cargarFecha(hoyISO());
}

// Cambia entre la pestaña de pacientes y la de profesionales.
// La de profesionales se inicializa de forma perezosa (solo la 1ª vez).
function cambiarTab(tab) {
  document.querySelectorAll('#asis-tabs .tab').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('asis-pane-pac').classList.toggle('hidden', tab !== 'pac');
  document.getElementById('asis-pane-prof').classList.toggle('hidden', tab !== 'prof');
  document.getElementById('asis-pane-ctl')?.classList.toggle('hidden', tab !== 'ctl');
  if (tab === 'prof' && !profIniciado) {
    profIniciado = true;
    iniciarAsistenciaProf();
  }
  if (tab === 'ctl' && !ctlIniciado) {
    ctlIniciado = true;
    iniciarControlHoras();
  }
}

// ---------------------------------------------------------------------
// CARGA DE UNA FECHA
// ---------------------------------------------------------------------
// Trae en paralelo los pacientes activos, lo ya marcado ese día y las
// asistencias del mes (para el porcentaje por paciente).
async function cargarFecha(fecha) {
  fechaActual = fecha;
  bloqueado = fecha > hoyISO(); // comparación de strings ISO (yyyy-mm-dd)

  document.getElementById('asis-fecha').value = fecha;
  document.getElementById('asis-dia').textContent = nombreDia(fecha);
  document.getElementById('asis-aviso').innerHTML = bloqueado ? renderAvisoFuturo() : '';
  document.getElementById('asis-todos').disabled = bloqueado;

  const caja = document.getElementById('asisbody');
  caja.innerHTML = htmlCargando('Cargando pacientes…');
  seleccion = {}; notas = {}; guardado = {}; editando = {};
  mesRegistros = {}; calendarios = {};
  mesVisible = mesDeFecha(fecha);
  semanaVisible = semanaDeFecha(mesVisible.anio, mesVisible.mes, fecha);

  try {
    const rango = rangoMes(fecha);
    const [activos, registradas, delMes] = await Promise.all([
      pacienteModel.listarPacientes({ soloActivos: true }),
      asistenciaModel.listarAsistenciasPorFecha(fecha),
      asistenciaModel.listarAsistenciasRango(rango.desde, rango.hasta),
    ]);
    // Guard anti-carrera: si el usuario ya cambió de fecha mientras se pedían
    // estos datos, descartamos esta respuesta (llegó tarde y sobreescribiría
    // el estado/DOM con una fecha que ya no es la visible).
    if (fecha !== fechaActual) return;
    pacientes = activos;
    // Lo que viene de la base ya está guardado: tilde verde y fila bloqueada.
    registradas.forEach(a => {
      seleccion[a.paciente_id] = a.estado;
      guardado[a.paciente_id] = true;
      if (a.observaciones) notas[a.paciente_id] = a.observaciones;
    });
    // Un calendario del mes por paciente: alimenta la tira de la fila y
    // el porcentaje mensual (misma lógica que la ficha grande).
    delMes.forEach(r => { (mesRegistros[r.paciente_id] ??= []).push(r); });
    pacientes.forEach(p => rearmarMes(p.id));

    caja.innerHTML = renderFilas(pacientes, vista());
    aplicarFiltro();  // respeta lo escrito en el buscador al cambiar de día
    recalcular();
  } catch (err) {
    console.error('Error cargando asistencia:', err);
    caja.innerHTML = htmlError('No se pudo cargar la asistencia. Revisá la conexión.');
  }
}

// Rearma el calendario del mes de un paciente a partir de sus registros.
function rearmarMes(pacienteId) {
  if (!mesVisible) return;
  calendarios[pacienteId] = armarCalendario({
    anio: mesVisible.anio,
    mes: mesVisible.mes,
    registros: mesRegistros[pacienteId] || [],
  });
}

// Anota (o corrige) la marca del día en el mes que se está mostrando,
// para que la tira de la fila se actualice sin volver a consultar.
function anotarEnMes(pacienteId, fecha, estado) {
  const regs = (mesRegistros[pacienteId] ??= []);
  const i = regs.findIndex(r => r.fecha === fecha);
  if (i >= 0) regs[i] = { ...regs[i], estado };
  else regs.push({ fecha, estado });
  rearmarMes(pacienteId);
}

// ---------------------------------------------------------------------
// MARCAR (guarda y bloquea la fila)
// ---------------------------------------------------------------------
function marcar(pacienteId, estado) {
  if (bloqueado) return;

  // "C/ aviso" EXIGE justificación: se abre el modal y la asistencia
  // recién se guarda cuando hay un motivo escrito. Si se cancela o se
  // deja vacío, no se guarda nada (ver pedirAviso).
  if (estado === 'ausente_con_aviso') {
    pedirAviso(pacienteId);
    return;
  }

  // Los demás estados se guardan al instante. Se reenvía la observación
  // existente para que el upsert no la pise.
  guardarMarca(pacienteId, estado, notas[pacienteId] ?? null);
}

// Guarda una marca (upsert) con actualización optimista y reversión si
// falla. Devuelve true/false según haya podido guardar.
async function guardarMarca(pacienteId, estado, observaciones) {
  const prevSel = seleccion[pacienteId] || null;
  const prevGuardado = !!guardado[pacienteId];

  // Optimista: dejamos la marca elegida y cerramos la edición.
  seleccion[pacienteId] = estado;
  editando[pacienteId] = false;
  refrescarFila(pacienteId);
  recalcular();

  try {
    await asistenciaModel.guardarAsistencia({
      pacienteId, fecha: fechaActual, estado, observaciones,
    });
    guardado[pacienteId] = true;  // ahora sí: tilde verde + fila bloqueada
    if (observaciones != null) notas[pacienteId] = observaciones;
    anotarEnMes(pacienteId, fechaActual, estado); // la tira del mes se pone al día
    refrescarFila(pacienteId);
    return true;
  } catch (err) {
    console.error('Error guardando asistencia:', err);
    // Si falla, revertimos al estado anterior.
    if (prevSel) seleccion[pacienteId] = prevSel; else delete seleccion[pacienteId];
    guardado[pacienteId] = prevGuardado;
    refrescarFila(pacienteId);
    recalcular();
    toast('No se pudo guardar la asistencia. Probá de nuevo.', 'bad');
    return false;
  }
}

// ---------------------------------------------------------------------
// EDITAR (lápiz): reabre una fila ya guardada para cambiar su marca
// ---------------------------------------------------------------------
function editarFila(pacienteId) {
  if (bloqueado || !guardado[pacienteId]) return;
  editando[pacienteId] = true;   // desbloquea los botones de esa fila
  refrescarFila(pacienteId);
}

// ---------------------------------------------------------------------
// SEMANA VISIBLE (flechas de la tira mensual de cada fila)
// ---------------------------------------------------------------------
// Mueve la semana n posiciones sin salirse del mes que se está mostrando.
// Los datos del mes ya están en memoria (calendarios): no hace falta
// volver a pedirlos, solo re-renderizar con el nuevo índice.
function cambiarSemana(pasos) {
  if (!mesVisible) return;
  const total = semanasDelMes(mesVisible.anio, mesVisible.mes);
  const siguiente = semanaVisible + pasos;
  if (siguiente < 0 || siguiente >= total) return;
  semanaVisible = siguiente;
  refrescarBody();
}

// ---------------------------------------------------------------------
// TODOS PRESENTES (acción masiva)
// ---------------------------------------------------------------------
// Marca como presentes SOLO a los pacientes sin marca; lo ya marcado
// (ausencias, avisos) se respeta. Después se corrigen las excepciones.
async function marcarTodosPresentes() {
  if (bloqueado) return;
  const sinMarca = pacientes.filter(p => !seleccion[p.id]);
  if (!sinMarca.length) {
    toast('Ya está tomada la asistencia de todos.');
    return;
  }

  sinMarca.forEach(p => { seleccion[p.id] = 'presente'; editando[p.id] = false; });
  refrescarBody();
  recalcular();

  try {
    await asistenciaModel.guardarAsistencias(
      sinMarca.map(p => ({ pacienteId: p.id, fecha: fechaActual, estado: 'presente' }))
    );
    sinMarca.forEach(p => {
      guardado[p.id] = true;
      anotarEnMes(p.id, fechaActual, 'presente');
    });
    refrescarBody();
    toast(sinMarca.length === 1 ? 'Listo, 1 paciente marcado presente.' : `Listo, ${sinMarca.length} pacientes marcados presentes.`);
  } catch (err) {
    console.error('Error en marcado masivo:', err);
    sinMarca.forEach(p => { delete seleccion[p.id]; });
    refrescarBody();
    recalcular();
    toast('No se pudo marcar a todos. Probá de nuevo.', 'bad');
  }
}

// ---------------------------------------------------------------------
// AVISO DE AUSENCIA (modal al marcar "C/ aviso")
// ---------------------------------------------------------------------
// Pide el motivo del aviso ANTES de guardar. Mientras el modal está
// abierto, la fila muestra "C/ aviso" en gris (sin guardar). La marca
// se guarda solo si se escribe un motivo; si se cancela o queda vacío,
// se vuelve al estado anterior sin tocar la base.
function pedirAviso(pacienteId) {
  const paciente = pacientes.find(p => String(p.id) === String(pacienteId));
  if (!paciente) return;

  // Estado previo, para poder revertir si se cancela.
  const previo = {
    sel: seleccion[pacienteId] || null,
    guardado: !!guardado[pacienteId],
    nota: notas[pacienteId] || null,
    editando: !!editando[pacienteId],
  };

  // Vista optimista: "C/ aviso" resaltado pero SIN guardar (tilde gris).
  seleccion[pacienteId] = 'ausente_con_aviso';
  guardado[pacienteId] = false;
  editando[pacienteId] = true;
  refrescarFila(pacienteId);
  recalcular();

  document.body.insertAdjacentHTML('beforeend', renderModalAviso(paciente, previo.nota));
  const overlay = document.getElementById('overlay-nota');
  const form = document.getElementById('form-nota');

  // Cancelar / cerrar: NO se guarda; se vuelve al estado anterior.
  const cancelar = () => {
    overlay.remove();
    if (previo.sel) seleccion[pacienteId] = previo.sel; else delete seleccion[pacienteId];
    guardado[pacienteId] = previo.guardado;
    if (previo.nota) notas[pacienteId] = previo.nota; else delete notas[pacienteId];
    editando[pacienteId] = previo.editando;
    refrescarFila(pacienteId);
    recalcular();
  };
  overlay.querySelectorAll('[data-cerrar]').forEach(b => b.addEventListener('click', cancelar));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cancelar(); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const texto = new FormData(form).get('observaciones').trim();

    // VALIDACIÓN: sin motivo no se guarda la asistencia. Se muestra el
    // aviso dentro del modal y se mantiene abierto para completarlo.
    if (!texto) {
      document.getElementById('nota-error').style.display = 'block';
      form.querySelector('textarea').focus();
      return;
    }

    const btn = document.getElementById('btn-guardar-nota');
    btn.disabled = true;
    btn.textContent = 'Guardando…';

    // Recién acá se guarda la marca, con el motivo como observación.
    const ok = await guardarMarca(pacienteId, 'ausente_con_aviso', texto);
    if (ok) {
      overlay.remove();
    } else {
      // guardarMarca ya avisó del error; reactivamos el botón para reintentar.
      btn.disabled = false;
      btn.textContent = 'Guardar aviso';
    }
  });
}

// ---------------------------------------------------------------------
// RE-RENDER Y ESTADÍSTICAS
// ---------------------------------------------------------------------
// Re-renderiza UNA fila (tras marcar, editar o guardar) sin rehacer todo.
function refrescarFila(pacienteId) {
  const fila = document.querySelector(`.asis-row[data-fila="${pacienteId}"]`);
  if (!fila) return;
  const paciente = pacientes.find(p => String(p.id) === String(pacienteId));
  if (!paciente) return;
  fila.outerHTML = filaHtml(paciente, vista());
  aplicarFiltro();  // la fila nueva nace visible; respeta el buscador activo
}

// Re-renderiza TODAS las filas (tras el marcado masivo).
function refrescarBody() {
  document.getElementById('asisbody').innerHTML = renderFilas(pacientes, vista());
  aplicarFiltro();
}

// Filtra las filas según el buscador (por nombre o diagnóstico).
function aplicarFiltro() {
  const termino = (document.getElementById('asis-buscar').value || '').trim().toLowerCase();
  document.querySelectorAll('#asisbody .asis-row').forEach(fila => {
    fila.style.display = !termino || fila.dataset.buscar.includes(termino) ? '' : 'none';
  });
}

// Recalcula los contadores del encabezado:
//   presentes / ausentes (toda marca que no sea presente) / sin marcar
//   y el porcentaje de asistencia sobre el total de pacientes activos.
function recalcular() {
  const marcados = Object.values(seleccion);
  const total = pacientes.length;
  const presentes = marcados.filter(v => v === 'presente').length;
  document.getElementById('st-pres').textContent = presentes;
  document.getElementById('st-aus').textContent = marcados.length - presentes;
  document.getElementById('st-falta').textContent = total - marcados.length;
  document.getElementById('st-pct').textContent =
    (total ? Math.round((presentes / total) * 100) : 0) + '%';
}
