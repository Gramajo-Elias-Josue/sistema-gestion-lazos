// =====================================================================
// CONTROLADOR: Pacientes
// ---------------------------------------------------------------------
// CAPA CONTROLADOR. Orquesta el listado, el legajo, la historia clínica
// y los formularios (alta/edición de paciente y carga de documentos).
// Pide datos a los modelos, conecta los eventos del HTML que arma la
// vista y maneja los estados de carga/error.
// =====================================================================

import * as pacienteModel from '../models/pacienteModel.js';
import * as documentoModel from '../models/documentoModel.js';
import * as evaluacionModel from '../models/evaluacionModel.js';
import * as asignacionModel from '../models/asignacionModel.js';
import * as asistenciaModel from '../models/asistenciaModel.js';
import * as asistenciaProfModel from '../models/asistenciaProfesionalModel.js';
import * as categoriaModel from '../models/categoriaModel.js';
import {
  renderEstructura, renderTabla, renderFicha, renderHistoria, renderCategorias,
  renderFormPaciente, renderFormDocumento, renderVistaEvaluacion,
  renderListaCategorias, renderModalCategoria,
} from '../views/pacientesView.js';
import { htmlCargando, htmlError, toast, confirmar } from '../utils/ui.js';
import { hoyISO } from '../utils/fechas.js';
import { validarPaciente, validarDocumento, normalizarDni } from '../utils/validacion.js';
import { parseEvaluacion, autoresElegiblesHoy, autoresCertificado, autoresDelUsuario, TIPO_CERTIFICADO } from '../utils/evaluacion.js';
import { mensajeError } from '../utils/errores.js';
import { abrirEditorInforme } from './editorInforme.js';
import { FILTROS_VACIOS, cantidadFiltros, hayQueMostrar, pasaFiltros } from '../utils/filtrosPacientes.js';
import { CATEGORIA_CUD, CATEGORIA_INFORMES, claveDesdeNombre, siguienteOrden, nombreRepetido } from '../utils/catalogos.js';
import { perfilActual } from '../sesion.js';
import { puedeOperar } from '../permisos.js';

// Categorías de la historia clínica (pestaña "Categorías"). Se vuelven a
// pedir al abrir cada historia, por si cambiaron.
let categoriasCargadas = [];

// Cuántos pacientes por página en el listado, y en qué página está.
const PAC_POR_PAGINA = 12;
let pacPagina = 0;
// Búsqueda y filtros elegidos. Se guardan acá (no solo en el HTML) para
// que no se pierdan al volver de un legajo o después de editar a alguien.
let pacTermino = '';
let pacFiltros = { ...FILTROS_VACIOS };

// Punto de entrada de la sección Pacientes (lo llama el router).
export async function iniciarPacientes() {
  const contenedor = document.getElementById('v-pacientes');
  // La pestaña "Categorías" es solo de dirección / secretaría (la base
  // tampoco deja que otro rol las cambie).
  const gestiona = puedeOperar(perfilActual());
  contenedor.innerHTML = renderEstructura({ gestiona });
  if (gestiona) {
    document.getElementById('pac-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab');
      if (b) cambiarTab(b.dataset.tab);
    });
    document.getElementById('btn-nueva-categoria').addEventListener('click', () => abrirFormCategoria());
    document.getElementById('categorias-tabla').addEventListener('click', (e) => {
      const editar = e.target.closest('.btn-editar-categoria');
      if (editar) abrirFormCategoria(categoriasCargadas.find(c => String(c.id) === editar.dataset.id));
      const eliminar = e.target.closest('.btn-eliminar-categoria');
      if (eliminar) eliminarCategoria(eliminar.dataset);
    });
  }
  await Promise.all([cargarLista(), gestiona ? cargarCategorias() : null]);
}

// Pestañas Pacientes / Categorías (mismo patrón que Profesionales).
function cambiarTab(tab) {
  document.querySelectorAll('#pac-tabs .tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('pac-pane-pacientes').classList.toggle('hidden', tab !== 'pacientes');
  document.getElementById('pac-pane-categorias').classList.toggle('hidden', tab !== 'categorias');
}

// ---------------------------------------------------------------------
// LISTADO (Read)
// ---------------------------------------------------------------------
async function cargarLista() {
  mostrarLista();
  const caja = document.getElementById('pac-tabla');
  caja.innerHTML = htmlCargando('Cargando pacientes…');
  try {
    // soloActivos:false -> el listado muestra activos e inactivos.
    const pacientes = await pacienteModel.listarPacientes({ soloActivos: false });
    caja.innerHTML = renderTabla(pacientes, { termino: pacTermino, filtros: pacFiltros });
    pacPagina = 0;

    // Click en la fila (pero no en un botón) -> abrir el legajo.
    caja.querySelectorAll('tbody tr[data-id]').forEach(tr => {
      tr.addEventListener('click', (e) => {
        if (e.target.closest('button')) return; // los botones tienen su propio handler
        abrirFicha(tr.dataset.id);
      });
    });
    // Botones de acción por fila.
    caja.querySelectorAll('.btn-historia').forEach(b =>
      b.addEventListener('click', () => abrirHistoria(b.dataset.id)));
    caja.querySelectorAll('.btn-editar-row').forEach(b =>
      b.addEventListener('click', () => editarPaciente(b.dataset.id)));
    caja.querySelectorAll('.btn-baja').forEach(b =>
      b.addEventListener('click', () => cambiarEstado(b.dataset.id, b.dataset.estado, b.dataset.nombre)));

    // Buscador: filtra las filas mientras se escribe y vuelve a la
    // primera página (si no, un resultado corto podría caer fuera de la
    // página en la que estaba y no verse nada).
    const buscador = caja.querySelector('#pac-buscar');
    buscador?.addEventListener('input', () => { pacTermino = buscador.value; pacPagina = 0; filtrarYPaginar(caja); });
    caja.querySelector('#pac-prev')?.addEventListener('click', () => cambiarPagina(caja, -1));
    caja.querySelector('#pac-next')?.addEventListener('click', () => cambiarPagina(caja, 1));
    conectarFiltros(caja);

    filtrarYPaginar(caja);
  } catch (err) {
    console.error('Error listando pacientes:', err);
    caja.innerHTML = htmlError('No se pudo cargar la lista de pacientes. Revisá la conexión.');
  }
}

// Botón "Filtros" (abre/cierra el panel) y los controles del panel.
// Elegir un filtro concreto reemplaza a "Ver todos"; "Limpiar" vuelve al
// estado inicial (lista oculta hasta que se busque algo).
function conectarFiltros(caja) {
  const panel = caja.querySelector('#pac-filtros');
  const boton = caja.querySelector('#pac-btn-filtros');
  if (!panel || !boton) return;

  const mostrarPanel = (abierto) => {
    panel.hidden = !abierto;
    boton.setAttribute('aria-expanded', String(abierto));
  };
  boton.addEventListener('click', () => mostrarPanel(panel.hidden));

  // Al aplicar un filtro el panel se cierra solo, para que se vean los
  // resultados (en el celular el panel ocupa toda la pantalla). Se
  // vuelve a abrir con el botón "Filtros".
  const selects = { estado: '#pf-estado', cud: '#pf-cud', obraSocial: '#pf-os' };
  Object.entries(selects).forEach(([clave, selector]) => {
    caja.querySelector(selector).addEventListener('change', (e) => {
      pacFiltros = { ...pacFiltros, [clave]: e.target.value, verTodos: false };
      pacPagina = 0;
      filtrarYPaginar(caja);
      mostrarPanel(false);
    });
  });

  caja.querySelector('#pf-ver-todos').addEventListener('click', () => {
    pacFiltros = { ...pacFiltros, verTodos: true };
    pacPagina = 0;
    filtrarYPaginar(caja);
    mostrarPanel(false);
  });

  caja.querySelector('#pf-limpiar').addEventListener('click', () => {
    pacFiltros = { ...FILTROS_VACIOS };
    caja.querySelector('#pf-estado').value = 'todos';
    caja.querySelector('#pf-cud').value = 'todos';
    caja.querySelector('#pf-os').value = 'todas';
    pacPagina = 0;
    filtrarYPaginar(caja);
  });
}

// Aplica la búsqueda y los filtros y muestra solo la página actual. Sin
// búsqueda ni filtros, la lista queda oculta (ver filtrosPacientes.js).
// No consulta la base: solo muestra/esconde filas, así responde al instante.
function filtrarYPaginar(caja) {
  const mostrar = hayQueMostrar(pacTermino, pacFiltros);
  const filas = [...caja.querySelectorAll('tbody tr[data-buscar]')];
  const coinciden = filas.filter(f => pasaFiltros(
    { buscar: f.dataset.buscar, estado: f.dataset.estado, cud: f.dataset.cud, obraSocial: f.dataset.os },
    pacTermino, pacFiltros,
  ));

  const paginas = Math.max(1, Math.ceil(coinciden.length / PAC_POR_PAGINA));
  pacPagina = Math.min(Math.max(pacPagina, 0), paginas - 1);
  const desde = pacPagina * PAC_POR_PAGINA;
  const enPagina = new Set(coinciden.slice(desde, desde + PAC_POR_PAGINA));

  filas.forEach(f => { f.style.display = enPagina.has(f) ? '' : 'none'; });

  const inicial = caja.querySelector('#pac-inicial');
  if (inicial) inicial.hidden = mostrar;
  const tabla = caja.querySelector('#pac-lista-wrap');
  if (tabla) tabla.hidden = !mostrar || coinciden.length === 0;

  const cant = cantidadFiltros(pacFiltros);
  const badge = caja.querySelector('#pac-filtros-cant');
  if (badge) { badge.hidden = cant === 0; badge.textContent = cant; }

  const contador = caja.querySelector('#pac-contador');
  if (contador) {
    contador.textContent = mostrar
      ? `${coinciden.length} de ${filas.length} pacientes`
      : `${filas.length} ${filas.length === 1 ? 'paciente cargado' : 'pacientes cargados'}`;
  }

  const sinResultados = caja.querySelector('#pac-sin-resultados');
  if (sinResultados) sinResultados.hidden = !mostrar || coinciden.length > 0;

  const pager = caja.querySelector('#pac-pager');
  if (pager) {
    pager.hidden = !mostrar || paginas <= 1;
    caja.querySelector('#pac-pager-info').textContent = `Página ${pacPagina + 1} de ${paginas}`;
    caja.querySelector('#pac-prev').disabled = pacPagina === 0;
    caja.querySelector('#pac-next').disabled = pacPagina >= paginas - 1;
  }
}

// Cambia de página (±1) y sube el listado al principio.
function cambiarPagina(caja, pasos) {
  pacPagina += pasos;
  filtrarYPaginar(caja);
  // Sube hasta el buscador. No sirve scrollIntoView: lo deja pegado al
  // borde de la pantalla, DEBAJO del encabezado fijo (.top), que en el
  // celular tapa el primer paciente. Se descuenta su altura.
  const inicio = caja.querySelector('.lista-toolbar') || caja.querySelector('.pac-lista');
  if (!inicio) return;
  const encabezado = document.querySelector('.top')?.offsetHeight || 0;
  const y = inicio.getBoundingClientRect().top + window.scrollY - encabezado - 12;
  window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
}

// Muestra el listado y oculta el detalle (legajo / historia).
// Con un legajo o una historia abiertos se esconden las pestañas: se
// vuelve a la lista con "‹ Volver".
function mostrarLista() {
  document.getElementById('pac-tabs')?.classList.remove('hidden');
  document.getElementById('lista-pac').classList.remove('hidden');
  document.getElementById('ficha-pac').classList.add('hidden');
}

// Prepara el contenedor de detalle (legajo o historia) y lo muestra.
function abrirDetalle() {
  document.getElementById('pac-tabs')?.classList.add('hidden');
  document.getElementById('lista-pac').classList.add('hidden');
  const ficha = document.getElementById('ficha-pac');
  ficha.classList.remove('hidden');
  ficha.innerHTML = htmlCargando('Cargando…');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  return ficha;
}

// ---------------------------------------------------------------------
// LEGAJO (datos personales)
// ---------------------------------------------------------------------
async function abrirFicha(id) {
  const ficha = abrirDetalle();
  try {
    const paciente = await pacienteModel.obtenerPaciente(id);
    ficha.innerHTML = renderFicha(paciente);
    document.getElementById('btn-volver').addEventListener('click', cargarLista);
    document.getElementById('btn-editar-pac').addEventListener('click', () => abrirFormPaciente(paciente));
    document.getElementById('btn-abrir-historia').addEventListener('click', () => abrirHistoria(id));
  } catch (err) {
    console.error('Error abriendo legajo:', err);
    mostrarErrorDetalle(ficha, 'No se pudo abrir el legajo. Revisá la conexión.');
  }
}

// ---------------------------------------------------------------------
// HISTORIA CLÍNICA (documentos por categoría)
// ---------------------------------------------------------------------
async function abrirHistoria(id) {
  const ficha = abrirDetalle();
  try {
    // En paralelo: datos del paciente (con documentos) + sus evaluaciones
    // profesionales, que van en su propio apartado de la historia clínica.
    const [paciente, evaluaciones, categorias] = await Promise.all([
      pacienteModel.obtenerPaciente(id),
      evaluacionModel.listarPorPaciente(id).catch(() => []),
      categoriaModel.listarCategorias(),
    ]);
    categoriasCargadas = categorias;
    const docs = paciente.documentos || [];
    ficha.innerHTML = renderHistoria(paciente, evaluaciones, categorias);
    document.getElementById('btn-volver').addEventListener('click', cargarLista);
    document.getElementById('btn-ver-legajo').addEventListener('click', () => abrirFicha(id));

    // Apartado de evaluaciones (no se re-renderiza al buscar): botón para
    // cargar una nueva y un botón por evaluación para reimprimir su PDF.
    const btnNuevaEval = document.querySelector('.btn-nueva-eval');
    if (btnNuevaEval) btnNuevaEval.addEventListener('click', () => abrirFormEvaluacion(paciente, evaluaciones));
    document.querySelector('.btn-nuevo-certificado')
      ?.addEventListener('click', () => abrirFormCertificado(paciente, evaluaciones));
    document.querySelectorAll('.btn-eval-ver').forEach(b => b.addEventListener('click', () => {
      const ev = evaluaciones.find(e => String(e.id) === String(b.dataset.evalId));
      if (ev) abrirVistaEvaluacion(paciente, ev, evaluaciones);
    }));
    document.querySelectorAll('.btn-eval-pdf').forEach(b => b.addEventListener('click', () => {
      const ev = evaluaciones.find(e => String(e.id) === String(b.dataset.evalId));
      if (ev) descargarPdfEvaluacion(paciente, ev);
    }));

    const cats = document.getElementById('hist-cats');
    // Conecta los botones de las tarjetas. Se vuelve a llamar al filtrar,
    // porque al buscar se re-renderiza el contenido de #hist-cats.
    const conectar = () => {
      cats.querySelectorAll('.btn-agregar-doc').forEach(b =>
        b.addEventListener('click', () => abrirFormDocumento(id, b.dataset.tipo)));
      cats.querySelectorAll('.docrow').forEach(row => {
        const btn = row.querySelector('.btn-ver-doc');
        if (btn) btn.addEventListener('click', () => verDocumento(row.dataset.path));
      });
    };
    conectar();

    // Buscador: re-renderiza solo las tarjetas según el término escrito.
    document.getElementById('hist-buscar').addEventListener('input', (e) => {
      cats.innerHTML = renderCategorias(docs, e.target.value, categorias);
      conectar();
    });
  } catch (err) {
    console.error('Error abriendo historia clínica:', err);
    mostrarErrorDetalle(ficha, 'No se pudo abrir la historia clínica. Revisá la conexión.');
  }
}

// Muestra un error en el detalle con un botón para volver al listado.
function mostrarErrorDetalle(ficha, mensaje) {
  ficha.innerHTML = htmlError(mensaje) +
    `<div style="text-align:center;margin-top:12px"><button class="btn ghost" id="btn-volver">‹ Volver</button></div>`;
  document.getElementById('btn-volver').addEventListener('click', cargarLista);
}

// ---------------------------------------------------------------------
// EDITAR desde el listado (trae el paciente y abre el formulario)
// ---------------------------------------------------------------------
async function editarPaciente(id) {
  try {
    const paciente = await pacienteModel.obtenerPaciente(id);
    abrirFormPaciente(paciente);
  } catch (err) {
    console.error('Error obteniendo paciente:', err);
    toast('No se pudo abrir el paciente. Probá de nuevo.', 'bad');
  }
}

// ---------------------------------------------------------------------
// ACTIVO / INACTIVO (no borra: cambia el estado)
// ---------------------------------------------------------------------
async function cambiarEstado(id, estadoActual, nombre) {
  const desactivar = estadoActual === 'activo';
  if (desactivar) {
    const seguir = await confirmar({
      titulo: 'Desactivar',
      mensaje: `${nombre} deja de aparecer en las listas del día a día y se liberan sus horarios en la Grilla de atención. Su historia clínica se conserva y podés volver a activarlo cuando quieras.`,
      textoOk: 'Desactivar',
      textoCancelar: 'Volver',
      peligro: true,
    });
    if (!seguir) return;
  }
  try {
    await pacienteModel.cambiarEstadoPaciente(id, desactivar ? 'inactivo' : 'activo');
    toast(desactivar ? `${nombre} quedó como inactivo.` : `${nombre} está activo de nuevo.`);
    // Al desactivarlo se liberan sus franjas de la grilla (quedan como
    // historia, no se borran). Al reactivarlo NO se le devuelven solas:
    // esos horarios pueden haberse dado a otro paciente mientras tanto.
    if (desactivar) await liberarGrilla(() => asignacionModel.cerrarPorPaciente(id));
    await cargarLista();
  } catch (err) {
    console.error('Error cambiando estado:', err);
    toast(mensajeError(err, 'No se pudo hacer el cambio. Probá de nuevo.'), 'bad');
  }
}

// Libera los horarios de la grilla tras desactivar a alguien. Si falla,
// la desactivación ya quedó hecha: solo se avisa que las franjas hay que
// vaciarlas a mano (no se revierte nada).
async function liberarGrilla(cerrar) {
  try {
    await cerrar();
  } catch (err) {
    console.error('No se pudieron liberar sus horarios de la grilla:', err);
    toast('Quedó desactivado, pero no se pudieron liberar sus horarios en la Grilla de atención. Vacialos a mano desde Inicio.', 'bad');
  }
}

// ---------------------------------------------------------------------
// FORMULARIO ALTA / EDICIÓN DE PACIENTE
// ---------------------------------------------------------------------
// opts.onSaved(registro, esNuevo): si se pasa, reemplaza la acción por
// defecto posterior a guardar (sirve para reusar este form desde Admisión).
// opts.mensajeAlta: texto del toast al crear (por defecto "Paciente creado.").
export function abrirFormPaciente(paciente = {}, opts = {}) {
  document.body.insertAdjacentHTML('beforeend', renderFormPaciente(paciente));
  const overlay = document.getElementById('overlay-pac');
  const form = document.getElementById('form-pac');
  const cerrar = () => overlay.remove();

  overlay.querySelectorAll('[data-cerrar]').forEach(b => b.addEventListener('click', cerrar));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });

  // El diagnóstico según CUD solo se muestra si tiene CUD.
  const selCud = document.getElementById('pac-tiene-cud');
  const campoDiagnostico = document.getElementById('pac-campo-diagnostico');
  selCud.addEventListener('change', () => {
    campoDiagnostico.hidden = selCud.value !== 'true';
    if (!campoDiagnostico.hidden) campoDiagnostico.querySelector('input').focus();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-guardar-pac');

    const fd = new FormData(form);

    // Datos del paciente: todos los campos; los vacíos a null.
    const datos = {};
    for (const [k, val] of fd.entries()) {
      datos[k] = val === '' ? null : val;
    }
    // DNI a solo dígitos: deja los datos prolijos y hace fiable el
    // control de duplicados (que compara contra lo guardado).
    datos.dni = normalizarDni(datos.dni);
    // ¿Tiene CUD? llega como 'true'/'false' del select -> a booleano real.
    datos.tiene_cud = datos.tiene_cud === 'true';
    // Sin CUD el campo está oculto: no se manda, así lo que estuviera
    // escrito (o un diagnóstico ya guardado de antes) no se pisa a ciegas.
    if (!datos.tiene_cud) delete datos.diagnostico;

    // --- Validación de datos (antes de tocar la base) ---
    const v = validarPaciente(datos, { esNuevo: !paciente.id });
    if (!v.ok) { toast(v.mensaje, 'bad'); return; }

    btn.disabled = true;
    btn.textContent = 'Guardando…';
    const reactivar = () => {
      btn.disabled = false;
      btn.textContent = paciente.id ? 'Guardar cambios' : 'Crear paciente';
    };

    try {
      // No permitir DNI repetido: avisamos en vez de dejar que falle la base.
      if (datos.dni) {
        const dup = await pacienteModel.buscarPorDni(datos.dni, paciente.id || null);
        if (dup) {
          toast(`Ese DNI ya está cargado: ${dup.nombre_completo}.`, 'bad');
          reactivar();
          return;
        }
      }

      if (paciente.id) {
        // --- EDICIÓN ---
        const actualizado = await pacienteModel.actualizarPaciente(paciente.id, datos);
        toast('Paciente actualizado.');
        cerrar();
        if (opts.onSaved) await opts.onSaved(actualizado, false);
        else await abrirFicha(paciente.id);
      } else {
        // --- ALTA ---
        // El alta solo registra si tiene o no CUD (dato del paciente). El
        // documento/archivo del CUD se sube luego en la historia clínica.
        // El paciente nace 'en_admision' (default de la base): primero pasa
        // por el proceso de admisión antes de ser paciente activo.
        // `estado` se fuerza acá en vez de confiar en el default de la base:
        // el formulario ya no lo pide, y si la columna no tuviera default
        // quedaría en NULL y el paciente no aparecería en ningún listado
        // (todos filtran por estado = 'activo').
        datos.estado = 'activo';
        const nuevo = await pacienteModel.crearPaciente(datos);
        toast(opts.mensajeAlta || 'Paciente creado.');
        cerrar();
        if (opts.onSaved) await opts.onSaved(nuevo, true);
        else await cargarLista();
      }
    } catch (err) {
      console.error('Error guardando paciente:', err);
      reactivar();
      toast(mensajeError(err, 'No se pudo guardar el paciente. Probá de nuevo.'), 'bad');
    }
  });
}

// ---------------------------------------------------------------------
// FORMULARIO AGREGAR DOCUMENTO A LA HISTORIA CLÍNICA
// ---------------------------------------------------------------------
function abrirFormDocumento(pacienteId, tipoDefault = CATEGORIA_CUD) {
  document.body.insertAdjacentHTML('beforeend', renderFormDocumento(tipoDefault, categoriasCargadas));
  const overlay = document.getElementById('overlay-doc');
  const form = document.getElementById('form-doc');
  const cerrar = () => overlay.remove();

  overlay.querySelectorAll('[data-cerrar]').forEach(b => b.addEventListener('click', cerrar));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-guardar-doc');
    const fd = new FormData(form);
    const archivo = fd.get('archivo');

    // Datos del documento (el archivo va aparte porque es opcional).
    const datosDoc = {
      tipo: fd.get('tipo'),
      numero: fd.get('numero') || null,
      fecha_emision: fd.get('fecha_emision') || null,
      fecha_vencimiento: fd.get('fecha_vencimiento') || null,
      observaciones: fd.get('observaciones') || null,
    };

    // --- Validación: tipo elegido y fechas coherentes ---
    const v = validarDocumento(datosDoc);
    if (!v.ok) { toast(v.mensaje, 'bad'); return; }

    btn.disabled = true;
    btn.textContent = 'Guardando…';
    try {
      // El archivo es opcional (respaldo): se puede guardar solo con tipo,
      // número, fechas y observaciones para la historia clínica.
      await documentoModel.guardarDocumento({
        pacienteId,
        tipo: datosDoc.tipo,
        numero: datosDoc.numero,
        archivo: (archivo && archivo.size) ? archivo : null,
        fechaEmision: datosDoc.fecha_emision,
        fechaVencimiento: datosDoc.fecha_vencimiento,
        observaciones: datosDoc.observaciones,
      });
      toast('Documento guardado.');
      cerrar();
      await abrirHistoria(pacienteId); // refresca la historia con el nuevo doc
    } catch (err) {
      console.error('Error guardando documento:', err);
      btn.disabled = false;
      btn.textContent = 'Guardar';
      toast(mensajeError(err, 'No se pudo guardar el documento. Probá de nuevo.'), 'bad');
    }
  });
}

// ---------------------------------------------------------------------
// FORMULARIO CARGAR EVALUACIÓN (desde la ficha del paciente)
// ---------------------------------------------------------------------
// El profesional carga la evaluación acá, no en Agenda (que es de la
// secretaría y solo para casuales sin legajo). GATE: solo si el paciente
// fue ATENDIDO HOY: asignado en la grilla + paciente y profesional
// presentes hoy (ver autoresElegiblesHoy en utils/evaluacion.js).
// El autor se elige entre esos "autores" elegibles. El informe sigue la
// PLANTILLA de secciones y, al guardar, genera un PDF que se descarga y se
// adjunta a la historia clínica. `paciente` = objeto completo (para el
// PDF); `evalsPaciente` = sus informes (para prellenar lo ya cargado hoy).
async function abrirFormEvaluacion(paciente, evalsPaciente = []) {
  const pacienteId = paciente.id;
  const hoy = hoyISO();

  let turnos = [];
  try {
    const [asignaciones, asistenciasHoy, fichajesHoy] = await Promise.all([
      asignacionModel.listarPorPaciente(pacienteId, { soloVigentes: true }),
      asistenciaModel.listarAsistenciasPorFecha(hoy),
      asistenciaProfModel.listarPorFecha(hoy),
    ]);

    const pacientePresente = asistenciasHoy.some(a => String(a.paciente_id) === String(pacienteId) && a.estado === 'presente');
    const idsProfPresentes = new Set(
      fichajesHoy.filter(f => f.estado === 'presente').map(f => String(f.profesional_id))
    );

    turnos = autoresDelUsuario(autoresElegiblesHoy({ asignaciones, pacientePresente, idsProfPresentes }), perfilActual());
  } catch (err) {
    console.error('Error buscando la atención de hoy:', err);
    toast('No se pudo consultar la atención de hoy. Revisá la conexión.', 'bad');
    return;
  }
  if (!turnos.length) {
    toast('Este paciente todavía no figura atendido hoy: marcá presente al paciente y a su profesional de la grilla en Asistencia.', 'bad');
    return;
  }

  abrirEditorInforme({
    paciente,
    autores: turnos,
    datosPorProf: cargadoHoyPorProf(evalsPaciente, hoy, t => t !== TIPO_CERTIFICADO.key),
    alGuardar: (r) => guardarYAdjuntar(paciente, r),
  });
}

// ---------------------------------------------------------------------
// EVALUACIÓN / CERTIFICADO (ocasional, desde la ficha del paciente)
// ---------------------------------------------------------------------
// Se hace cuando alguien lo pide, cualquier día: NO exige que el
// paciente haya venido hoy, pero sí que su asistencia con ese profesional
// esté confirmada alguna vez (ver autoresCertificado en utils/evaluacion.js).
async function abrirFormCertificado(paciente, evalsPaciente = []) {
  const pacienteId = paciente.id;
  const hoy = hoyISO();

  let autores = [];
  try {
    const [asignaciones, asistencias] = await Promise.all([
      asignacionModel.listarPorPaciente(pacienteId),
      asistenciaModel.listarPorPacienteRango(pacienteId, '2000-01-01', hoy),
    ]);
    const fechasPresente = asistencias.filter(a => a.estado === 'presente').map(a => a.fecha);
    autores = autoresDelUsuario(autoresCertificado({ asignaciones, fechasPresente }), perfilActual());
  } catch (err) {
    console.error('Error buscando la asistencia del paciente:', err);
    toast('No se pudo consultar la asistencia del paciente. Revisá la conexión.', 'bad');
    return;
  }
  if (!autores.length) {
    toast('Para hacer una evaluación o certificado, el paciente tiene que haber asistido al menos una vez con ese profesional (presente en Asistencia mientras estaba en su grilla).', 'bad');
    return;
  }

  abrirEditorInforme({
    paciente,
    autores,
    datosPorProf: cargadoHoyPorProf(evalsPaciente, hoy, t => t === TIPO_CERTIFICADO.key),
    vista: {
      tipos: [TIPO_CERTIFICADO],
      titulo: 'Evaluación / certificado',
      etiquetaProf: 'Profesional que firma (lo atendió) *',
      nota: 'Documento ocasional. Al guardar se genera el PDF con el membrete y se adjunta a la historia clínica.',
    },
    alGuardar: (r) => guardarYAdjuntar(paciente, r),
  });
}

// Lo que cada profesional ya cargó HOY de ese tipo de documento (para
// prellenar el editor: guardar de nuevo el mismo día lo actualiza).
function cargadoHoyPorProf(evalsPaciente, hoy, esDelTipo) {
  const porProf = {};
  evalsPaciente
    .filter(ev => ev.fecha === hoy && esDelTipo(ev.tipo))
    .forEach(ev => { porProf[String(ev.profesional_id)] = parseEvaluacion(ev.contenido); });
  return porProf;
}

// Guarda el informe / certificado del paciente, genera el PDF (se
// descarga) y lo adjunta a su historia clínica. Si el adjunto falla, el
// documento ya quedó guardado igual.
async function guardarYAdjuntar(paciente, { datos, contenido, autor, turnoId }) {
  const hoy = hoyISO();
  await evaluacionModel.guardarEvaluacion({
    pacienteId: paciente.id,
    profesionalId: autor.profesional_id,
    fecha: hoy,
    contenido,
    turnoId,
    tipo: datos.tipo,
  });

  try {
    const { generarInformeEvaluacion } = await import('../utils/informePdf.js');
    const { blob, filename } = await generarInformeEvaluacion({
      paciente, profesional: autor.profesionales || {}, fecha: hoy, informe: datos,
    });
    const archivo = new File([blob], filename, { type: 'application/pdf' });
    await documentoModel.guardarDocumento({
      pacienteId: paciente.id, tipo: CATEGORIA_INFORMES, archivo, fechaEmision: hoy,
      observaciones: `${datos.titulo} — ${autor.profesionales?.nombre_completo || ''}`.trim(),
    });
    toast('Guardado y adjuntado a la historia clínica.');
  } catch (errPdf) {
    console.error('Documento guardado, pero falló el PDF/adjunto:', errPdf);
    toast('Se guardó, pero no se pudo adjuntar el PDF.', 'bad');
  }

  await abrirHistoria(paciente.id); // refresca el apartado + el documento
}

// Reimprime el PDF de un informe ya guardado (desde su botón en la historia
// clínica). Solo descarga; no vuelve a adjuntar.
async function descargarPdfEvaluacion(paciente, ev) {
  try {
    const { generarInformeEvaluacion } = await import('../utils/informePdf.js');
    await generarInformeEvaluacion({
      paciente,
      profesional: ev.profesionales || {},
      fecha: ev.fecha,
      informe: parseEvaluacion(ev.contenido),
    });
  } catch (err) {
    console.error('Error generando el PDF del informe:', err);
    toast('No se pudo generar el PDF. Probá de nuevo.', 'bad');
  }
}

// Abre la PREVISUALIZACIÓN (solo lectura) de un informe guardado, con la
// misma hoja del editor. La descarga del PDF queda para imprimir. Solo el
// informe de HOY se puede editar (por si se cargó mal ese mismo día); los de
// días anteriores quedan solo lectura para no corromper lo ya registrado.
function abrirVistaEvaluacion(paciente, ev, evalsPaciente = []) {
  const editable = ev.fecha === hoyISO();
  const inf = parseEvaluacion(ev.contenido);
  document.body.insertAdjacentHTML('beforeend', renderVistaEvaluacion(paciente, ev, inf, editable));
  const overlay = document.getElementById('overlay-vista-eval');
  const cerrar = () => overlay.remove();

  overlay.querySelectorAll('[data-cerrar]').forEach(b => b.addEventListener('click', cerrar));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
  document.getElementById('btn-vista-pdf').addEventListener('click', () => descargarPdfEvaluacion(paciente, ev));

  // Solo el informe de hoy: botón Editar → abre el editor (prellenado).
  const btnEditar = document.getElementById('btn-vista-editar');
  if (btnEditar) btnEditar.addEventListener('click', () => {
    cerrar();
    if (ev.tipo === TIPO_CERTIFICADO.key) abrirFormCertificado(paciente, evalsPaciente);
    else abrirFormEvaluacion(paciente, evalsPaciente);
  });
}

// ---------------------------------------------------------------------
// VER / DESCARGAR DOCUMENTO
// ---------------------------------------------------------------------
async function verDocumento(storagePath) {
  if (!storagePath) {
    toast('Este documento no tiene un archivo para ver.', 'bad');
    return;
  }
  try {
    const url = await documentoModel.urlDocumento(storagePath);
    window.open(url, '_blank'); // abre en otra pestaña (ver o descargar)
  } catch (err) {
    console.error('Error abriendo documento:', err);
    toast('No se pudo abrir el archivo. Probá de nuevo.', 'bad');
  }
}

// ---------------------------------------------------------------------
// CATEGORÍAS DE LA HISTORIA CLÍNICA (pestaña "Categorías")
// ---------------------------------------------------------------------
async function cargarCategorias() {
  const caja = document.getElementById('categorias-tabla');
  caja.innerHTML = htmlCargando('Cargando categorías…');
  try {
    categoriasCargadas = await categoriaModel.listarCategorias();
    caja.innerHTML = renderListaCategorias(categoriasCargadas);
  } catch (err) {
    console.error('Error listando las categorías:', err);
    caja.innerHTML = htmlError('No se pudieron cargar las categorías. Revisá la conexión.');
  }
}

// Alta (sin `categoria`) o edición de nombre e ícono (con `categoria`).
function abrirFormCategoria(categoria = {}) {
  document.body.insertAdjacentHTML('beforeend', renderModalCategoria(categoria));
  const overlay = document.getElementById('overlay-categoria');
  const form = document.getElementById('form-categoria');
  const cerrar = () => overlay.remove();

  overlay.querySelectorAll('[data-cerrar]').forEach(b => b.addEventListener('click', cerrar));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
  form.querySelector('input')?.focus();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const titulo = fd.get('titulo').trim();
    const icono = fd.get('icono');
    if (!titulo) return;
    if (nombreRepetido(categoriasCargadas, titulo, categoria.id)) {
      toast('Ya hay una categoría con ese nombre.', 'bad');
      return;
    }

    try {
      if (categoria.id) {
        await categoriaModel.editarCategoria(categoria.id, { titulo, icono });
      } else {
        await categoriaModel.crearCategoria({
          titulo, icono, clave: claveDesdeNombre(titulo), orden: siguienteOrden(categoriasCargadas),
        });
      }
      cerrar();
      await cargarCategorias();
      toast(categoria.id ? 'Categoría actualizada.' : `"${titulo}" agregada a la historia clínica.`);
    } catch (err) {
      console.error('Error guardando la categoría:', err);
      toast(mensajeError(err, 'No se pudo guardar. Probá de nuevo.'), 'bad');
    }
  });
}

// Elimina una categoría VACÍA. Si tiene documentos no se borra (se
// esconderían papeles de los legajos): se avisa cuántos hay.
async function eliminarCategoria({ id, clave, titulo }) {
  let cantidad = 0;
  try {
    cantidad = await categoriaModel.contarDocumentos(clave);
  } catch (err) {
    console.error('No se pudieron contar los documentos de la categoría:', err);
    toast('No se pudo revisar la categoría. Revisá la conexión.', 'bad');
    return;
  }
  if (cantidad) {
    toast(`"${titulo}" tiene ${cantidad === 1 ? '1 documento' : `${cantidad} documentos`} en las historias clínicas: no se puede eliminar.`, 'bad');
    return;
  }

  const seguro = await confirmar({
    titulo: `¿Eliminar "${titulo}"?`,
    mensaje: 'Está vacía: deja de aparecer en las historias clínicas y al agregar un documento.',
    textoOk: 'Sí, eliminar',
    textoCancelar: 'No, dejarla',
    peligro: true,
  });
  if (!seguro) return;

  try {
    await categoriaModel.eliminarCategoria(id);
    await cargarCategorias();
    toast(`"${titulo}" eliminada.`);
  } catch (err) {
    console.error('Error eliminando la categoría:', err);
    toast(mensajeError(err, 'No se pudo eliminar. Probá de nuevo.'), 'bad');
  }
}
