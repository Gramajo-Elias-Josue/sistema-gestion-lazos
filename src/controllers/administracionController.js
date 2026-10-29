// =====================================================================
// CONTROLADOR: Administración / Usuarios (Etapa 2 · Fase B)
// ---------------------------------------------------------------------
// CAPA CONTROLADOR. Pantalla del director: lista los usuarios, da de alta
// usuarios nuevos (vía la Edge Function) y edita sus permisos (rol +
// secciones) en un panel dedicado. Sólo la ve el director (lo controla el
// gating del router).
//
// El rol DIRECTOR SÍ se puede asignar desde acá, pero solo al CREAR un
// usuario (el centro es una sociedad, puede haber varios). Un director ya
// creado no se edita desde este panel: acceso total, no recortable.
// =====================================================================

import * as usuarioModel from '../models/usuarioModel.js';
import * as configuracionModel from '../models/configuracionModel.js';
import {
  renderEstructura, renderListaUsuarios, renderFormUsuario,
  renderModalPermisos, seccionesDefaultDeRol, renderUbicacionCentro,
} from '../views/administracionView.js';
import { htmlCargando, htmlError, toast } from '../utils/ui.js';
import { mensajeError } from '../utils/errores.js';
import { obtenerUbicacion, mensajeErrorUbicacion, validarUbicacionCentro } from '../utils/ubicacion.js';

// Usuarios de la última carga (para abrir el panel sin volver a pedirlos).
let usuariosCargados = [];

// Punto de entrada de la sección (lo llama el router).
export async function iniciarAdministracion() {
  const cont = document.getElementById('v-administracion');
  cont.innerHTML = renderEstructura();
  document.getElementById('btn-nuevo-usuario').addEventListener('click', abrirFormUsuario);
  await Promise.all([cargarUsuarios(), cargarUbicacion()]);
}

// ---------------------------------------------------------------------
// UBICACIÓN DEL CENTRO (para el fichaje por ubicación)
// ---------------------------------------------------------------------
async function cargarUbicacion() {
  const caja = document.getElementById('adm-ubicacion');
  caja.innerHTML = htmlCargando('Cargando la ubicación del centro…');
  try {
    const conf = await configuracionModel.obtenerConfiguracion();
    caja.innerHTML = renderUbicacionCentro(conf || {});
  } catch (err) {
    console.error('Error cargando la configuración del centro:', err);
    caja.innerHTML = htmlError('No se pudo cargar la ubicación del centro.');
    return;
  }

  const form = document.getElementById('form-ubicacion');
  document.getElementById('btn-ubi-actual').addEventListener('click', usarUbicacionActual);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const v = validarUbicacionCentro({
      latitud: fd.get('latitud'), longitud: fd.get('longitud'), radio: Number(fd.get('radio')),
    });
    if (!v.ok) { toast(v.mensaje, 'bad'); return; }

    const btn = document.getElementById('btn-ubi-guardar');
    btn.disabled = true;
    btn.textContent = 'Guardando…';
    try {
      await configuracionModel.guardarUbicacion(v.datos);
      toast('Ubicación del centro guardada.');
      await cargarUbicacion(); // re-render: aparece "Ver en el mapa"
    } catch (err) {
      console.error('Error guardando la ubicación:', err);
      btn.disabled = false;
      btn.textContent = 'Guardar ubicación';
      toast(mensajeError(err, 'No se pudo guardar la ubicación. Probá de nuevo.'), 'bad');
    }
  });
}

// Completa latitud y longitud con la ubicación actual del dispositivo.
// No guarda: el director revisa y toca "Guardar ubicación".
async function usarUbicacionActual() {
  const btn = document.getElementById('btn-ubi-actual');
  btn.disabled = true;
  btn.textContent = 'Buscando tu ubicación…';
  try {
    const { lat, lng, precision } = await obtenerUbicacion();
    document.getElementById('ubi-lat').value = lat.toFixed(6);
    document.getElementById('ubi-lng').value = lng.toFixed(6);
    // Una PC no tiene GPS: el navegador estima por WiFi y puede errar
    // cientos de metros. Si la lectura es floja, se avisa antes de guardar.
    document.getElementById('ubi-precision').textContent = precision > 50
      ? `⚠️ Precisión baja (±${precision} m): parece una ubicación estimada (por ejemplo, desde una PC). Para que el fichaje funcione bien, tomala desde un celular con GPS, parado en el centro.`
      : `Ubicación tomada con una precisión de ±${precision} m. Revisala y tocá "Guardar ubicación".`;
  } catch (err) {
    console.error('Error obteniendo la ubicación:', err);
    toast(mensajeErrorUbicacion(err), 'bad');
  } finally {
    btn.disabled = false;
    btn.textContent = '📍 Usar mi ubicación actual';
  }
}

// ---------------------------------------------------------------------
// LISTADO
// ---------------------------------------------------------------------
async function cargarUsuarios() {
  const caja = document.getElementById('usuarios-tabla');
  caja.innerHTML = htmlCargando('Cargando usuarios…');
  try {
    usuariosCargados = await usuarioModel.listarUsuarios();
    caja.innerHTML = renderListaUsuarios(usuariosCargados);
    caja.querySelectorAll('.btn-permisos').forEach(b =>
      b.addEventListener('click', () => abrirPermisos(b.dataset.id)));
  } catch (err) {
    console.error('Error listando usuarios:', err);
    caja.innerHTML = htmlError('No se pudo cargar la lista de usuarios. Revisá la conexión.');
  }
}

// ---------------------------------------------------------------------
// PANEL DE PERMISOS (rol + secciones)
// ---------------------------------------------------------------------
function abrirPermisos(id) {
  const usuario = usuariosCargados.find(u => String(u.id) === String(id));
  if (!usuario) return;

  document.body.insertAdjacentHTML('beforeend', renderModalPermisos(usuario));
  const overlay = document.getElementById('overlay-permisos');
  const form = document.getElementById('form-permisos');
  const cerrar = () => overlay.remove();

  overlay.querySelectorAll('[data-cerrar]').forEach(b => b.addEventListener('click', cerrar));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });

  // Al cambiar el rol se re-marcan sus secciones por defecto (después el
  // director puede ajustarlas a mano).
  document.getElementById('perm-rol').addEventListener('change', (e) => {
    const defaults = seccionesDefaultDeRol(e.target.value);
    overlay.querySelectorAll('.usr-sec').forEach(chk => {
      chk.checked = defaults.includes(chk.dataset.sec);
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rol = document.getElementById('perm-rol').value;
    const secciones = [...overlay.querySelectorAll('.usr-sec:checked')].map(c => c.dataset.sec);

    const btn = document.getElementById('btn-guardar-permisos');
    btn.disabled = true;
    btn.textContent = 'Guardando…';
    try {
      await usuarioModel.actualizarPermisos(id, { rol, secciones });
      toast('Permisos actualizados.');
      cerrar();
      await cargarUsuarios();
    } catch (err) {
      console.error('Error guardando permisos:', err);
      btn.disabled = false;
      btn.textContent = 'Guardar permisos';
      toast(mensajeError(err, 'No se pudieron guardar los permisos. Probá de nuevo.'), 'bad');
    }
  });
}

// ---------------------------------------------------------------------
// ALTA de un usuario nuevo (Edge Function)
// ---------------------------------------------------------------------
function abrirFormUsuario() {
  document.body.insertAdjacentHTML('beforeend', renderFormUsuario());
  const overlay = document.getElementById('overlay-usuario');
  const form = document.getElementById('form-usuario');
  const cerrar = () => overlay.remove();

  overlay.querySelectorAll('[data-cerrar]').forEach(b => b.addEventListener('click', cerrar));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const datos = {
      nombre: (fd.get('nombre') || '').trim() || null,
      email: (fd.get('email') || '').trim(),
      rol: fd.get('rol'),
    };
    if (!datos.email) {
      toast('Completá el email.', 'bad');
      return;
    }

    const btn = document.getElementById('btn-guardar-usuario');
    btn.disabled = true;
    btn.textContent = 'Creando…';
    try {
      const creado = await usuarioModel.crearUsuario(datos);
      toast(`Usuario creado. Le mandamos a ${datos.email} un mail de bienvenida para que elija su contraseña.`);
      cerrar();
      await cargarUsuarios();
      // Recién creado: se abre el panel para ajustar sus permisos, salvo
      // que sea Director — ese no se edita desde acá (acceso total, sin
      // secciones para tildar; el panel de permisos ni lo contempla).
      if (creado?.id && datos.rol !== 'director') abrirPermisos(creado.id);
    } catch (err) {
      console.error('Error creando usuario:', err);
      btn.disabled = false;
      btn.textContent = 'Crear usuario';
      toast(mensajeError(err, 'No se pudo crear el usuario. Probá de nuevo.'), 'bad');
    }
  });
}
