// =====================================================================
// VISTA: Galería del trabajo
// ---------------------------------------------------------------------
// CAPA VISTA. SOLO fotos: las que sube cada profesional de su trabajo
// del mes (al menos una), que son el material con el que se arma el
// contenido de difusión. Arriba se ve quién todavía no subió la suya.
//
// Acá NO hay informes. Los informes son del PACIENTE y quedan en SU
// historia clínica; el control de quién los debe está en el panel de
// inicio.
//
// Las fotos tampoco son historia clínica: no se asocian a ningún
// paciente y se borran solas a los 3 meses.
// =====================================================================

import { esc } from '../utils/ui.js';
import { iniciales, formatearFecha } from '../utils/fechas.js';
import { etiquetaPeriodo, MESES_A_CONSERVAR_FOTOS } from '../utils/periodos.js';

// Estructura: navegación de mes + contadores + contenedor de fotos.
export function renderEstructura(periodo) {
  return `
    <div class="asis-head">
      <div class="datenav">
        <button class="nav-dia" id="gal-prev" title="Mes anterior">‹</button>
        <div class="datechip">📅 <b id="gal-periodo">${esc(etiquetaPeriodo(periodo))}</b></div>
        <button class="nav-dia" id="gal-next" title="Mes siguiente">›</button>
        <button class="btn ghost" id="gal-hoy" style="padding:8px 14px">Mes actual</button>
      </div>
      <div class="livestat">
        <div><div class="n" id="gal-fotos" style="color:var(--teal-600)">0</div><small>Fotos del mes</small></div>
        <div><div class="n" id="gal-deben-foto" style="color:var(--amber-600)">0</div><small>Sin foto</small></div>
      </div>
    </div>

    <div id="gal-pendientes"></div>
    <div id="gal-pane-fotos"></div>`;
}

// Aviso de quiénes todavía no subieron su foto del mes.
// `fotos` = los profesionales que la deben.
export function renderPendientes({ periodo, fotos = [] } = {}) {
  if (!fotos.length) {
    return `<div class="banner">✓ Todo el equipo subió su foto de ${esc(etiquetaPeriodo(periodo))}.</div>`;
  }
  const cuantos = fotos.length === 1
    ? '1 profesional todavía no subió su foto'
    : `${fotos.length} profesionales todavía no subieron su foto`;
  return `
    <div class="banner banner-alerta">
      <b>${cuantos} de ${esc(etiquetaPeriodo(periodo))}:</b>
      ${esc(fotos.map(p => p.nombre_completo).join(' · '))}
    </div>`;
}

// Formulario de carga + grilla de fotos del mes.
// fotos: [{ id, descripcion, nombre_archivo, created_at, url, profesionales:{…} }]
export function renderFotos({ fotos = [], profesionales = [], puedeSubir = true, periodo }) {
  const opciones = profesionales.length
    ? profesionales.map(p => `<option value="${p.id}">${esc(p.nombre_completo)}${p.profesion ? ' — ' + esc(p.profesion) : ''}</option>`).join('')
    : '<option value="">(no hay profesionales activos)</option>';

  const formulario = puedeSubir ? `
    <form class="panel gal-form" id="gal-form-foto" style="margin-bottom:18px">
      <div class="panel-h">
        <h2>Subir una foto de ${esc(etiquetaPeriodo(periodo))}</h2>
        <span class="cnt">se borra a los ${MESES_A_CONSERVAR_FOTOS} meses</span>
      </div>
      <div class="panel-b" style="padding:16px 18px">
        <div class="form-grid">
          <div class="form-field">
            <label>Profesional *</label>
            <select name="profesional_id" required>${opciones}</select>
          </div>
          <div class="form-field">
            <label>Foto *</label>
            <input type="file" name="archivo" accept="image/*" required>
          </div>
          <div class="form-field full">
            <label>Descripción <small style="color:var(--ink-faint);font-weight:400">(opcional)</small></label>
            <input name="descripcion" placeholder="Ej: taller de estimulación, sala verde" autocomplete="off">
          </div>
        </div>
        <div style="text-align:right;margin-top:12px">
          <button type="submit" class="btn" id="gal-subir">Subir foto</button>
        </div>
      </div>
    </form>` : '';

  if (!fotos.length) {
    return formulario + `<div class="state">Todavía no hay fotos de ${esc(etiquetaPeriodo(periodo))}.</div>`;
  }

  const tarjetas = fotos.map(f => `
    <figure class="gal-foto" data-foto="${f.id}" data-path="${esc(f.storage_path || '')}">
      <img src="${esc(f.url || '')}" alt="${esc(f.descripcion || f.nombre_archivo || 'Foto del trabajo')}" loading="lazy">
      <figcaption>
        <b>${esc(f.profesionales?.nombre_completo || 'Profesional')}</b>
        <span>${esc(f.descripcion || f.nombre_archivo || '')}</span>
        <small>${esc(formatearFecha(String(f.created_at || '').slice(0, 10)))}</small>
      </figcaption>
      ${puedeSubir ? `<button type="button" class="gal-borrar" title="Eliminar la foto">×</button>` : ''}
    </figure>`).join('');

  return formulario + `<div class="gal-grid">${tarjetas}</div>`;
}
