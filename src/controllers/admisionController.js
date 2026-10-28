// =====================================================================
// CONTROLADOR: Admisión
// ---------------------------------------------------------------------
// CAPA CONTROLADOR. Orquesta el alta de un ingreso, el checklist de
// documentación y la aprobación/rechazo de la admisión. Reutiliza el
// formulario de paciente de pacientesController. La pestaña
// "Documentación" edita qué se pide en cada admisión.
// =====================================================================

import * as pacienteModel from '../models/pacienteModel.js';
import * as admisionModel from '../models/admisionModel.js';
import * as requisitoModel from '../models/requisitoModel.js';
import {
  renderEstructura, renderLista, renderAdmision, renderListaRequisitos, renderModalRequisito,
} from '../views/admisionView.js';
import { abrirFormPaciente } from './pacientesController.js';
import { htmlCargando, htmlError, toast, pill, confirmar } from '../utils/ui.js';
import { mensajeError } from '../utils/errores.js';
import { claveDesdeNombre, siguienteOrden, nombreRepetido } from '../utils/catalogos.js';

// Documentación que se pide hoy (pestaña "Documentación"). La usa
// también el checklist de cada admisión.
let requisitosCargados = [];

// Punto de entrada de la sección Admisión (lo llama el router).
export async function iniciarAdmision() {
  const contenedor = document.getElementById('v-admision');
  contenedor.innerHTML = renderEstructura();
  document.getElementById('btn-nuevo-ingreso')
    .addEventListener('click', () => nuevoIngreso());

  document.getElementById('adm-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('.tab');
    if (b) cambiarTab(b.dataset.tab);
  });
  document.getElementById('btn-nuevo-requisito').addEventListener('click', () => abrirFormRequisito());
  document.getElementById('requisitos-tabla').addEventListener('click', (e) => {
    const editar = e.target.closest('.btn-editar-requisito');
    if (editar) abrirFormRequisito(requisitosCargados.find(r => String(r.id) === editar.dataset.id));
    const quitar = e.target.closest('.btn-quitar-requisito');
    if (quitar) quitarRequisito(quitar.dataset);
  });

  await Promise.all([cargarLista(), cargarRequisitos()]);
}

// Pestañas En trámite / Documentación (mismo patrón que Profesionales).
function cambiarTab(tab) {
  document.querySelectorAll('#adm-tabs .tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('adm-pane-tramite').classList.toggle('hidden', tab !== 'tramite');
  document.getElementById('adm-pane-documentacion').classList.toggle('hidden', tab !== 'documentacion');
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

// Con el detalle de un paciente abierto se esconden las pestañas: se
// vuelve a la lista con "‹ Volver".
function mostrarLista() {
  document.getElementById('adm-tabs').classList.remove('hidden');
  document.getElementById('lista-adm').classList.remove('hidden');
  document.getElementById('ficha-adm').classList.add('hidden');
}

function abrirDetalle() {
  document.getElementById('adm-tabs').classList.add('hidden');
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
    // La documentación se pide de nuevo: puede haber cambiado en la otra
    // pestaña (o en otra computadora) desde que se abrió la sección.
    const [paciente, checklist, requisitos] = await Promise.all([
      pacienteModel.obtenerPaciente(id),
      admisionModel.listarChecklist(id),
      requisitoModel.listarRequisitos(),
    ]);
    requisitosCargados = requisitos;
    ficha.innerHTML = renderAdmision(paciente, checklist, requisitos);

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
    toast('No se pudo guardar. Probá de nuevo.', 'bad');
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

  const mensaje = faltan
    ? `${nombre} pasa a ser paciente del centro. Todavía ${faltan === 1 ? 'falta 1 documento' : `faltan ${faltan} documentos`} por presentar.`
    : `${nombre} pasa a ser paciente del centro.`;

  const seguir = await confirmar({
    titulo: 'Aprobar admisión',
    mensaje,
    textoOk: faltan ? 'Aprobar igual' : 'Aprobar',
    textoCancelar: 'Volver',
  });
  if (!seguir) return;

  try {
    await pacienteModel.cambiarEstadoAdmision(id, 'admitido');
    toast(`Listo, ${nombre} ya figura entre los pacientes.`);
    await cargarLista();
  } catch (err) {
    console.error('Error aprobando admisión:', err);
    toast(mensajeError(err, 'No se pudo aprobar la admisión. Probá de nuevo.'), 'bad');
  }
}

async function rechazar(id, nombre) {
  const seguir = await confirmar({
    titulo: 'Rechazar admisión',
    mensaje: `${nombre} deja de figurar en la lista de admisión. Sus datos no se borran.`,
    textoOk: 'Rechazar',
    textoCancelar: 'Volver',
    peligro: true,
  });
  if (!seguir) return;
  try {
    await pacienteModel.cambiarEstadoAdmision(id, 'rechazado');
    toast('Admisión rechazada.');
    await cargarLista();
  } catch (err) {
    console.error('Error rechazando admisión:', err);
    toast(mensajeError(err, 'No se pudo rechazar la admisión. Probá de nuevo.'), 'bad');
  }
}

// ---------------------------------------------------------------------
// DOCUMENTACIÓN QUE SE PIDE (pestaña "Documentación")
// ---------------------------------------------------------------------
async function cargarRequisitos() {
  const caja = document.getElementById('requisitos-tabla');
  caja.innerHTML = htmlCargando('Cargando documentación…');
  try {
    requisitosCargados = await requisitoModel.listarRequisitos();
    caja.innerHTML = renderListaRequisitos(requisitosCargados);
  } catch (err) {
    console.error('Error listando la documentación de admisión:', err);
    caja.innerHTML = htmlError('No se pudo cargar la documentación. Revisá la conexión.');
  }
}

// Alta (sin `requisito`) o cambio de nombre (con `requisito`).
function abrirFormRequisito(requisito = {}) {
  document.body.insertAdjacentHTML('beforeend', renderModalRequisito(requisito));
  const overlay = document.getElementById('overlay-requisito');
  const form = document.getElementById('form-requisito');
  const cerrar = () => overlay.remove();

  overlay.querySelectorAll('[data-cerrar]').forEach(b => b.addEventListener('click', cerrar));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
  form.querySelector('input')?.focus();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const etiqueta = new FormData(form).get('etiqueta').trim();
    if (!etiqueta) return;
    if (nombreRepetido(requisitosCargados, etiqueta, requisito.id)) {
      toast('Ya se pide un documento con ese nombre.', 'bad');
      return;
    }

    try {
      if (requisito.id) {
        await requisitoModel.renombrarRequisito(requisito.id, etiqueta);
      } else {
        await requisitoModel.crearRequisito({
          etiqueta, clave: claveDesdeNombre(etiqueta), orden: siguienteOrden(requisitosCargados),
        });
      }
      cerrar();
      await cargarRequisitos();
      toast(requisito.id ? 'Documento actualizado.' : `"${etiqueta}" agregado: ya se pide en las admisiones.`);
    } catch (err) {
      console.error('Error guardando el documento de admisión:', err);
      toast(mensajeError(err, 'No se pudo guardar. Probá de nuevo.'), 'bad');
    }
  });
}

// Deja de pedirse. Lo que ya se marcó en admisiones anteriores no se
// pierde (el requisito queda inactivo, no se borra).
async function quitarRequisito({ id, etiqueta }) {
  const seguro = await confirmar({
    titulo: `¿Dejar de pedir "${etiqueta}"?`,
    mensaje: 'Deja de aparecer en las admisiones. Lo que ya se marcó en las anteriores se conserva, y vuelve si lo agregás de nuevo.',
    textoOk: 'Sí, quitar',
    textoCancelar: 'No, dejarlo',
    peligro: true,
  });
  if (!seguro) return;

  try {
    await requisitoModel.quitarRequisito(id);
    await cargarRequisitos();
    toast(`"${etiqueta}" ya no se pide.`);
  } catch (err) {
    console.error('Error quitando el documento de admisión:', err);
    toast(mensajeError(err, 'No se pudo quitar. Probá de nuevo.'), 'bad');
  }
}
