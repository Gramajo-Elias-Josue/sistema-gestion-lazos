// =====================================================================
// VISTA: Admisión
// ---------------------------------------------------------------------
// CAPA VISTA. Pantalla del proceso de admisión: lista de pacientes en
// trámite y, por paciente, el checklist de documentación presentada con
// el botón para APROBAR la admisión (recién ahí pasa a ser paciente).
// La pestaña "Documentación" edita QUÉ se pide (requisitos_admision).
// =====================================================================

import { esc, pill, tonoDe } from '../utils/ui.js';
import { iniciales, formatearFecha, calcularEdad } from '../utils/fechas.js';

// Estructura base: pestañas En trámite / Documentación. "En trámite"
// tiene la lista y, al abrir un paciente, su detalle.
export function renderEstructura() {
  return `
    <div class="tabs" id="adm-tabs">
      <button class="tab active" data-tab="tramite">En trámite</button>
      <button class="tab" data-tab="documentacion">Documentación</button>
    </div>
    <div id="adm-pane-tramite">
      <div id="lista-adm">
        <div class="seccion-intro">
          <p>Pacientes en proceso de admisión. Controlá la documentación presentada y aprobá la admisión para que pasen a ser pacientes.</p>
          <button class="btn" id="btn-nuevo-ingreso">+ Nuevo ingreso</button>
        </div>
        <div id="adm-tabla"></div>
      </div>
      <div id="ficha-adm" class="hidden"></div>
    </div>
    <div id="adm-pane-documentacion" class="hidden">
      <div class="seccion-intro">
        <p>Documentación que se pide al admitir un paciente. Es la lista que aparece para tildar en cada admisión.</p>
        <button class="btn" id="btn-nuevo-requisito">+ Nuevo documento</button>
      </div>
      <div id="requisitos-tabla"></div>
    </div>`;
}

// Tabla de la documentación que se pide (pestaña "Documentación").
export function renderListaRequisitos(requisitos) {
  if (!requisitos.length) {
    return `<div class="tablewrap"><div class="state">No se pide ningún documento. Usá "+ Nuevo documento".</div></div>`;
  }
  const filas = requisitos.map(r => `
    <tr>
      <td><b>${esc(r.etiqueta)}</b></td>
      <td class="catalogo-acciones">
        <button class="btn ghost btn-editar-requisito" data-id="${esc(r.id)}" style="padding:6px 12px">Editar</button>
        <button class="btn ghost btn-quitar-requisito" data-id="${esc(r.id)}" data-etiqueta="${esc(r.etiqueta)}" style="padding:6px 12px;color:var(--red-600)">Quitar</button>
      </td>
    </tr>`).join('');

  return `
    <div class="tablewrap">
      <table>
        <thead><tr><th>Documento</th><th></th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </div>`;
}

// Modal para agregar un documento a pedir, o renombrarlo (`requisito`
// con id = edición).
export function renderModalRequisito(requisito = {}) {
  const edicion = !!requisito.id;
  return `
    <div class="overlay" id="overlay-requisito">
      <div class="modal" style="max-width:420px">
        <div class="modal-h">
          <h2>${edicion ? 'Editar documento' : 'Nuevo documento'}</h2>
          <button class="x" data-cerrar aria-label="Cerrar">×</button>
        </div>
        <form id="form-requisito">
          <div class="modal-b">
            <div class="form-field full">
              <label>Nombre *</label>
              <input name="etiqueta" required placeholder="Ej: Certificado de vacunas" autocomplete="off" value="${esc(requisito.etiqueta || '')}">
              <small style="color:var(--ink-faint)">Aparece para tildar en la admisión de cada paciente.</small>
            </div>
          </div>
          <div class="modal-f">
            <button type="button" class="btn ghost" data-cerrar>Cancelar</button>
            <button type="submit" class="btn">${edicion ? 'Guardar' : 'Agregar'}</button>
          </div>
        </form>
      </div>
    </div>`;
}

// Tabla de pacientes en admisión. En escritorio es una tabla; en
// celular el CSS (.tabla-cards) la convierte en tarjetas.
export function renderLista(pacientes) {
  if (!pacientes.length) {
    return `<div class="tablewrap"><div class="state">No hay pacientes en proceso de admisión. Usá “+ Nuevo ingreso”.</div></div>`;
  }

  const filas = pacientes.map(p => `
    <tr class="tono-${tonoDe(p.id)}" data-id="${p.id}">
      <td class="tc-nombre">
        <div class="pname">
          <div class="pav">${esc(iniciales(p.nombre_completo))}</div>
          <div><b>${esc(p.nombre_completo)}</b><br><small>DNI ${esc(p.dni || '—')}</small></div>
        </div>
      </td>
      <td data-t="Edad">${p.fecha_nacimiento ? calcularEdad(p.fecha_nacimiento) + ' años' : '—'}</td>
      <td data-t="CUD">${p.tiene_cud ? pill('ok', 'Con CUD') : pill('bad', 'Sin CUD')}</td>
      <td class="tc-acciones" style="white-space:nowrap;text-align:right">
        <button class="btn btn-abrir-adm" data-id="${p.id}" style="padding:6px 12px">Abrir admisión</button>
        <button class="btn ghost btn-rechazar-adm peligro" data-id="${p.id}" data-nombre="${esc(p.nombre_completo)}" style="padding:6px 12px;color:var(--red-600)">Rechazar</button>
      </td>
    </tr>`).join('');

  return `
    <div class="tablewrap tabla-cards">
      <table>
        <thead>
          <tr><th>Paciente</th><th>Edad</th><th>CUD</th><th></th></tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>`;
}

// Detalle de admisión: datos básicos + checklist + acciones.
// `checklist` son las filas guardadas (admision_documentos) del paciente;
// `requisitos`, la documentación que se pide hoy (pestaña Documentación).
export function renderAdmision(paciente, checklist = [], requisitos = []) {
  // Mapa requisito -> fila guardada, para saber qué está presentado.
  const porReq = {};
  checklist.forEach(c => { porReq[c.requisito] = c; });

  const items = requisitos.length ? requisitos.map(r => {
    const guardado = porReq[r.clave] || {};
    const presentado = guardado.presentado === true;
    return `
      <div class="adm-item">
        <label class="adm-chk">
          <input type="checkbox" class="adm-check" data-req="${esc(r.clave)}" ${presentado ? 'checked' : ''}>
          <span>${esc(r.etiqueta)}</span>
        </label>
        <input class="adm-obs" data-req="${esc(r.clave)}" placeholder="Observación (opcional)" value="${esc(guardado.observaciones || '')}">
        ${presentado ? pill('ok', 'Presentado') : pill('warn', 'Pendiente')}
      </div>`;
  }).join('') : `<div class="state" style="padding:18px">No se pide ningún documento: se configura en la pestaña "Documentación".</div>`;

  const presentados = requisitos.filter(r => porReq[r.clave]?.presentado).length;
  const total = requisitos.length;

  return `
    <button class="back" id="btn-volver-adm">‹ Volver a la lista</button>
    <div class="legajo-top">
      <div class="bigav">${esc(iniciales(paciente.nombre_completo))}</div>
      <div style="flex:1">
        <h2>${esc(paciente.nombre_completo)}</h2>
        <div class="meta">DNI ${esc(paciente.dni || '—')} · ${paciente.fecha_nacimiento ? calcularEdad(paciente.fecha_nacimiento) + ' años' : 'Sin fecha de nac.'} · ${esc(paciente.diagnostico || 'Sin diagnóstico')}</div>
      </div>
      <button class="btn ghost" id="btn-editar-adm">Editar datos</button>
    </div>

    <div class="panel">
      <div class="panel-h">
        <h2>Documentación de admisión</h2>
        <span class="cnt" id="adm-progreso">${presentados} / ${total} presentados</span>
      </div>
      <div class="panel-b" style="padding:8px 18px 16px" id="adm-checklist">
        ${items}
      </div>
    </div>

    <div class="adm-acciones">
      <button class="btn ghost" id="btn-rechazar-detalle" style="color:var(--red-600)">Rechazar admisión</button>
      <button class="btn" id="btn-aprobar-adm">✓ Aprobar admisión</button>
    </div>`;
}
