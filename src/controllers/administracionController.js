// =====================================================================
// CONTROLADOR: Administración / Usuarios (Etapa 2 · Fase B)
// ---------------------------------------------------------------------
// CAPA CONTROLADOR. Pantalla del director: lista los usuarios, guarda el
// rol + secciones de cada uno y da de alta usuarios nuevos (vía la Edge
// Function). Sólo la ve el director (lo controla el gating del router).
// =====================================================================

import * as usuarioModel from '../models/usuarioModel.js';
import { renderEstructura, renderListaUsuarios, renderFormUsuario } from '../views/administracionView.js';
import { htmlCargando, htmlError, toast } from '../utils/ui.js';
import { mensajeError } from '../utils/errores.js';

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
    const usuarios = await usuarioModel.listarUsuarios();
    caja.innerHTML = renderListaUsuarios(usuarios);
    caja.querySelectorAll('.btn-guardar-usr').forEach(b =>
      b.addEventListener('click', () => guardarPermisos(b.dataset.id)));
  } catch (err) {
    console.error('Error listando usuarios:', err);
    caja.innerHTML = htmlError('No se pudieron cargar los usuarios.');
  }
}

// ---------------------------------------------------------------------
// GUARDAR ROL + SECCIONES de una fila
// ---------------------------------------------------------------------
async function guardarPermisos(id) {
  const fila = document.querySelector(`tr[data-id="${CSS.escape(id)}"]`);
  if (!fila) return;
  const rol = fila.querySelector('.usr-rol').value;
  const secciones = [...fila.querySelectorAll('.usr-sec:checked')].map(c => c.dataset.sec);

  const btn = fila.querySelector('.btn-guardar-usr');
  btn.disabled = true;
  btn.textContent = 'Guardando…';
  try {
    await usuarioModel.actualizarPermisos(id, { rol, secciones });
    toast('Permisos actualizados.');
    await cargarUsuarios(); // refresca (el rol pudo cambiar los defaults visibles)
  } catch (err) {
    console.error('Error guardando permisos:', err);
    btn.disabled = false;
    btn.textContent = 'Guardar';
    toast(mensajeError(err, 'No se pudieron guardar los permisos.'), 'bad');
  }
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
      toast('Completá el email y una contraseña de al menos 6 caracteres.', 'bad');
      return;
    }

    const btn = document.getElementById('btn-guardar-usuario');
    btn.disabled = true;
    btn.textContent = 'Creando…';
    try {
      await usuarioModel.crearUsuario(datos);
      toast('Usuario creado.');
      cerrar();
      await cargarUsuarios();
    } catch (err) {
      console.error('Error creando usuario:', err);
      btn.disabled = false;
      btn.textContent = 'Crear usuario';
      toast(mensajeError(err, 'No se pudo crear el usuario.'), 'bad');
    }
  });
}
