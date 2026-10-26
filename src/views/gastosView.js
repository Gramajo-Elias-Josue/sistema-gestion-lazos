// =====================================================================
// VISTA: Gastos
// ---------------------------------------------------------------------
// CAPA VISTA. Registro de gastos del centro, cada uno atado a qué socio
// lo pagó (es una sociedad, no un solo dueño), para poder rendir cuentas
// entre ellos. Navegación por mes, como Facturación.
// =====================================================================

import { esc, tonoDe } from '../utils/ui.js';
import { formatearFecha, hoyISO } from '../utils/fechas.js';
import { etiquetaPeriodo } from '../utils/periodos.js';
import { formatearMonto, resumenPorSocio, totalGastos } from '../utils/gastos.js';

// Encabezado: navegación de mes + botón de alta.
export function renderEstructura(periodo) {
  return `
    <div class="asis-head">
      <div class="datenav">
        <button class="nav-dia" id="ga-prev" title="Mes anterior">‹</button>
        <div class="datechip"><b id="ga-periodo">${esc(etiquetaPeriodo(periodo))}</b></div>
        <button class="nav-dia" id="ga-next" title="Mes siguiente">›</button>
        <button class="btn ghost" id="ga-hoy">Mes actual</button>
      </div>
      <div class="acciones-excel">
        <button class="btn ghost" id="btn-excel-gastos" title="Descargar los gastos de este mes en Excel">⤓ Exportar a Excel</button>
        <button class="btn" id="btn-nuevo-gasto">+ Nuevo gasto</button>
      </div>
    </div>
    <div id="ga-resumen"></div>
    <div class="tablewrap tabla-cards"><div id="ga-lista"></div></div>`;
}

// Rendición de cuentas del mes: cuánto pagó cada socio + el total.
export function renderResumen(gastos) {
  if (!gastos.length) return '';

  // Cada socio lleva su color (el mismo que sus gastos en la lista).
  const porSocio = resumenPorSocio(gastos);
  const tarjetas = porSocio.map(s => `
    <div class="kpi tono-${tonoDe(s.socio)}">
      <div class="lab"><span class="dot"></span>${esc(s.socio)}</div>
      <div class="num">${formatearMonto(s.total)}</div>
      <div class="sub">pagado este mes</div>
    </div>`).join('');

  return `
    <div class="kpis ga-kpis">
      ${tarjetas}
      <div class="kpi ga-total">
        <div class="lab"><span class="dot"></span>Total del mes</div>
        <div class="num">${formatearMonto(totalGastos(gastos))}</div>
        <div class="sub">entre todos los socios</div>
      </div>
    </div>`;
}

// Tabla de gastos del mes. En escritorio es una tabla; en celular el CSS
// (.tabla-cards) la convierte en tarjetas: el concepto (con el monto) es
// la cabecera, y la tarjeta lleva el color del socio que pagó.
export function renderLista(gastos) {
  if (!gastos.length) {
    return `<div class="state">No hay gastos cargados este mes. Usá “+ Nuevo gasto”.</div>`;
  }
  const filas = gastos.map(g => `
    <tr class="tono-${tonoDe(g.socio)}" style="cursor:default">
      <td class="tc-nombre ga-concepto">
        <b>${esc(g.concepto)}</b>
        <span class="ga-monto-cel">${formatearMonto(g.monto)}</span>
      </td>
      <td data-t="Fecha">${formatearFecha(g.fecha)}</td>
      <td data-t="Categoría">${esc(g.categoria || '—')}</td>
      <td data-t="Socio">${esc(g.socio)}</td>
      <td data-t="Monto" class="ga-monto">${formatearMonto(g.monto)}</td>
      <td class="tc-acciones" style="white-space:nowrap;text-align:right">
        <button class="btn ghost btn-eliminar-gasto peligro" data-id="${g.id}" style="padding:6px 12px;color:var(--red-600)">Eliminar</button>
      </td>
    </tr>`).join('');

  return `
    <table>
      <thead><tr><th>Concepto</th><th>Fecha</th><th>Categoría</th><th>Socio</th><th style="text-align:right">Monto</th><th></th></tr></thead>
      <tbody>${filas}</tbody>
    </table>`;
}

// Formulario (modal) de alta de un gasto.
export function renderFormGasto() {
  return `
    <div class="overlay" id="overlay-gasto">
      <div class="modal" style="max-width:480px">
        <div class="modal-h">
          <h2>Nuevo gasto</h2>
          <button class="x" data-cerrar>×</button>
        </div>
        <form id="form-gasto">
          <div class="modal-b">
            <div class="form-grid">
              <div class="form-field"><label>Fecha *</label><input type="date" name="fecha" required value="${hoyISO()}"></div>
              <div class="form-field"><label>Monto *</label><input type="number" name="monto" min="0" step="0.01" required></div>
              <div class="form-field full"><label>Concepto *</label><input name="concepto" required placeholder="Ej: resma de hojas A4"></div>
              <div class="form-field"><label>Pagó *</label><input name="socio" required placeholder="Nombre del socio"></div>
              <div class="form-field"><label>Categoría</label><input name="categoria" placeholder="Insumos, alquiler…"></div>
            </div>
          </div>
          <div class="modal-f">
            <button type="button" class="btn ghost" data-cerrar>Cancelar</button>
            <button type="submit" class="btn" id="btn-guardar-gasto">Guardar gasto</button>
          </div>
        </form>
      </div>
    </div>`;
}
