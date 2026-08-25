// =====================================================================
// VISTA: Gastos
// ---------------------------------------------------------------------
// CAPA VISTA. Registro de gastos del centro, cada uno atado a qué socio
// lo pagó (es una sociedad, no un solo dueño), para poder rendir cuentas
// entre ellos. Navegación por mes, como Facturación.
// =====================================================================

import { esc } from '../utils/ui.js';
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
      <button class="btn" id="btn-nuevo-gasto" style="margin-left:auto">+ Nuevo gasto</button>
    </div>
    <div id="ga-resumen"></div>
    <div class="tablewrap"><div id="ga-lista"></div></div>`;
}

// Rendición de cuentas del mes: cuánto pagó cada socio + el total.
export function renderResumen(gastos) {
  if (!gastos.length) return '';

  const porSocio = resumenPorSocio(gastos);
  const tarjetas = porSocio.map(s => `
    <div class="kpi">
      <div class="lab"><span class="dot"></span>${esc(s.socio)}</div>
      <div class="num" style="font-size:27px">${formatearMonto(s.total)}</div>
      <div class="sub">pagado este mes</div>
    </div>`).join('');

  return `
    <div class="kpis" style="margin-bottom:18px">
      ${tarjetas}
      <div class="kpi">
        <div class="lab"><span class="dot"></span>Total del mes</div>
        <div class="num" style="font-size:27px">${formatearMonto(totalGastos(gastos))}</div>
        <div class="sub">entre todos los socios</div>
      </div>
    </div>`;
}

// Tabla de gastos del mes.
export function renderLista(gastos) {
  if (!gastos.length) {
    return `<div class="state">No hay gastos cargados este mes. Usá “+ Nuevo gasto”.</div>`;
  }
  const filas = gastos.map(g => `
    <tr>
      <td>${formatearFecha(g.fecha)}</td>
      <td>${esc(g.concepto)}</td>
      <td>${esc(g.categoria || '—')}</td>
      <td>${esc(g.socio)}</td>
      <td style="text-align:right">${formatearMonto(g.monto)}</td>
      <td style="white-space:nowrap;text-align:right">
        <button class="btn ghost btn-eliminar-gasto" data-id="${g.id}" style="padding:6px 12px;color:var(--red-600)">Eliminar</button>
      </td>
    </tr>`).join('');

  return `
    <table>
      <thead><tr><th>Fecha</th><th>Concepto</th><th>Categoría</th><th>Socio</th><th style="text-align:right">Monto</th><th></th></tr></thead>
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
