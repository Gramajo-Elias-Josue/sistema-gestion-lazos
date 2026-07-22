// =====================================================================
// CONTROLADOR: Profesionales
// ---------------------------------------------------------------------
// CAPA CONTROLADOR. Maneja el ABM del equipo: listar, crear, editar y dar
// de baja profesionales. Pide datos a los modelos, conecta los eventos del
// HTML que arma la vista y maneja los estados de carga/error.
// La baja es LÓGICA (estado inactivo): no hay borrado real.
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
    // Botones "Dar de baja" / "Reactivar" de cada fila.
    caja.querySelectorAll('.btn-baja-prof').forEach(btn => {
      btn.addEventListener('click', () => cambiarEstado(btn.dataset.id, btn.dataset.estado, btn.dataset.nombre));
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
        // `estado` se fuerza acá en vez de confiar en el default de la base:
        // el formulario ya no lo pide, y si la columna no tuviera default
        // quedaría en NULL y el profesional no aparecería en los listados
        // que filtran por estado = 'activo' (turnos, agenda, fichaje).
        datos.estado = 'activo';
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
// BAJA LÓGICA / REACTIVAR (no borra: cambia el estado)
// ---------------------------------------------------------------------
// Espejo de la baja de pacientes. El profesional nunca se borra: se marca
// inactivo, así conserva sus turnos, sus fichajes y la autoría de los
// informes que firmó, y se puede reactivar cuando haga falta.
async function cambiarEstado(id, estadoActual, nombre) {
  const darBaja = estadoActual === 'activo';
  if (darBaja && !window.confirm(`¿Dar de baja a ${nombre}? Quedará como inactivo (no se borra y conserva sus turnos e informes).`)) {
    return;
  }
  try {
    await profesionalModel.cambiarEstadoProfesional(id, darBaja ? 'inactivo' : 'activo');
    toast(darBaja ? 'Profesional dado de baja.' : 'Profesional reactivado.');
    await cargarLista();
  } catch (err) {
    console.error('Error cambiando estado:', err);
    toast(mensajeError(err, 'No se pudo cambiar el estado.'), 'bad');
  }
}
