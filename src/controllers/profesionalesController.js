// =====================================================================
// CONTROLADOR: Profesionales
// ---------------------------------------------------------------------
// CAPA CONTROLADOR. Maneja el ABM del equipo: listar, crear, editar y dar
// de baja profesionales. Pide datos a los modelos, conecta los eventos del
// HTML que arma la vista y maneja los estados de carga/error.
// La baja es LÓGICA (estado inactivo): no hay borrado real.
// =====================================================================

import * as profesionalModel from '../models/profesionalModel.js';
import * as usuarioModel from '../models/usuarioModel.js';
import * as sectorModel from '../models/sectorModel.js';
import { renderEstructura, renderTabla, renderFormProfesional, renderListaSectores, renderModalSector } from '../views/profesionalesView.js';
import { htmlCargando, htmlError, toast, confirmar } from '../utils/ui.js';
import { validarProfesional } from '../utils/validacion.js';
import { mensajeError } from '../utils/errores.js';
import { perfilActual } from '../sesion.js';
import { puedeOperar } from '../permisos.js';
import { pedirRecuperacion } from '../auth.js';
import { normalizar } from '../utils/areas.js';

// Profesiones/sectores cargados (pestaña "Profesiones"): se usan acá y
// también como opciones del desplegable "Sector" al crear/editar un
// profesional, así que se guardan en memoria mientras la sección está abierta.
let sectoresCargados = [];

// Punto de entrada de la sección Profesionales (lo llama el router).
export async function iniciarProfesionales() {
  const contenedor = document.getElementById('v-profesionales');
  contenedor.innerHTML = renderEstructura();

  document.getElementById('prof-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('.tab');
    if (b) cambiarTab(b.dataset.tab);
  });
  document.getElementById('btn-nuevo-prof')
    // Director y secretaría pueden ofrecer el alta rápida del usuario: es
    // quien normalmente da de alta profesionales. La Edge Function la deja
    // crear SOLO cuentas de rol "profesional" (ver crear-usuario/index.ts).
    .addEventListener('click', () => abrirForm({}, { permiteCrearUsuario: puedeOperar(perfilActual()) }));
  document.getElementById('btn-nuevo-sector').addEventListener('click', abrirFormSector);
  document.getElementById('sectores-tabla').addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-quitar-sector');
    if (btn) quitarSector(btn.dataset);
  });

  // Los sectores se cargan siempre (no solo al abrir la pestaña): el
  // formulario de "Nuevo profesional" los necesita para su desplegable,
  // y la lista para pintar cada profesional con el color de su profesión.
  const sectoresListos = cargarSectores();
  await Promise.all([sectoresListos, cargarLista(sectoresListos)]);
}

// Pestañas Equipo / Profesiones (mismo patrón que Asistencia).
function cambiarTab(tab) {
  document.querySelectorAll('#prof-tabs .tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('prof-pane-equipo').classList.toggle('hidden', tab !== 'equipo');
  document.getElementById('prof-pane-sectores').classList.toggle('hidden', tab !== 'sectores');
}

// ---------------------------------------------------------------------
// LISTADO (Read)
// ---------------------------------------------------------------------
// `esperarSectores`: al entrar a la sección, la promesa de cargarSectores
// (se piden en paralelo, pero el color de cada fila depende de ellos).
async function cargarLista(esperarSectores = null) {
  const caja = document.getElementById('prof-tabla');
  caja.innerHTML = htmlCargando('Cargando profesionales…');
  try {
    const [profesionales] = await Promise.all([
      profesionalModel.listarProfesionales({ soloActivos: false }),
      esperarSectores,
    ]);
    caja.innerHTML = renderTabla(profesionales, sectoresCargados);

    // Botones "Editar" de cada fila.
    caja.querySelectorAll('.btn-editar-prof').forEach(btn => {
      btn.addEventListener('click', () => editar(btn.dataset.id));
    });
    // Botones "Desactivar" / "Activar" de cada fila.
    caja.querySelectorAll('.btn-baja-prof').forEach(btn => {
      btn.addEventListener('click', () => cambiarEstado(btn.dataset.id, btn.dataset.estado, btn.dataset.nombre));
    });

    // Buscador: filtra las filas mientras se escribe (nombre / email /
    // especialidad / matrícula). No consulta la base, solo muestra/esconde.
    const buscador = caja.querySelector('#prof-buscar');
    buscador?.addEventListener('input', () => filtrar(caja));
    filtrar(caja);
  } catch (err) {
    console.error('Error listando profesionales:', err);
    caja.innerHTML = htmlError('No se pudo cargar el equipo. Revisá la conexión.');
  }
}

// Filtra el listado por lo escrito en el buscador.
function filtrar(caja) {
  const termino = (caja.querySelector('#prof-buscar')?.value || '').trim().toLowerCase();
  const filas = [...caja.querySelectorAll('tbody tr[data-buscar]')];
  let visibles = 0;
  filas.forEach(f => {
    const coincide = !termino || (f.dataset.buscar || '').includes(termino);
    f.style.display = coincide ? '' : 'none';
    if (coincide) visibles++;
  });

  const contador = caja.querySelector('#prof-contador');
  if (contador) {
    contador.textContent = termino
      ? `${visibles} de ${filas.length} profesionales`
      : `${filas.length} ${filas.length === 1 ? 'profesional' : 'profesionales'}`;
  }
  const sinResultados = caja.querySelector('#prof-sin-resultados');
  if (sinResultados) sinResultados.hidden = visibles > 0;
}

// ---------------------------------------------------------------------
// PROFESIONES / SECTORES (pestaña "Profesiones")
// ---------------------------------------------------------------------
// Antes esto se agregaba/quitaba desde la Grilla de atención; se movió
// acá porque son las mismas profesiones que se eligen al crear un
// profesional (así queda enlazado a su columna correcta de la grilla).
async function cargarSectores() {
  const caja = document.getElementById('sectores-tabla');
  caja.innerHTML = htmlCargando('Cargando profesiones…');
  try {
    sectoresCargados = await sectorModel.listarSectores();
    caja.innerHTML = renderListaSectores(sectoresCargados);
  } catch (err) {
    console.error('Error listando profesiones:', err);
    caja.innerHTML = htmlError('No se pudieron cargar las profesiones. Revisá la conexión.');
  }
}

function abrirFormSector() {
  document.body.insertAdjacentHTML('beforeend', renderModalSector());
  const overlay = document.getElementById('overlay-sector');
  const form = document.getElementById('form-sector');
  const cerrar = () => overlay.remove();

  overlay.querySelectorAll('[data-cerrar]').forEach(b => b.addEventListener('click', cerrar));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
  form.querySelector('input')?.focus();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const etiqueta = new FormData(form).get('etiqueta').trim();
    if (!etiqueta) return;

    // La clave es el nombre sin tildes ni espacios: identifica la profesión
    // (y la columna que arma en la Grilla de atención).
    const clave = normalizar(etiqueta).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    if (sectoresCargados.some(s => s.clave === clave)) {
      toast('Ya existe una profesión con ese nombre.', 'bad');
      return;
    }

    try {
      // Si esa profesión se había quitado, el modelo la reactiva con lo
      // que tenía cargado en vez de crear una nueva.
      const sector = await sectorModel.crearSector({
        etiqueta, clave, orden: (sectoresCargados.at(-1)?.orden ?? 0) + 1,
      });
      sectoresCargados.push(sector);
      cerrar();
      document.getElementById('sectores-tabla').innerHTML = renderListaSectores(sectoresCargados);
      toast(`"${etiqueta}" agregada.`);
    } catch (err) {
      console.error('Error creando la profesión:', err);
      toast('No se pudo agregar. Probá de nuevo.', 'bad');
    }
  });
}

// Quita una profesión. SIEMPRE pregunta antes, y avisa cuántos pacientes
// tienen algo cargado en su columna de la Grilla de atención: no es lo
// mismo sacar una vacía que una con medio centro adentro.
async function quitarSector({ id, clave, etiqueta }) {
  let cargadas = 0;
  try {
    cargadas = await sectorModel.contarCeldas(clave);
  } catch (err) {
    console.error('No se pudo contar lo cargado en esa profesión:', err);
  }

  const detalle = cargadas
    ? `${cargadas === 1 ? 'Hay 1 paciente' : `Hay ${cargadas} pacientes`} con un profesional cargado en su columna de la Grilla de atención. Lo cargado se conserva por si la volvés a agregar, pero deja de verse.`
    : 'No tiene nada cargado en la Grilla de atención.';

  const seguro = await confirmar({
    titulo: `¿Quitar "${etiqueta}"?`,
    mensaje: detalle,
    textoOk: 'Sí, quitar',
    textoCancelar: 'No, dejarla',
    peligro: true,
  });
  if (!seguro) return;

  try {
    await sectorModel.desactivarSector(id);
    sectoresCargados = sectoresCargados.filter(s => String(s.id) !== String(id));
    document.getElementById('sectores-tabla').innerHTML = renderListaSectores(sectoresCargados);
    toast(`"${etiqueta}" quitada.`);
  } catch (err) {
    console.error('Error quitando la profesión:', err);
    toast('No se pudo quitar. Probá de nuevo.', 'bad');
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
    toast('No se pudo abrir el profesional. Probá de nuevo.', 'bad');
  }
}

// ---------------------------------------------------------------------
// FORMULARIO ALTA / EDICIÓN (Create / Update)
// ---------------------------------------------------------------------
function abrirForm(prof = {}, opciones = {}) {
  document.body.insertAdjacentHTML('beforeend', renderFormProfesional(prof, { ...opciones, sectores: sectoresCargados }));
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

    // Días y turnos tildados, como arrays (FormData solo deja el último).
    datos.dias_trabajo = fd.getAll('dias_trabajo') || [];
    datos.turnos_trabajo = fd.getAll('turnos_trabajo') || [];

    // --- Validación: todos los datos obligatorios al CREAR (menos
    //     matrícula y teléfono 2); al editar no se exige retroactivo ---
    const v = validarProfesional(datos, { esNuevo: !prof.id });
    if (!v.ok) { toast(v.mensaje, 'bad'); return; }
    // Al CREAR (no al editar), si quien lo da de alta puede operar se le
    // crea el usuario de acceso directo, sin preguntar (ver renderFormProfesional).
    const crearUsuario = !prof.id && !!opciones.permiteCrearUsuario;
    if (crearUsuario && !datos.email) {
      toast('Para crear el usuario de acceso hace falta el email.', 'bad');
      return;
    }

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
        const creado = await profesionalModel.crearProfesional(datos);
        toast('Profesional creado.');
        if (crearUsuario) await crearUsuarioDelProfesional(creado);
      }
      cerrar();
      await cargarLista();
    } catch (err) {
      console.error('Error guardando profesional:', err);
      btn.disabled = false;
      btn.textContent = prof.id ? 'Guardar cambios' : 'Crear profesional';
      toast(mensajeError(err, 'No se pudo guardar el profesional. Probá de nuevo.'), 'bad');
    }
  });
}

// Crea la cuenta de acceso del profesional recién creado, con una
// contraseña al azar que NADIE llega a ver: enseguida se le manda el
// mismo mail de "elegí tu contraseña" que usa recuperar contraseña, así
// el profesional entra por primera vez poniendo la suya. Si esto falla
// (por ejemplo, el email ya tiene una cuenta), el profesional ya quedó
// guardado igual: no se revierte, solo se avisa que faltó el usuario.
async function crearUsuarioDelProfesional(profesional) {
  try {
    const passwordAlAzar = crypto.randomUUID();
    await usuarioModel.crearUsuario({
      email: profesional.email,
      password: passwordAlAzar,
      nombre: profesional.nombre_completo,
      rol: 'profesional',
      profesionalId: profesional.id,
    });
    await pedirRecuperacion(profesional.email);
    toast(`Le mandamos un mail a ${profesional.email} para que elija su contraseña.`);
  } catch (err) {
    console.error('Error creando el usuario del profesional:', err);
    toast(mensajeError(err, 'El profesional se guardó, pero no se pudo crear su usuario de acceso. Podés crearlo a mano desde Administración.'), 'bad');
  }
}

// ---------------------------------------------------------------------
// ACTIVO / INACTIVO (no borra: cambia el estado)
// ---------------------------------------------------------------------
// Espejo del de pacientes. El profesional nunca se borra: se marca
// inactivo, así conserva sus turnos, sus fichajes y la autoría de los
// informes que firmó, y se puede volver a activar cuando haga falta.
async function cambiarEstado(id, estadoActual, nombre) {
  const desactivar = estadoActual === 'activo';
  if (desactivar) {
    const seguir = await confirmar({
      titulo: 'Desactivar',
      mensaje: `${nombre} deja de aparecer para asignar turnos. Sus turnos e informes se conservan y podés volver a activarlo cuando quieras.`,
      textoOk: 'Desactivar',
      textoCancelar: 'Volver',
      peligro: true,
    });
    if (!seguir) return;
  }
  try {
    await profesionalModel.cambiarEstadoProfesional(id, desactivar ? 'inactivo' : 'activo');
    toast(desactivar ? `${nombre} quedó como inactivo.` : `${nombre} está activo de nuevo.`);
    await cargarLista();
  } catch (err) {
    console.error('Error cambiando estado:', err);
    toast(mensajeError(err, 'No se pudo hacer el cambio. Probá de nuevo.'), 'bad');
  }
}
