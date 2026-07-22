// =====================================================================
// VISTA: Admisión
// ---------------------------------------------------------------------
// CAPA VISTA. Pantalla del proceso de admisión: lista de pacientes en
// trámite y, por paciente, el checklist de documentación presentada con
// el botón para APROBAR la admisión (recién ahí pasa a ser paciente).
// =====================================================================

import { esc, pill } from '../utils/ui.js';
import { iniciales, formatearFecha, calcularEdad } from '../utils/fechas.js';

// Requisitos estándar de documentación que se controlan en la admisión.
// `clave` se guarda en admision_documentos.requisito; `etiqueta` se muestra.
export const REQUISITOS_ADMISION = [
  { clave: 'dni',                etiqueta: 'DNI (copia)' },
  { clave: 'cud',               etiqueta: 'CUD (si tiene)' },
  { clave: 'certificado_medico', etiqueta: 'Certificado médico' },
  { clave: 'estudios',          etiqueta: 'Estudios / evaluaciones previas' },
  { clave: 'carnet_obra_social', etiqueta: 'Carnet de obra social' },
  { clave: 'informe_escolar',   etiqueta: 'Informe escolar' },
  { clave: 'consentimiento',    etiqueta: 'Consentimiento informado firmado' },
];

// Estructura base: contenedor de la lista + contenedor del detalle.
export function renderEstructura() {
  return `
    <div id="lista-adm">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
        <p style="color:var(--ink-soft);font-size:15px">Pacientes en proceso de admisión. Controlá la documentación presentada y aprobá la admisión para que pasen a ser pacientes.</p>
        <button class="btn" id="btn-nuevo-ingreso">+ Nuevo ingreso</button>
      </div>
      <div id="adm-tabla"></div>
    </div>
    <div id="ficha-adm" class="hidden"></div>`;
}

// Tabla de pacientes en admisión.
export function renderLista(pacientes) {
  if (!pacientes.length) {
    return `<div class="tablewrap"><div class="state">No hay pacientes en proceso de admisión. Usá “+ Nuevo ingreso”.</div></div>`;
  }

  const filas = pacientes.map(p => `
    <tr data-id="${p.id}">
      <td>
        <div class="pname">
          <div class="pav">${esc(iniciales(p.nombre_completo))}</div>
          <div><b>${esc(p.nombre_completo)}</b><br><small>DNI ${esc(p.dni || '—')}</small></div>
        </div>
      </td>
      <td>${p.fecha_nacimiento ? calcularEdad(p.fecha_nacimiento) + ' años' : '—'}</td>
      <td>${p.tiene_cud ? pill('ok', 'Con CUD') : pill('bad', 'Sin CUD')}</td>
      <td style="white-space:nowrap;text-align:right">
        <button class="btn btn-abrir-adm" data-id="${p.id}" style="padding:6px 12px">Abrir admisión</button>
        <button class="btn ghost btn-rechazar-adm" data-id="${p.id}" data-nombre="${esc(p.nombre_completo)}" style="padding:6px 12px;color:var(--red-600)">Rechazar</button>
      </td>
    </tr>`).join('');

  return `
    <div class="tablewrap">
      <table>
        <thead>
          <tr><th>Paciente</th><th>Edad</th><th>CUD</th><th></th></tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>`;
}

// Detalle de admisión: datos básicos + checklist + acciones.
// `checklist` son las filas guardadas (admision_documentos) del paciente.
export function renderAdmision(paciente, checklist = []) {
  // Mapa requisito -> fila guardada, para saber qué está presentado.
  const porReq = {};
  checklist.forEach(c => { porReq[c.requisito] = c; });

  const items = REQUISITOS_ADMISION.map(r => {
    const guardado = porReq[r.clave] || {};
    const presentado = guardado.presentado === true;
    return `
      <div class="adm-item">
        <label class="adm-chk">
          <input type="checkbox" class="adm-check" data-req="${r.clave}" ${presentado ? 'checked' : ''}>
          <span>${esc(r.etiqueta)}</span>
        </label>
        <input class="adm-obs" data-req="${r.clave}" placeholder="Observación (opcional)" value="${esc(guardado.observaciones || '')}">
        ${presentado ? pill('ok', 'Presentado') : pill('warn', 'Pendiente')}
      </div>`;
  }).join('');

  const presentados = REQUISITOS_ADMISION.filter(r => porReq[r.clave]?.presentado).length;
  const total = REQUISITOS_ADMISION.length;

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

    <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:20px">
      <button class="btn ghost" id="btn-rechazar-detalle" style="color:var(--red-600)">Rechazar admisión</button>
      <button class="btn" id="btn-aprobar-adm">✓ Aprobar admisión</button>
    </div>`;
}
