// =====================================================================
// CONTROLADOR: Admisión
// ---------------------------------------------------------------------
// CAPA CONTROLADOR. Orquesta el alta de un ingreso, el checklist de
// documentación y la aprobación/rechazo de la admisión. Reutiliza el
// formulario de paciente de pacientesController.
// =====================================================================

import * as pacienteModel from '../models/pacienteModel.js';
import * as admisionModel from '../models/admisionModel.js';
import { renderEstructura, renderLista, renderAdmision } from '../views/admisionView.js';
import { abrirFormPaciente } from './pacientesController.js';
import { htmlCargando, htmlError, toast, pill } from '../utils/ui.js';

// Punto de entrada de la sección Admisión (lo llama el router).
export async function iniciarAdmision() {
  const contenedor = document.getElementById('v-admision');
  contenedor.innerHTML = renderEstructura();
  document.getElementById('btn-nuevo-ingreso')
    .addEventListener('click', () => nuevoIngreso());
  await cargarLista();
}

// Abre el formulario de paciente para registrar un ingreso nuevo. Al
// guardar, refresca la lista y abre directamente su checklist de admisión.
function nuevoIngreso() {
  abrirFormPaciente({}, {
    mensajeAlta: 'Ingreso registrado. Completá la documentación de admisión.',
    onSaved: async (nuevo) => {
      await cargarLista();
      if (nuevo?.id) abrirAdmision(nuevo.id);
    },
  });
}

// ---------------------------------------------------------------------
// LISTADO de pacientes en admisión
// ---------------------------------------------------------------------
async function cargarLista() {
  mostrarLista();
  const caja = document.getElementById('adm-tabla');
  caja.innerHTML = htmlCargando('Cargando admisiones…');
  try {
    const pacientes = await pacienteModel.listarEnAdmision();
    caja.innerHTML = renderLista(pacientes);

    caja.querySelectorAll('.btn-abrir-adm').forEach(b =>
      b.addEventListener('click', () => abrirAdmision(b.dataset.id)));
    caja.querySelectorAll('.btn-rechazar-adm').forEach(b =>
      b.addEventListener('click', () => rechazar(b.dataset.id, b.dataset.nombre)));
  } catch (err) {
    console.error('Error listando admisiones:', err);
    caja.innerHTML = htmlError('No se pudieron cargar las admisiones.');
  }
}

function mostrarLista() {
  document.getElementById('lista-adm').classList.remove('hidden');
  document.getElementById('ficha-adm').classList.add('hidden');
}

function abrirDetalle() {
  document.getElementById('lista-adm').classList.add('hidden');
  const ficha = document.getElementById('ficha-adm');
  ficha.classList.remove('hidden');
  ficha.innerHTML = htmlCargando('Cargando…');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  return ficha;
}

// ---------------------------------------------------------------------
// DETALLE de admisión (checklist + aprobar / rechazar)
// ---------------------------------------------------------------------
async function abrirAdmision(id) {
  const ficha = abrirDetalle();
  try {
    const [paciente, checklist] = await Promise.all([
      pacienteModel.obtenerPaciente(id),
      admisionModel.listarChecklist(id),
    ]);
    ficha.innerHTML = renderAdmision(paciente, checklist);

    document.getElementById('btn-volver-adm').addEventListener('click', cargarLista);
    document.getElementById('btn-editar-adm').addEventListener('click', () =>
      abrirFormPaciente(paciente, { onSaved: () => abrirAdmision(id) }));
    document.getElementById('btn-aprobar-adm').addEventListener('click', () => aprobar(id, paciente.nombre_completo));
    document.getElementById('btn-rechazar-detalle').addEventListener('click', () => rechazar(id, paciente.nombre_completo));

    // Checklist: delegación de eventos en el contenedor (sobrevive cambios).
    const cont = document.getElementById('adm-checklist');
    cont.addEventListener('change', (e) => onChecklistChange(e, id));
  } catch (err) {
    console.error('Error abriendo admisión:', err);
    ficha.innerHTML = htmlError('No se pudo abrir la admisión.') +
      `<div style="text-align:center;margin-top:12px"><button class="btn ghost" id="btn-volver-adm">‹ Volver</button></div>`;
    document.getElementById('btn-volver-adm').addEventListener('click', cargarLista);
  }
}

// Guarda un cambio del checklist (tilde o texto de observación) y
// actualiza en el acto el pill de la fila y el contador de progreso.
async function onChecklistChange(e, pacienteId) {
  const t = e.target;
  if (!t.classList.contains('adm-check') && !t.classList.contains('adm-obs')) return;
  const req = t.dataset.req;
  const item = t.closest('.adm-item');
  const check = item.querySelector('.adm-check');
  const obs = item.querySelector('.adm-obs');
  const presentado = check.checked;

  try {
    await admisionModel.marcarRequisito(pacienteId, req, presentado, obs.value || null);
    // Pill de estado de la fila (último hijo) + contador de progreso.
    const viejoPill = item.querySelector('.pill');
    if (viejoPill) viejoPill.outerHTML = presentado ? pill('ok', 'Presentado') : pill('warn', 'Pendiente');
    actualizarProgreso();
  } catch (err) {
    console.error('Error guardando requisito de admisión:', err);
    toast('No se pudo guardar el cambio.', 'bad');
    if (t.classList.contains('adm-check')) check.checked = !presentado; // revertir
  }
}

// Recalcula "N / Total presentados" a partir de los tildes marcados.
function actualizarProgreso() {
  const checks = document.querySelectorAll('#adm-checklist .adm-check');
  const total = checks.length;
  const marcados = [...checks].filter(c => c.checked).length;
  const cnt = document.getElementById('adm-progreso');
  if (cnt) cnt.textContent = `${marcados} / ${total} presentados`;
}

// ---------------------------------------------------------------------
// APROBAR / RECHAZAR la admisión
// ---------------------------------------------------------------------
async function aprobar(id, nombre) {
  const checks = document.querySelectorAll('#adm-checklist .adm-check');
  const faltan = [...checks].filter(c => !c.checked).length;
  let aviso = `¿Aprobar la admisión de ${nombre}? Pasará a ser un paciente activo.`;
  if (checks.length && faltan) aviso += `\n\nOjo: faltan ${faltan} documento(s) por marcar como presentados.`;
  if (!window.confirm(aviso)) return;

  try {
    await pacienteModel.cambiarEstadoAdmision(id, 'admitido');
    toast('Admisión aprobada. El paciente ya está activo.');
    await cargarLista();
  } catch (err) {
    console.error('Error aprobando admisión:', err);
    toast('No se pudo aprobar la admisión.', 'bad');
  }
}

async function rechazar(id, nombre) {
  if (!window.confirm(`¿Rechazar la admisión de ${nombre}? Quedará fuera del listado de admisión.`)) return;
  try {
    await pacienteModel.cambiarEstadoAdmision(id, 'rechazado');
    toast('Admisión rechazada.');
    await cargarLista();
  } catch (err) {
    console.error('Error rechazando admisión:', err);
    toast('No se pudo rechazar la admisión.', 'bad');
  }
}
