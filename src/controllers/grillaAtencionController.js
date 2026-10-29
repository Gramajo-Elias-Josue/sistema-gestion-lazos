// =====================================================================
// CONTROLADOR: Grilla de atención
// ---------------------------------------------------------------------
// CAPA CONTROLADOR. Maneja la organización general de turnos del centro:
// separada en los dos turnos del centro (mañana / tarde, en pestañas),
// una tarjeta por PROFESIONAL con las franjas de 30 minutos de ese turno
// y, en cada franja, el PACIENTE que tiene esa hora con él — como la
// planilla que se llevaba en papel.
//
// Se usa como una planilla de Excel:
//   - Se toca la celda y se escribe (con sugerencias de los pacientes
//     cargados). Enter baja a la franja siguiente; Shift+Tab sube.
//   - Escape cancela; borrar el texto vacía la celda.
// El sistema no completa ni acomoda nada por su cuenta, pero sí avisa si
// el paciente no existe, si esa franja ya tiene a otro, o si el paciente
// ya está citado a esa hora con otro profesional.
//
// Los turnos CASUALES de hoy (sección Turnos) también se ven en su franja,
// marcados como "Casual" y sin poder tocarlos. No se guardan en la grilla:
// se leen de los turnos del día, así que mañana ya no aparecen.
// =====================================================================

import * as pacienteModel from '../models/pacienteModel.js';
import * as profesionalModel from '../models/profesionalModel.js';
import * as asignacionModel from '../models/asignacionModel.js';
import * as sectorModel from '../models/sectorModel.js';
import * as turnoModel from '../models/turnoModel.js';
import {
  renderGrilla, renderInputCelda, contenidoCelda,
  claveCelda, pacienteDeCelda, franjasDe, casualesPorCelda,
} from '../views/grillaAtencionView.js';
import { htmlCargando, htmlError, toast } from '../utils/ui.js';
import { normalizar } from '../utils/areas.js';
import { ahoraHHMM, hoyISO } from '../utils/fechas.js';
import { turnoSegunHora, turnosDe } from '../utils/turnosCentro.js';
import { perfilActual } from '../sesion.js';
import { puedeOperar } from '../permisos.js';

// Estado de la grilla mientras la sección está abierta.
let pacientes = [];
let profesionales = [];
let sectores = [];
let celdas = {};      // { 'profesionalId|hora': asignación }
let editable = true;
let editando = null;  // la celda que tiene el campo abierto
let caja = null;      // contenedor de la grilla
let turno = 'manana'; // pestaña visible: 'manana' | 'tarde'
let casuales = {};    // { 'profesionalId|franja': turno casual de HOY } (solo para ver)
let propia = false;   // true = grilla de UN profesional (el logueado), solo lectura

// Arranca la grilla dentro del contenedor que le pasa el inicio.
// `soloProfesionalId`: el Inicio del profesional muestra solo SU tarjeta
// (sus horarios y pacientes), sin poder editar.
export async function iniciarGrillaAtencion(contenedor, { soloProfesionalId = null } = {}) {
  propia = !!soloProfesionalId;
  editable = !propia && puedeOperar(perfilActual());
  caja = contenedor;
  // Abre en el turno en curso: a la tarde nadie busca la mañana.
  turno = turnoSegunHora(ahoraHHMM());
  contenedor.innerHTML = htmlCargando('Cargando la grilla…');

  try {
    const [pacs, profs, secs, asignaciones, turnosHoy] = await Promise.all([
      pacienteModel.listarPacientes({ soloActivos: true }),
      profesionalModel.listarProfesionales({ soloActivos: true }),
      sectorModel.listarSectores(),
      asignacionModel.listarVigentes(),
      // Los turnos casuales de HOY se muestran en su franja. Son un
      // agregado: si esta consulta falla, la grilla carga igual sin ellos.
      turnoModel.listarTurnosPorFecha(hoyISO()).catch(err => {
        console.error('No se pudieron traer los turnos casuales de hoy:', err);
        return [];
      }),
    ]);
    pacientes = pacs;
    profesionales = propia ? profs.filter(p => String(p.id) === String(soloProfesionalId)) : profs;
    // Si el profesional trabaja en un solo turno, se abre en ese.
    if (propia && profesionales.length) {
      const suyos = turnosDe(profesionales[0]).map(t => t.clave);
      if (suyos.length === 1) turno = suyos[0];
    }
    sectores = secs;
    casuales = casualesPorCelda(turnosHoy);
    celdas = {};
    asignaciones.forEach(a => {
      // La celda vieja (sin profesional cargado o sin franja horaria) es
      // historia de la planilla anterior: no tiene dónde mostrarse acá.
      const hora = a.hora ? String(a.hora).slice(0, 5) : null;
      if (!a.profesional_id || !hora) return;
      celdas[claveCelda(a.profesional_id, hora)] = a;
    });

    pintar();
    engancharEventos(contenedor);
  } catch (err) {
    console.error('Error cargando la grilla de atención:', err);
    contenedor.innerHTML = htmlError('No se pudo cargar la grilla. Revisá la conexión.');
  }
}

function pintar() {
  // Repintar rehace el buscador: se conserva lo escrito para no perder
  // el filtro al recargar.
  const buscado = caja.querySelector('#ga-buscar')?.value ?? '';
  caja.innerHTML = renderGrilla({ profesionales, sectores, pacientes, celdas, editable, turno, casuales, propia });
  const buscador = caja.querySelector('#ga-buscar');
  if (buscador) buscador.value = buscado;
  aplicarFiltro();
}

// Filtra las tarjetas por lo escrito en el buscador (nombre del
// profesional, su sector, o cualquiera de sus pacientes de hoy). No
// consulta la base: solo muestra/esconde, así responde al instante.
function aplicarFiltro() {
  const buscador = caja.querySelector('#ga-buscar');
  if (!buscador) return;
  const termino = (buscador.value || '').trim().toLowerCase();
  const tarjetas = [...caja.querySelectorAll('[data-buscar]')];
  let visibles = 0;

  tarjetas.forEach(t => {
    const coincide = !termino || (t.dataset.buscar || '').includes(termino);
    t.style.display = coincide ? '' : 'none';
    if (coincide) visibles++;
  });

  const contador = caja.querySelector('#ga-contador');
  if (contador) {
    contador.textContent = termino
      ? `${visibles} de ${tarjetas.length} profesionales`
      : `${tarjetas.length} ${tarjetas.length === 1 ? 'profesional' : 'profesionales'}`;
  }

  actualizarCarrusel();
}

// ---------------------------------------------------------------------
// CARRUSEL DE TARJETAS (celular)
// ---------------------------------------------------------------------
// En pantalla ancha las tarjetas van lado a lado (lo resuelve el CSS con
// flex-wrap); en el celular, una a la vez con scroll-snap. El cartel
// "Profesional 2 de 9" y las flechas recién aparecen en el celular
// (PANTALLA_ANGOSTA) y pasando MINIMO_PAGINADO: con pocas alcanza con
// deslizar, no hace falta el adorno.
const PANTALLA_ANGOSTA = window.matchMedia('(max-width: 880px)');
const MINIMO_PAGINADO = 5;

// El listener se registra UNA sola vez, a nivel del módulo (no en cada
// entrada a la sección), y solo actualiza el estado de las flechas al
// CRUZAR el límite — no hace falta repintar nada, el CSS ya cambió solo.
PANTALLA_ANGOSTA.addEventListener('change', () => {
  if (caja?.isConnected) actualizarCarrusel();
});

// Las tarjetas que hoy se ven (el buscador puede haber escondido otras).
function tarjetasVisibles() {
  const pista = caja.querySelector('#ga-tarjetas');
  if (!pista) return [];
  return [...pista.querySelectorAll('.ga-tarjeta')].filter(t => t.style.display !== 'none');
}

// Cuál está al frente: la que tiene el borde izquierdo más cerca del
// borde de la pista. Se mide con getBoundingClientRect (posición real en
// pantalla) y no con offsetLeft, que se cuenta desde otro elemento y
// dejaba el índice corrido.
function tarjetaActual(pista, tarjetas) {
  const borde = pista.getBoundingClientRect().left;
  let cual = 0, minima = Infinity;
  tarjetas.forEach((t, i) => {
    const distancia = Math.abs(t.getBoundingClientRect().left - borde);
    if (distancia < minima) { minima = distancia; cual = i; }
  });
  return cual;
}

function actualizarCarrusel() {
  const pista = caja.querySelector('#ga-tarjetas');
  const pager = caja.querySelector('#ga-pager');
  if (!pista || !pager) return;

  const tarjetas = tarjetasVisibles();
  const conPaginado = PANTALLA_ANGOSTA.matches && tarjetas.length > MINIMO_PAGINADO;
  pager.hidden = !conPaginado;
  if (!conPaginado) return;   // pantalla ancha, o pocas tarjetas: sin adorno

  const actual = tarjetaActual(pista, tarjetas);
  caja.querySelector('#ga-pager-info').textContent =
    `Profesional ${actual + 1} de ${tarjetas.length}`;
  caja.querySelector('#ga-prev').disabled = actual === 0;
  caja.querySelector('#ga-next').disabled = actual >= tarjetas.length - 1;
}

// Flechas: llevan el carrusel a la tarjeta anterior o siguiente. El
// scroll suave y el encastre los hace el CSS.
function moverCarrusel(pasos) {
  const pista = caja.querySelector('#ga-tarjetas');
  const tarjetas = tarjetasVisibles();
  if (!pista || !tarjetas.length) return;
  const destino = Math.min(Math.max(tarjetaActual(pista, tarjetas) + pasos, 0), tarjetas.length - 1);
  const cuanto = tarjetas[destino].getBoundingClientRect().left - pista.getBoundingClientRect().left;
  pista.scrollBy({ left: cuanto, behavior: 'smooth' });
}

// Un solo listener para toda la grilla (delegación): sobrevive a los
// re-render porque está en el contenedor, no en cada celda.
// La marca `data-enganchado` evita duplicarlos si se vuelve a entrar a la
// sección sin que el contenedor se haya recreado (si no, cada clic se
// procesaría dos o tres veces).
function engancharEventos(contenedor) {
  if (contenedor.dataset.enganchado) return;
  contenedor.dataset.enganchado = '1';

  // El buscador y las flechas andan siempre; editar, solo con permiso.
  contenedor.addEventListener('click', (e) => {
    if (e.target.closest('#ga-prev')) return moverCarrusel(-1);
    if (e.target.closest('#ga-next')) return moverCarrusel(1);
    const pestana = e.target.closest('[data-turno]');
    if (pestana) return cambiarTurno(pestana.dataset.turno);

    if (!editable) return;
    if (e.target.closest('.ga-input')) return;   // clics dentro del campo
    const celda = e.target.closest('.ga-celda');
    if (celda && celda !== editando) abrirCelda(celda);
  });

  // Buscador: filtra las tarjetas mientras se escribe. El carrusel
  // vuelve al principio, si no queda mostrando el hueco donde estaba
  // parado antes de filtrar.
  contenedor.addEventListener('input', (e) => {
    if (e.target.id !== 'ga-buscar') return;
    const pista = contenedor.querySelector('#ga-tarjetas');
    if (pista) pista.scrollLeft = 0;
    aplicarFiltro();
  });

  // Arrastrar el carrusel con el dedo también mueve el cartel y las
  // flechas. `scroll` no burbujea, por eso se escucha en captura.
  contenedor.addEventListener('scroll', (e) => {
    if (e.target.id === 'ga-tarjetas') actualizarCarrusel();
  }, true);
}

// Pasa a la pestaña del otro turno. Si había una celda abierta se cierra
// sin guardar (Escape), igual que al tocar fuera de la grilla.
function cambiarTurno(nuevo) {
  if (nuevo === turno) return;
  editando = null;
  turno = nuevo;
  pintar();
}

// ---------------------------------------------------------------------
// EDICIÓN DE LA CELDA (como en Excel)
// ---------------------------------------------------------------------
function abrirCelda(celda) {
  if (editando) cerrarCelda();
  editando = celda;
  const a = celdas[claveCelda(celda.dataset.profesional, celda.dataset.hora)];
  celda.classList.add('editando');
  celda.innerHTML = renderInputCelda(pacienteDeCelda(a) || '');

  const input = celda.querySelector('input');
  input.focus();
  input.select();

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  { e.preventDefault(); guardar(celda, input.value, 'abajo'); }
    if (e.key === 'Tab')    { e.preventDefault(); guardar(celda, input.value, e.shiftKey ? 'arriba' : 'abajo'); }
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
  const a = celdas[claveCelda(celda.dataset.profesional, celda.dataset.hora)];
  celda.innerHTML = contenidoCelda(a);
  if (a?.id) celda.dataset.asignacion = a.id; else delete celda.dataset.asignacion;
  refrescarBusqueda(celda.closest('[data-buscar]'), celda.dataset.profesional);
}

// Rehace el texto de búsqueda de la tarjeta (profesional + sector + sus
// pacientes de hoy) después de editar una celda, para que el buscador
// encuentre al que se acaba de cargar sin tener que repintar toda la
// grilla. El sector lo lee del propio encabezado ya dibujado: no hace
// falta volver a calcularlo.
function refrescarBusqueda(tarjeta, profesionalId) {
  if (!tarjeta) return;
  const profesional = profesionales.find(p => String(p.id) === String(profesionalId));
  const sector = tarjeta.querySelector('.ga-tarjeta-h small')?.textContent || '';
  const franjas = franjasDe(profesional, turno);
  const pacientesDeHoy = [
    ...franjas.map(hora => pacienteDeCelda(celdas[claveCelda(profesionalId, hora)])),
    ...franjas.map(hora => casuales[claveCelda(profesionalId, hora)]?.paciente_nombre),
  ].filter(Boolean);
  tarjeta.dataset.buscar = [profesional?.nombre_completo, sector, ...pacientesDeHoy]
    .filter(Boolean).join(' ').toLowerCase();
}

// Guarda lo escrito y, si corresponde, pasa a la franja siguiente/anterior.
async function guardar(celda, texto, mover = null) {
  const escrito = (texto || '').trim();
  const profesionalId = celda.dataset.profesional;
  const hora = celda.dataset.hora;
  const anterior = pacienteDeCelda(celdas[claveCelda(profesionalId, hora)]) || '';

  editando = null;
  celda.classList.remove('editando');
  refrescarCelda(celda);
  if (mover) irA(celda, mover);

  // Sin cambios, no se toca la base.
  if (escrito === anterior) return;

  const asignacionId = celda.dataset.asignacion || null;

  // Celda vaciada: se cierra la asignación (queda como historia).
  if (!escrito) {
    if (!asignacionId) return;
    try {
      await asignacionModel.cerrarCelda(asignacionId, 'Quitada de la grilla');
      delete celdas[claveCelda(profesionalId, hora)];
      refrescarCelda(celda);
    } catch (err) {
      console.error('Error vaciando la celda:', err);
      refrescarCelda(celda);
      toast('No se pudo vaciar la celda. Probá de nuevo.', 'bad');
    }
    return;
  }

  // El paciente tiene que ser uno cargado en el sistema: acá ya no se
  // escribe libre (a diferencia del profesional, que siempre lo fue: la
  // columna ES ese profesional).
  const paciente = pacientes.find(p => normalizar(p.nombre_completo) === normalizar(escrito));
  if (!paciente) {
    toast(`No encontramos a "${escrito}" entre los pacientes activos. Cargalo primero desde Pacientes.`, 'bad');
    return;
  }

  // Un paciente no puede estar, a la misma hora, con otro profesional:
  // no puede estar en dos lados a la vez.
  const chocaConOtro = profesionales.find(p => {
    if (String(p.id) === String(profesionalId)) return false;
    const otraCelda = celdas[claveCelda(p.id, hora)];
    return otraCelda && String(otraCelda.paciente_id) === String(paciente.id);
  });
  if (chocaConOtro) {
    toast(`${paciente.nombre_completo} ya tiene las ${hora} con ${chocaConOtro.nombre_completo}.`, 'bad');
    return;
  }

  try {
    const profesional = profesionales.find(p => String(p.id) === String(profesionalId));
    const guardada = await asignacionModel.guardarCelda({
      pacienteId: paciente.id,
      profesionalId,
      hora,
      sector: profesional?.sector ?? null,
    });
    celdas[claveCelda(profesionalId, hora)] = guardada;
    refrescarCelda(celda);
  } catch (err) {
    console.error('Error guardando la celda de la grilla:', err);
    refrescarCelda(celda);
    toast('No se pudo guardar. Probá de nuevo.', 'bad');
  }
}

// Salta a la franja de abajo (Enter/Tab) o de arriba (Shift+Tab), dentro
// de la misma tarjeta. Si no hay, se queda donde está.
function irA(celda, direccion) {
  const cuerpo = celda.closest('.ga-tarjeta-b');
  if (!cuerpo) return;
  const celdasDeLaTarjeta = [...cuerpo.querySelectorAll('.ga-celda')];
  const i = celdasDeLaTarjeta.indexOf(celda);
  const destino = direccion === 'arriba' ? celdasDeLaTarjeta[i - 1] : celdasDeLaTarjeta[i + 1];
  if (destino) abrirCelda(destino);
}
