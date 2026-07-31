// =====================================================================
// CONTROLADOR: Mi perfil (avatar)
// ---------------------------------------------------------------------
// CAPA CONTROLADOR. Abre el panel de perfil, deja elegir un avatar
// predefinido o subir una foto, y lo guarda. Al guardar, actualiza también
// el avatar del encabezado sin recargar.
// =====================================================================

import { renderPerfil } from '../views/perfilView.js';
import { guardarAvatar, subirFotoAvatar, urlAvatar } from '../perfil.js';
import { perfilActual, setPerfil } from '../sesion.js';
import { parseAvatar, valorPreset, valorFoto, rutaFoto, AVATARES, inicialesDe } from '../utils/avatar.js';
import { toast } from '../utils/ui.js';
import { mensajeError } from '../utils/errores.js';

const MAX_MB = 2;

// Pinta el avatar de un perfil dentro de un elemento (encabezado o vista
// previa). Si es una foto, pide la URL firmada y la reemplaza cuando llega;
// mientras tanto muestra las iniciales para no dejar un hueco.
export async function pintarAvatar(el, perfil, textoFallback = 'US') {
  if (!el) return;
  const av = parseAvatar(perfil?.avatar);
  const iniciales = inicialesDe(textoFallback);

  if (av.tipo === 'preset') {
    // Avatar elegido de los archivos de src/assets/avatares/.
    el.innerHTML = `<img src="${av.preset.url}" alt="">`;
    el.style.background = '';
    el.style.backgroundImage = '';
    return;
  }

  // Iniciales (por defecto y mientras carga la foto).
  el.textContent = iniciales;
  el.style.background = '';
  el.style.backgroundImage = '';

  if (av.tipo === 'foto') {
    try {
      const url = await urlAvatar(av.ruta);
      el.textContent = '';
      el.style.backgroundImage = `url("${url}")`;
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';
    } catch (err) {
      console.error('No se pudo cargar la foto de perfil:', err);
      // Se quedan las iniciales: el perfil sigue usable.
    }
  }
}

// Abre el panel de perfil. `email` viene de la sesión; `onGuardado` avisa
// para refrescar el encabezado.
export function abrirPerfil(email, onGuardado) {
  const perfil = perfilActual() || {};
  document.body.insertAdjacentHTML('beforeend', renderPerfil(perfil, email));

  const overlay = document.getElementById('overlay-perfil');
  const preview = document.getElementById('perfil-preview');
  const cajaError = document.getElementById('perfil-error');
  const inputFoto = document.getElementById('perfil-foto');
  const cerrar = () => overlay.remove();

  const nombre = perfil.nombre || email || 'US';
  // Selección pendiente: null = sin cambios respecto de lo guardado.
  let presetElegido = null;   // clave del avatar predefinido
  let fotoElegida = null;     // File
  let quitar = false;         // volver a las iniciales

  const mostrarError = (t) => { cajaError.textContent = t; cajaError.hidden = false; };

  pintarAvatar(preview, perfil, nombre);

  overlay.querySelectorAll('[data-cerrar]').forEach(b => b.addEventListener('click', cerrar));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });

  // --- Elegir un avatar predefinido ---
  overlay.querySelectorAll('.av-opcion').forEach(btn => {
    btn.addEventListener('click', () => {
      presetElegido = btn.dataset.avatar;
      fotoElegida = null; quitar = false;
      inputFoto.value = '';
      cajaError.hidden = true;
      overlay.querySelectorAll('.av-opcion').forEach(b => b.classList.toggle('sel', b === btn));
      const preset = AVATARES.find(a => a.clave === presetElegido);
      preview.innerHTML = `<img src="${preset.url}" alt="">`;
      preview.style.background = '';
      preview.style.backgroundImage = '';
    });
  });

  // --- Subir una foto (vista previa local, sin subirla todavía) ---
  inputFoto.addEventListener('change', () => {
    const archivo = inputFoto.files?.[0];
    if (!archivo) return;
    if (!archivo.type.startsWith('image/')) {
      mostrarError('El archivo tiene que ser una imagen.');
      inputFoto.value = '';
      return;
    }
    if (archivo.size > MAX_MB * 1024 * 1024) {
      mostrarError(`La imagen no puede pesar más de ${MAX_MB} MB.`);
      inputFoto.value = '';
      return;
    }
    cajaError.hidden = true;
    fotoElegida = archivo;
    presetElegido = null; quitar = false;
    overlay.querySelectorAll('.av-opcion').forEach(b => b.classList.remove('sel'));
    // Vista previa inmediata desde el archivo local.
    const url = URL.createObjectURL(archivo);
    preview.textContent = '';
    preview.style.backgroundImage = `url("${url}")`;
    preview.style.backgroundSize = 'cover';
    preview.style.backgroundPosition = 'center';
  });

  // --- Volver a las iniciales ---
  document.getElementById('btn-quitar-avatar').addEventListener('click', () => {
    quitar = true; presetElegido = null; fotoElegida = null;
    inputFoto.value = '';
    cajaError.hidden = true;
    overlay.querySelectorAll('.av-opcion').forEach(b => b.classList.remove('sel'));
    preview.textContent = inicialesDe(nombre);
    preview.style.background = '';
    preview.style.color = '';
    preview.style.backgroundImage = '';
  });

  // --- Guardar ---
  document.getElementById('btn-guardar-perfil').addEventListener('click', async () => {
    if (!presetElegido && !fotoElegida && !quitar) { cerrar(); return; } // sin cambios

    const btn = document.getElementById('btn-guardar-perfil');
    btn.disabled = true;
    btn.textContent = 'Guardando…';
    try {
      let valor = null;
      if (fotoElegida) {
        const ruta = rutaFoto(perfil.id, fotoElegida.name);
        await subirFotoAvatar(ruta, fotoElegida);
        valor = valorFoto(ruta);
      } else if (presetElegido) {
        valor = valorPreset(presetElegido);
      } // si `quitar`, queda null

      await guardarAvatar(valor);
      setPerfil({ ...perfil, avatar: valor });  // al día en memoria
      toast('Perfil actualizado.');
      cerrar();
      if (onGuardado) onGuardado();
    } catch (err) {
      console.error('Error guardando el avatar:', err);
      btn.disabled = false;
      btn.textContent = 'Guardar';
      mostrarError(mensajeError(err, 'No se pudo guardar el avatar. Probá de nuevo.'));
    }
  });
}
