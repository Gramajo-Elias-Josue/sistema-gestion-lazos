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
import {
  renderEstructura, renderListaUsuarios, renderFormUsuario,
  renderModalPermisos, seccionesDefaultDeRol,
} from '../views/administracionView.js';
import { htmlCargando, htmlError, toast } from '../utils/ui.js';
import { mensajeError } from '../utils/errores.js';

// Usuarios de la última carga (para abrir el panel sin volver a pedirlos).
let usuariosCargados = [];

// Punto de entrada de la sección (lo llama el router).
export async function iniciarAdministracion() {
  const cont = document.getElementById('v-administracion');
  cont.innerHTML = renderEstructura();
  document.getElementById('btn-nuevo-usuario').addEventListener('click', abrirFormUsuario);
  await cargarUsuarios();
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
      password: fd.get('password') || '',
      rol: fd.get('rol'),
    };
    if (!datos.email || datos.password.length < 6) {
      toast('Completá el email y una contraseña de 6 caracteres o más.', 'bad');
      return;
    }

    const btn = document.getElementById('btn-guardar-usuario');
    btn.disabled = true;
    btn.textContent = 'Creando…';
    try {
      const creado = await usuarioModel.crearUsuario(datos);
      toast('Usuario creado.');
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
