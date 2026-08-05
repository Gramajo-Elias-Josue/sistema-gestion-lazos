// =====================================================================
// CONTROLADOR: Grilla de atención
// ---------------------------------------------------------------------
// CAPA CONTROLADOR. Maneja la planilla del centro dentro del panel de
// inicio: pacientes en las filas (automático), sectores en las columnas
// y, en cada celda, el nombre del profesional escrito A MANO.
//
// Se usa como una planilla de Excel:
//   - Se toca la celda y se escribe (con sugerencias de los cargados).
//   - Enter o Tab guardan y pasan a la celda siguiente.
//   - Escape cancela; borrar el texto vacía la celda.
// El sistema no completa ni acomoda nada por su cuenta.
// =====================================================================

import * as pacienteModel from '../models/pacienteModel.js';
import * as profesionalModel from '../models/profesionalModel.js';
import * as asignacionModel from '../models/asignacionModel.js';
import * as sectorModel from '../models/sectorModel.js';
import {
  renderGrilla, renderInputCelda, renderModalSector,
  contenidoCelda, claveCelda, nombreDeCelda,
} from '../views/grillaAtencionView.js';
import { htmlCargando, htmlError, toast, confirmar } from '../utils/ui.js';
import { normalizar } from '../utils/areas.js';
import { perfilActual } from '../sesion.js';
import { puedeOperar } from '../permisos.js';

// Estado de la grilla mientras la sección está abierta.
let pacientes = [];
let profesionales = [];
let sectores = [];
let celdas = {};      // { 'pacienteId|sector': asignación }
let editable = true;
let editando = null;  // la celda que tiene el campo abierto
let caja = null;      // contenedor de la grilla

// Arranca la grilla dentro del contenedor que le pasa el inicio.
export async function iniciarGrillaAtencion(contenedor) {
  editable = puedeOperar(perfilActual());
  caja = contenedor;
  contenedor.innerHTML = htmlCargando('Cargando la grilla…');

  try {
    const [pacs, profs, secs, asignaciones] = await Promise.all([
      pacienteModel.listarPacientes({ soloActivos: true }),
      profesionalModel.listarProfesionales({ soloActivos: true }),
      sectorModel.listarSectores(),
      asignacionModel.listarVigentes(),
    ]);
    pacientes = pacs;
    profesionales = profs;
    sectores = secs;
    celdas = {};
    asignaciones.forEach(a => { celdas[claveCelda(a.paciente_id, a.sector)] = a; });

    pintar();
    engancharEventos(contenedor);
  } catch (err) {
    console.error('Error cargando la grilla de atención:', err);
    contenedor.innerHTML = htmlError('No se pudo cargar la grilla. Revisá la conexión.');
  }
}

function pintar() {
  // Repintar rehace el buscador: se conserva lo escrito para no perder
  // el filtro al agregar o quitar una columna.
  const buscado = caja.querySelector('#ga-buscar')?.value ?? '';
  caja.innerHTML = renderGrilla({ pacientes, sectores, celdas, profesionales, editable });
  const buscador = caja.querySelector('#ga-buscar');
  if (buscador) buscador.value = buscado;
  aplicarFiltro();
}

// Filtra las filas por lo escrito en el buscador (nombre del paciente o
// de cualquiera de sus profesionales). No consulta la base: solo esconde
// filas, así responde al instante.
function aplicarFiltro() {
  const buscador = caja.querySelector('#ga-buscar');
  if (!buscador) return;
  const termino = (buscador.value || '').trim().toLowerCase();
  const filas = [...caja.querySelectorAll('.ga-tabla tbody tr')];
  let visibles = 0;

  filas.forEach(fila => {
    const coincide = !termino || (fila.dataset.buscar || '').includes(termino);
    fila.style.display = coincide ? '' : 'none';
    if (coincide) visibles++;
  });

  const contador = caja.querySelector('#ga-contador');
  if (contador) {
    contador.textContent = termino
      ? `${visibles} de ${filas.length} pacientes`
      : `${filas.length} ${filas.length === 1 ? 'paciente' : 'pacientes'}`;
  }
}

// Un solo listener para toda la tabla (delegación): sobrevive a los
// re-render porque está en el contenedor, no en cada celda.
// La marca `data-enganchado` evita duplicarlos si se vuelve a entrar a la
// sección sin que el contenedor se haya recreado (si no, cada clic se
// procesaría dos o tres veces).
function engancharEventos(contenedor) {
  if (contenedor.dataset.enganchado) return;
  contenedor.dataset.enganchado = '1';

  // El buscador anda siempre; editar, solo con permiso para operar.
  contenedor.addEventListener('click', (e) => {
    if (!editable) return;
    if (e.target.closest('#ga-add-sector')) { pedirSector(); return; }
    const quitar = e.target.closest('.ga-del-sector');
    if (quitar) { quitarSector(quitar.dataset); return; }
    if (e.target.closest('.ga-input')) return;   // clics dentro del campo
    const celda = e.target.closest('.ga-celda');
    if (celda && celda !== editando) abrirCelda(celda);
  });

  // Turno del paciente (la columna "Hs de asist").
  contenedor.addEventListener('change', (e) => {
    if (!editable) return;
    const sel = e.target.closest('.ga-turno');
    if (sel) guardarTurno(sel.dataset.paciente, sel.value);
  });

  // Buscador: filtra las filas mientras se escribe.
  contenedor.addEventListener('input', (e) => {
    if (e.target.id === 'ga-buscar') aplicarFiltro();
  });
}

// ---------------------------------------------------------------------
// EDICIÓN DE LA CELDA (como en Excel)
// ---------------------------------------------------------------------
function abrirCelda(celda) {
  if (editando) cerrarCelda();
  editando = celda;
  const a = celdas[claveCelda(celda.dataset.paciente, celda.dataset.sector)];
  celda.classList.add('editando');
  celda.innerHTML = renderInputCelda(nombreDeCelda(a) || '');

  const input = celda.querySelector('input');
  input.focus();
  input.select();

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  { e.preventDefault(); guardar(celda, input.value, 'abajo'); }
    if (e.key === 'Tab')    { e.preventDefault(); guardar(celda, input.value, e.shiftKey ? 'izquierda' : 'derecha'); }
    if (e.key === 'Escape') { e.preventDefault(); cerrarCelda(); }
  });
  // Salir de la celda (clic en otro lado) también guarda, como en Excel.
  input.addEventListener('blur', () => { if (editando === celda) guardar(celda, input.value); });
}

// Devuelve la celda a su estado de lectura, sin guardar.
function cerrarCelda() {
  if (!editando) return;
  const celda = editando;
  editando = null;
  celda.classList.remove('editando');
  refrescarCelda(celda);
}

// Re-dibuja una celda a partir del estado actual.
function refrescarCelda(celda) {
  const a = celdas[claveCelda(celda.dataset.paciente, celda.dataset.sector)];
  celda.innerHTML = contenidoCelda(a);
  if (a?.id) celda.dataset.asignacion = a.id; else delete celda.dataset.asignacion;
  refrescarBusqueda(celda.closest('tr'), celda.dataset.paciente);
}

// Rehace el texto de búsqueda de la fila (paciente + sus profesionales)
// después de editar una celda, para que el buscador encuentre al que se
// acaba de cargar sin tener que repintar toda la grilla.
function refrescarBusqueda(fila, pacienteId) {
  if (!fila) return;
  const paciente = pacientes.find(p => String(p.id) === String(pacienteId));
  const nombres = sectores
    .map(s => nombreDeCelda(celdas[claveCelda(pacienteId, s.clave)]))
    .filter(Boolean);
  fila.dataset.buscar = [paciente?.nombre_completo, ...nombres].filter(Boolean).join(' ').toLowerCase();
}

// Guarda lo escrito y, si corresponde, pasa a la celda siguiente.
async function guardar(celda, texto, mover = null) {
  const escrito = (texto || '').trim();
  const anterior = nombreDeCelda(celdas[claveCelda(celda.dataset.paciente, celda.dataset.sector)]) || '';

  editando = null;
  celda.classList.remove('editando');
  refrescarCelda(celda);
  if (mover) irA(celda, mover);

  // Sin cambios, no se toca la base.
  if (escrito === anterior) return;

  const pacienteId = celda.dataset.paciente;
  const sector = celda.dataset.sector;
  const asignacionId = celda.dataset.asignacion || null;

  // Celda vaciada: se cierra la asignación (queda como historia).
  if (!escrito) {
    if (!asignacionId) return;
    try {
      await asignacionModel.cerrarCelda(asignacionId, 'Quitada de la grilla');
      delete celdas[claveCelda(pacienteId, sector)];
      refrescarCelda(celda);
    } catch (err) {
      console.error('Error vaciando la celda:', err);
      refrescarCelda(celda);
      toast('No se pudo vaciar la celda. Probá de nuevo.', 'bad');
    }
    return;
  }

  // Si lo escrito coincide con un profesional cargado, se guarda el
  // vínculo real; si no, queda como nombre libre (planilla de papel).
  const profesional = profesionales.find(p => normalizar(p.nombre_completo) === normalizar(escrito));

  try {
    const guardada = await asignacionModel.guardarCelda({
      pacienteId,
      sector,
      profesionalId: profesional?.id ?? null,
      profesionalNombre: profesional ? null : escrito,
    });
    celdas[claveCelda(pacienteId, sector)] = guardada;
    refrescarCelda(celda);
  } catch (err) {
    console.error('Error guardando la celda de la grilla:', err);
    refrescarCelda(celda);
    toast('No se pudo guardar. Probá de nuevo.', 'bad');
  }
}

// Salta a la celda de al lado (Tab) o a la de abajo (Enter), como en
// una planilla. Si no hay, se queda donde está.
function irA(celda, direccion) {
  const fila = celda.parentElement;
  const columnas = [...fila.querySelectorAll('.ga-celda')];
  const i = columnas.indexOf(celda);
  let destino = null;

  if (direccion === 'derecha') destino = columnas[i + 1];
  else if (direccion === 'izquierda') destino = columnas[i - 1];
  else if (direccion === 'abajo') {
    const siguiente = fila.nextElementSibling;
    destino = siguiente?.querySelectorAll('.ga-celda')[i];
  }
  if (destino) abrirCelda(destino);
}

// ---------------------------------------------------------------------
// TURNO DEL PACIENTE ("Hs de asist")
// ---------------------------------------------------------------------
async function guardarTurno(pacienteId, turno) {
  try {
    await pacienteModel.actualizarPaciente(pacienteId, { turno: turno || null });
    const paciente = pacientes.find(p => String(p.id) === String(pacienteId));
    if (paciente) paciente.turno = turno || null;
  } catch (err) {
    console.error('Error guardando el turno del paciente:', err);
    toast('No se pudo guardar el turno. Probá de nuevo.', 'bad');
  }
}

// ---------------------------------------------------------------------
// SECTOR NUEVO (columna)
// ---------------------------------------------------------------------
function pedirSector() {
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

    // La clave es el nombre sin tildes ni espacios: identifica la columna.
    const clave = normalizar(etiqueta).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    if (sectores.some(s => s.clave === clave)) {
      toast('Ya existe una columna con ese nombre.', 'bad');
      return;
    }

    try {
      // Si esa columna se había quitado, el modelo la reactiva con lo
      // que tenía cargado en vez de crear una nueva.
      const sector = await sectorModel.crearSector({
        etiqueta, clave, orden: (sectores.at(-1)?.orden ?? 0) + 1,
      });
      sectores.push(sector);
      cerrar();
      pintar();
      toast(`Columna "${etiqueta}" agregada.`);
    } catch (err) {
      console.error('Error creando el sector:', err);
      toast('No se pudo agregar la columna. Probá de nuevo.', 'bad');
    }
  });
}

// Quita una columna de la grilla. SIEMPRE pregunta antes, y avisa cuántos
// pacientes tienen algo cargado ahí: no es lo mismo sacar una columna
// vacía que una con medio centro adentro.
async function quitarSector({ sectorId, sector, etiqueta }) {
  let cargadas = 0;
  try {
    cargadas = await sectorModel.contarCeldas(sector);
  } catch (err) {
    console.error('No se pudo contar lo cargado en esa columna:', err);
  }

  const detalle = cargadas
    ? `${cargadas === 1 ? 'Hay 1 paciente' : `Hay ${cargadas} pacientes`} con un profesional cargado en esa columna. Lo cargado se conserva por si volvés a agregarla, pero deja de verse en la grilla.`
    : 'La columna está vacía.';

  const seguro = await confirmar({
    titulo: `¿Quitar la columna ${etiqueta}?`,
    mensaje: detalle,
    textoOk: 'Sí, quitar',
    textoCancelar: 'No, dejarla',
    peligro: true,
  });
  if (!seguro) return;

  try {
    await sectorModel.desactivarSector(sectorId);
    sectores = sectores.filter(s => String(s.id) !== String(sectorId));
    pintar();
    toast(`Columna "${etiqueta}" quitada.`);
  } catch (err) {
    console.error('Error quitando el sector:', err);
    toast('No se pudo quitar la columna. Probá de nuevo.', 'bad');
  }
}
