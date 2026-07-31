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
import { htmlCargando, htmlError, toast } from '../utils/ui.js';
import { hoyISO, sumarDias, rangoMes, nombreDia } from '../utils/fechas.js';

// Estado en memoria de la vista mientras está abierta.
let pacientes = [];      // pacientes activos cargados
let seleccion = {};      // { id: estado } marcado en la fecha actual
let notas = {};          // { id: observación } del día
let guardado = {};       // { id: true } si la marca está confirmada en la base
let editando = {};       // { id: true } si la fila está reabierta para cambiar
let mesStats = {};       // { id: { presentes, total, pct } } del mes
let fechaActual = hoyISO();
let bloqueado = false;   // true si la fecha elegida es futura
let profIniciado = false; // true si ya se cargó la pestaña de profesionales

// Reúne el estado de la pantalla para pasárselo a la vista.
function vista() {
  return { seleccion, notas, mesStats, guardado, editando, bloqueado };
}

// Punto de entrada de la sección Asistencia (lo llama el router).
export async function iniciarAsistencia() {
  const contenedor = document.getElementById('v-asistencia');
  // Dos pestañas: Pacientes (planilla existente) y Profesionales (fichaje).
  // La planilla de pacientes se rinde en su propio panel; la de
  // profesionales se inicializa la primera vez que se entra a su pestaña.
  contenedor.innerHTML = `
    <div class="tabs" id="asis-tabs">
      <button class="tab active" data-tab="pac">Pacientes</button>
      <button class="tab" data-tab="prof">Profesionales</button>
    </div>
    <div id="asis-pane-pac"></div>
    <div id="asis-pane-prof" class="hidden"></div>`;
  document.getElementById('asis-pane-pac').innerHTML = renderEstructura(hoyISO());

  profIniciado = false;
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
    if (lapiz && !lapiz.disabled) editarFila(lapiz.dataset.editar);
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
  if (tab === 'prof' && !profIniciado) {
    profIniciado = true;
    iniciarAsistenciaProf();
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
  seleccion = {}; notas = {}; guardado = {}; editando = {}; mesStats = {};

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
    mesStats = calcularMes(delMes);

    caja.innerHTML = renderFilas(pacientes, vista());
    aplicarFiltro();  // respeta lo escrito en el buscador al cambiar de día
    recalcular();
  } catch (err) {
    console.error('Error cargando asistencia:', err);
    caja.innerHTML = htmlError('No se pudo cargar la asistencia. Revisá la conexión.');
  }
}

// Resumen mensual por paciente: días presente sobre días con registro.
function calcularMes(registros) {
  const stats = {};
  registros.forEach(r => {
    const s = stats[r.paciente_id] || (stats[r.paciente_id] = { presentes: 0, total: 0 });
    s.total++;
    if (r.estado === 'presente') s.presentes++;
  });
  Object.values(stats).forEach(s => { s.pct = Math.round((s.presentes / s.total) * 100); });
  return stats;
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
    sinMarca.forEach(p => { guardado[p.id] = true; });
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
