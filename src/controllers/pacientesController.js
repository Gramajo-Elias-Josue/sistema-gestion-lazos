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
import * as turnoModel from '../models/turnoModel.js';
import * as asignacionModel from '../models/asignacionModel.js';
import * as asistenciaModel from '../models/asistenciaModel.js';
import * as asistenciaProfModel from '../models/asistenciaProfesionalModel.js';
import {
  renderEstructura, renderTabla, renderFicha, renderHistoria, renderCategorias,
  renderFormPaciente, renderFormDocumento, renderFormEvaluacion, renderVistaEvaluacion,
} from '../views/pacientesView.js';
import { htmlCargando, htmlError, toast, confirmar } from '../utils/ui.js';
import { hoyISO } from '../utils/fechas.js';
import { validarPaciente, validarDocumento, normalizarDni } from '../utils/validacion.js';
import { parseEvaluacion, serializarEvaluacion, tituloPorTipo, autoresElegiblesHoy } from '../utils/evaluacion.js';
import { mensajeError } from '../utils/errores.js';

// Punto de entrada de la sección Pacientes (lo llama el router).
export async function iniciarPacientes() {
  const contenedor = document.getElementById('v-pacientes');
  contenedor.innerHTML = renderEstructura();
  await cargarLista();
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
    caja.innerHTML = renderTabla(pacientes);

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
  } catch (err) {
    console.error('Error listando pacientes:', err);
    caja.innerHTML = htmlError('No se pudo cargar la lista de pacientes. Revisá la conexión.');
  }
}

// Muestra el listado y oculta el detalle (legajo / historia).
function mostrarLista() {
  document.getElementById('lista-pac').classList.remove('hidden');
  document.getElementById('ficha-pac').classList.add('hidden');
}

// Prepara el contenedor de detalle (legajo o historia) y lo muestra.
function abrirDetalle() {
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
    const [paciente, evaluaciones] = await Promise.all([
      pacienteModel.obtenerPaciente(id),
      evaluacionModel.listarPorPaciente(id).catch(() => []),
    ]);
    const docs = paciente.documentos || [];
    ficha.innerHTML = renderHistoria(paciente, evaluaciones);
    document.getElementById('btn-volver').addEventListener('click', cargarLista);
    document.getElementById('btn-ver-legajo').addEventListener('click', () => abrirFicha(id));

    // Apartado de evaluaciones (no se re-renderiza al buscar): botón para
    // cargar una nueva y un botón por evaluación para reimprimir su PDF.
    const btnNuevaEval = document.querySelector('.btn-nueva-eval');
    if (btnNuevaEval) btnNuevaEval.addEventListener('click', () => abrirFormEvaluacion(paciente, evaluaciones));
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
      cats.innerHTML = renderCategorias(docs, e.target.value);
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
      mensaje: `${nombre} deja de aparecer en las listas del día a día. Su historia clínica se conserva y podés volver a activarlo cuando quieras.`,
      textoOk: 'Desactivar',
      textoCancelar: 'Volver',
      peligro: true,
    });
    if (!seguir) return;
  }
  try {
    await pacienteModel.cambiarEstadoPaciente(id, desactivar ? 'inactivo' : 'activo');
    toast(desactivar ? `${nombre} quedó como inactivo.` : `${nombre} está activo de nuevo.`);
    await cargarLista();
  } catch (err) {
    console.error('Error cambiando estado:', err);
    toast(mensajeError(err, 'No se pudo hacer el cambio. Probá de nuevo.'), 'bad');
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
function abrirFormDocumento(pacienteId, tipoDefault = 'cud') {
  document.body.insertAdjacentHTML('beforeend', renderFormDocumento(tipoDefault));
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
// secretaría). GATE: solo si el paciente fue ATENDIDO HOY, por cualquiera
// de las dos vías (ver autoresElegiblesHoy en utils/evaluacion.js):
//   - CASUAL: turno de hoy marcado "Atendido".
//   - DIARIO: asignado en la grilla + paciente y profesional presentes hoy.
// El autor se elige entre esos "autores" elegibles. La evaluación sigue la
// PLANTILLA de secciones y, al guardar, genera un PDF que se descarga y se
// adjunta a la historia clínica. `paciente` = objeto completo (para el
// PDF); `evalsPaciente` = sus evaluaciones (para prellenar lo ya cargado hoy).
async function abrirFormEvaluacion(paciente, evalsPaciente = []) {
  const pacienteId = paciente.id;
  const hoy = hoyISO();

  let turnos = [];
  try {
    const [turnosAtendidos, asignaciones, asistenciasHoy, fichajesHoy] = await Promise.all([
      turnoModel.listarAtendidosPacienteFecha(pacienteId, hoy),
      asignacionModel.listarPorPaciente(pacienteId, { soloVigentes: true }),
      asistenciaModel.listarAsistenciasPorFecha(hoy),
      asistenciaProfModel.listarPorFecha(hoy),
    ]);

    const pacientePresente = asistenciasHoy.some(a => String(a.paciente_id) === String(pacienteId) && a.estado === 'presente');
    const idsProfPresentes = new Set(
      fichajesHoy.filter(f => f.estado === 'presente').map(f => String(f.profesional_id))
    );

    turnos = autoresElegiblesHoy({ turnosAtendidos, asignaciones, pacientePresente, idsProfPresentes });
  } catch (err) {
    console.error('Error buscando la atención de hoy:', err);
    toast('No se pudo consultar la atención de hoy. Revisá la conexión.', 'bad');
    return;
  }
  if (!turnos.length) {
    toast('Este paciente todavía no figura atendido hoy. Para casuales: marcá su turno como Atendido. Para pacientes de la grilla: marcá presente al paciente y al profesional en Asistencia.', 'bad');
    return;
  }

  // Prellenado: informe ya cargado hoy por cada profesional (upsert diario).
  const datosPorProf = {};
  evalsPaciente
    .filter(ev => ev.fecha === hoy)
    .forEach(ev => { datosPorProf[String(ev.profesional_id)] = parseEvaluacion(ev.contenido); });

  document.body.insertAdjacentHTML('beforeend', renderFormEvaluacion(paciente, turnos, datosPorProf));
  const overlay = document.getElementById('overlay-eval');
  const form = document.getElementById('form-eval');
  const selProf = document.getElementById('eval-prof');
  const selTipo = document.getElementById('eval-tipo');
  const inputTitulo = document.getElementById('eval-titulo');
  const txtCuerpo = document.getElementById('eval-cuerpo'); // la hoja de escritura
  const cerrar = () => overlay.remove();

  overlay.querySelectorAll('[data-cerrar]').forEach(b => b.addEventListener('click', cerrar));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });

  // Al cambiar el TIPO, se sugiere el título por defecto de ese tipo.
  selTipo.addEventListener('change', () => { inputTitulo.value = tituloPorTipo(selTipo.value); });

  // Al cambiar de PROFESIONAL, recarga tipo/título/cuerpo con lo que ese
  // profesional ya cargó hoy (o el informe en blanco si todavía no cargó).
  selProf.addEventListener('change', () => {
    const inf = datosPorProf[selProf.value] || { tipo: 'mensual', titulo: tituloPorTipo('mensual'), cuerpo: '' };
    selTipo.value = inf.tipo || 'mensual';
    inputTitulo.value = inf.titulo || tituloPorTipo(selTipo.value);
    txtCuerpo.value = inf.cuerpo || '';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Arma el informe: tipo + título + cuerpo (lo escrito en la hoja).
    const datos = { tipo: selTipo.value, titulo: inputTitulo.value, cuerpo: txtCuerpo.value };
    if (!(datos.cuerpo || '').trim()) {
      toast('Escribí el informe antes de guardar.', 'bad');
      return;
    }

    const opt = selProf.options[selProf.selectedIndex];
    const turnoSel = turnos.find(t => String(t.profesional_id) === String(selProf.value)) || {};
    const btn = document.getElementById('btn-guardar-eval');
    btn.disabled = true;
    btn.textContent = 'Guardando…';
    try {
      // 1) Guarda el informe (serializado a JSON) en la base.
      await evaluacionModel.guardarEvaluacion({
        pacienteId,
        profesionalId: selProf.value,
        fecha: hoy,
        contenido: serializarEvaluacion(datos),
        // Vacío = paciente de la grilla, sin turno (no confundir con la
        // columna uuid, que rechaza "" tanto como rechazaría "null").
        turnoId: (opt && opt.dataset.turno) ? opt.dataset.turno : null,
        // El tipo va en la clave: así el informe del mes NO pisa la
        // evaluación diaria del mismo paciente y el mismo día.
        tipo: datos.tipo,
      });

      // 2) Genera el PDF (se descarga) y lo adjunta a la historia clínica.
      //    Si el adjunto falla, el informe ya quedó guardado igual.
      try {
        const { generarInformeEvaluacion } = await import('../utils/informePdf.js');
        const { blob, filename } = await generarInformeEvaluacion({
          paciente, profesional: turnoSel.profesionales || {}, fecha: hoy, informe: datos,
        });
        const archivo = new File([blob], filename, { type: 'application/pdf' });
        await documentoModel.guardarDocumento({
          pacienteId, tipo: 'informe', archivo, fechaEmision: hoy,
          observaciones: `${datos.titulo} — ${turnoSel.profesionales?.nombre_completo || ''}`.trim(),
        });
        toast('Informe guardado y adjuntado a la historia clínica.');
      } catch (errPdf) {
        console.error('Informe guardado, pero falló el PDF/adjunto:', errPdf);
        toast('Se guardó el informe, pero no se pudo adjuntar el PDF.', 'bad');
      }

      cerrar();
      await abrirHistoria(pacienteId); // refresca el apartado + el documento
    } catch (err) {
      console.error('Error guardando el informe:', err);
      btn.disabled = false;
      btn.textContent = 'Guardar y generar PDF';
      toast(mensajeError(err, 'No se pudo guardar el informe. Probá de nuevo.'), 'bad');
    }
  });
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
  if (btnEditar) btnEditar.addEventListener('click', () => { cerrar(); abrirFormEvaluacion(paciente, evalsPaciente); });
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
