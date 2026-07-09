// =====================================================================
// CONTROLADOR: Profesionales
// ---------------------------------------------------------------------
// CAPA CONTROLADOR. Maneja el CRUD del equipo: listar, crear, editar y
// eliminar profesionales. Pide datos a los modelos, conecta los eventos
// del HTML que arma la vista y maneja los estados de carga/error.
// =====================================================================

import * as profesionalModel from '../models/profesionalModel.js';
import { renderEstructura, renderTabla, renderFormProfesional } from '../views/profesionalesView.js';
import { htmlCargando, htmlError, toast } from '../utils/ui.js';
import { validarProfesional } from '../utils/validacion.js';
import { mensajeError } from '../utils/errores.js';

// Punto de entrada de la sección Profesionales (lo llama el router).
export async function iniciarProfesionales() {
  const contenedor = document.getElementById('v-profesionales');
  contenedor.innerHTML = renderEstructura();
  document.getElementById('btn-nuevo-prof')
    .addEventListener('click', () => abrirForm());
  await cargarLista();
}

// ---------------------------------------------------------------------
// LISTADO (Read)
// ---------------------------------------------------------------------
async function cargarLista() {
  const caja = document.getElementById('prof-tabla');
  caja.innerHTML = htmlCargando('Cargando profesionales…');
  try {
    const profesionales = await profesionalModel.listarProfesionales({ soloActivos: false });
    caja.innerHTML = renderTabla(profesionales);

    // Botones "Editar" de cada fila.
    caja.querySelectorAll('.btn-editar-prof').forEach(btn => {
      btn.addEventListener('click', () => editar(btn.dataset.id));
    });
    // Botones "Eliminar" de cada fila.
    caja.querySelectorAll('.btn-eliminar-prof').forEach(btn => {
      btn.addEventListener('click', () => eliminar(btn.dataset.id, btn.dataset.nombre));
    });
  } catch (err) {
    console.error('Error listando profesionales:', err);
    caja.innerHTML = htmlError('No se pudieron cargar los profesionales.');
  }
}

// ---------------------------------------------------------------------
// EDITAR: trae el profesional y abre el formulario (Update)
// ---------------------------------------------------------------------
async function editar(id) {
  try {
    const prof = await profesionalModel.obtenerProfesional(id);
    abrirForm(prof);
  } catch (err) {
    console.error('Error obteniendo profesional:', err);
    toast('No se pudo abrir el profesional.', 'bad');
  }
}

// ---------------------------------------------------------------------
// FORMULARIO ALTA / EDICIÓN (Create / Update)
// ---------------------------------------------------------------------
function abrirForm(prof = {}) {
  document.body.insertAdjacentHTML('beforeend', renderFormProfesional(prof));
  const overlay = document.getElementById('overlay-prof');
  const form = document.getElementById('form-prof');
  const cerrar = () => overlay.remove();

  overlay.querySelectorAll('[data-cerrar]').forEach(b => b.addEventListener('click', cerrar));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-guardar-prof');

    // Valores del formulario; los vacíos pasan a null.
    const fd = new FormData(form);
    const datos = Object.fromEntries(fd.entries());
    for (const k of Object.keys(datos)) if (datos[k] === '') datos[k] = null;

    // Obtener los días de trabajo seleccionados como array.
    datos.dias_trabajo = fd.getAll('dias_trabajo') || [];

    // --- Validación: nombre obligatorio y email con formato ---
    const v = validarProfesional(datos);
    if (!v.ok) { toast(v.mensaje, 'bad'); return; }

    btn.disabled = true;
    btn.textContent = 'Guardando…';
    try {
      if (prof.id) {
        await profesionalModel.actualizarProfesional(prof.id, datos);
        toast('Profesional actualizado.');
      } else {
        await profesionalModel.crearProfesional(datos);
        toast('Profesional creado.');
      }
      cerrar();
      await cargarLista();
    } catch (err) {
      console.error('Error guardando profesional:', err);
      btn.disabled = false;
      btn.textContent = prof.id ? 'Guardar cambios' : 'Crear profesional';
      toast(mensajeError(err, 'No se pudo guardar el profesional.'), 'bad');
    }
  });
}

// ---------------------------------------------------------------------
// ELIMINAR (Delete)
// ---------------------------------------------------------------------
async function eliminar(id, nombre) {
  // Confirmación: es una acción irreversible.
  if (!window.confirm(`¿Eliminar a ${nombre}? Esta acción no se puede deshacer.`)) return;
  try {
    await profesionalModel.eliminarProfesional(id);
    toast('Profesional eliminado.');
    await cargarLista();
  } catch (err) {
    console.error('Error eliminando profesional:', err);
    // El error típico es por clave foránea: tiene pacientes asignados.
    const msg = /foreign key|violates|asignaciones/i.test(err.message || '')
      ? 'No se puede eliminar: tiene pacientes asignados. Marcalo como "Inactivo" en su lugar.'
      : 'Error al eliminar: ' + (err.message || '');
    toast(msg, 'bad');
  }
}
