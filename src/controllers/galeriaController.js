// =====================================================================
// CONTROLADOR: Galería del trabajo
// ---------------------------------------------------------------------
// CAPA CONTROLADOR. Las fotos del trabajo del mes: cada profesional sube
// al menos una, y con eso el CM arma el contenido de difusión. Acá NO hay
// informes: esos son del paciente y quedan en su historia clínica.
//
// Al abrir la sección se borran solas las fotos de más de 3 meses: así el
// espacio no crece sin control y nadie tiene que acordarse de limpiar.
// =====================================================================

import * as profesionalModel from '../models/profesionalModel.js';
import * as fotoModel from '../models/fotoModel.js';
import { renderEstructura, renderFotos, renderPendientes } from '../views/galeriaView.js';
import { htmlCargando, htmlError, toast, confirmar } from '../utils/ui.js';
import { periodoMensual, moverPeriodo, etiquetaPeriodo, pendientesDelMes } from '../utils/periodos.js';
import { perfilActual } from '../sesion.js';

let periodo = periodoMensual();
let profesionales = [];
let fotos = [];          // fotos del período mostrado (con su URL firmada)
let todasLasFotos = [];  // todas (para saber quién no subió la del mes)
let miProfesionalId = null; // id del profesional logueado (solo si rol=profesional)

// Punto de entrada de la sección (lo llama el router).
export async function iniciarGaleria() {
  periodo = periodoMensual();
  const cont = document.getElementById('v-galeria');
  cont.innerHTML = renderEstructura(periodo);

  document.getElementById('gal-prev').addEventListener('click', () => irA(moverPeriodo(periodo, -1)));
  document.getElementById('gal-next').addEventListener('click', () => irA(moverPeriodo(periodo, 1)));
  document.getElementById('gal-hoy').addEventListener('click', () => irA(periodoMensual()));

  const pane = document.getElementById('gal-pane-fotos');
  pane.addEventListener('submit', (e) => {
    if (e.target.id === 'gal-form-foto') { e.preventDefault(); subirFoto(e.target); }
  });
  pane.addEventListener('click', (e) => {
    const b = e.target.closest('.gal-borrar');
    if (b) borrarFoto(b.closest('.gal-foto'));
  });

  // Limpieza automática: las fotos viejas se van solas.
  fotoModel.limpiarVencidas()
    .then(n => { if (n) console.info(`Galería: se borraron ${n} fotos de más de 3 meses.`); })
    .catch(err => console.error('No se pudieron limpiar las fotos viejas:', err));

  await cargar();
}

function irA(nuevo) {
  periodo = nuevo;
  document.getElementById('gal-periodo').textContent = etiquetaPeriodo(periodo);
  cargar();
}

// Trae las fotos del período.
async function cargar() {
  const cajaFotos = document.getElementById('gal-pane-fotos');
  cajaFotos.innerHTML = htmlCargando('Cargando fotos…');

  try {
    const [profs, delMes, todas] = await Promise.all([
      profesionalModel.listarProfesionales({ soloActivos: true }),
      fotoModel.listarPorPeriodo(periodo),
      fotoModel.listarTodas(),
    ]);
    profesionales = profs;
    todasLasFotos = todas;

    // El bucket es privado: cada foto necesita su URL firmada.
    fotos = await Promise.all(delMes.map(async f => ({
      ...f,
      url: await fotoModel.urlFoto(f.storage_path).catch(() => null),
    })));

    pintar();
  } catch (err) {
    console.error('Error cargando la galería:', err);
    cajaFotos.innerHTML = htmlError('No se pudo cargar la galería. Revisá la conexión.');
  }
}

function pintar() {
  // Solo interesa quién no subió su foto: los informes se controlan en el
  // panel de inicio, porque son del paciente.
  const pendientes = pendientesDelMes({ profesionales, fotos: todasLasFotos, periodo });

  document.getElementById('gal-pendientes').innerHTML = renderPendientes({ periodo, fotos: pendientes.fotos });
  document.getElementById('gal-fotos').textContent = fotos.length;
  document.getElementById('gal-deben-foto').textContent = pendientes.fotos.length;

  const perfil = perfilActual();
  // Solo el propio profesional sube su foto (identificado por su usuario
  // logueado, no por un desplegable): así queda bien atribuida y nadie
  // puede subir a nombre de otro. Director/secretaría/CM solo miran.
  miProfesionalId = perfil?.rol === 'profesional' ? perfil?.profesional_id : null;

  document.getElementById('gal-pane-fotos').innerHTML = renderFotos({
    fotos, periodo,
    puedeSubir: !!miProfesionalId,
    miNombre: perfil?.nombre || '',
  });
}

// ---------------------------------------------------------------------
// FOTOS
// ---------------------------------------------------------------------
async function subirFoto(form) {
  const datos = new FormData(form);
  const archivo = datos.get('archivo');
  if (!miProfesionalId) { toast('Solo un profesional puede subir su foto.', 'bad'); return; }
  if (!archivo || !archivo.size) { toast('Elegí una foto para subir.', 'bad'); return; }

  const boton = document.getElementById('gal-subir');
  boton.disabled = true;
  boton.textContent = 'Subiendo…';
  try {
    const guardada = await fotoModel.subirFoto({
      profesionalId: miProfesionalId, periodo, archivo, descripcion: datos.get('descripcion'),
    });
    const url = await fotoModel.urlFoto(guardada.storage_path).catch(() => null);
    fotos = [{ ...guardada, url }, ...fotos];
    todasLasFotos = [{ ...guardada }, ...todasLasFotos];
    pintar();
    toast('Foto subida.');
  } catch (err) {
    console.error('Error subiendo la foto:', err);
    boton.disabled = false;
    boton.textContent = 'Subir foto';
    toast('No se pudo subir la foto. Probá de nuevo.', 'bad');
  }
}

async function borrarFoto(tarjeta) {
  if (!tarjeta) return;
  const seguro = await confirmar({
    titulo: '¿Eliminar la foto?',
    mensaje: 'Se borra del sistema y no se puede recuperar.',
    textoOk: 'Sí, eliminar',
    textoCancelar: 'No',
    peligro: true,
  });
  if (!seguro) return;

  try {
    await fotoModel.eliminarFoto(tarjeta.dataset.foto, tarjeta.dataset.path);
    fotos = fotos.filter(f => String(f.id) !== String(tarjeta.dataset.foto));
    todasLasFotos = todasLasFotos.filter(f => String(f.id) !== String(tarjeta.dataset.foto));
    pintar();
    toast('Foto eliminada.');
  } catch (err) {
    console.error('Error eliminando la foto:', err);
    toast('No se pudo eliminar la foto. Probá de nuevo.', 'bad');
  }
}
