// =====================================================================
// VISTA: Inicio (panel de dirección)
// ---------------------------------------------------------------------
// CAPA VISTA. Solo arma HTML a partir de los datos que le pasa el
// controlador. No accede a Supabase ni decide nada de negocio.
// =====================================================================

import { estadoVencimiento, formatearFecha, iniciales } from '../utils/fechas.js';
import { esc, pill } from '../utils/ui.js';
import { ESTADOS_TURNO } from './turnosView.js';

// Estructura general de la vista: contenedores que el controlador rellena.
export function renderInicio() {
  return `
    <div id="inicio-kpis"></div>
    <div class="panel" style="margin-bottom:20px">
      <div class="panel-h">
        <h2>Grilla del día</h2>
        <span class="cnt">turnos de hoy</span>
      </div>
      <div class="panel-b" id="inicio-grilla"></div>
    </div>
    <div class="grid2">
      <div class="panel">
        <div class="panel-h">
          <h2>Disponibilidad de hoy</h2>
          <span class="cnt">profesionales</span>
        </div>
        <div class="panel-b" id="inicio-disponibilidad"></div>
      </div>
      <div class="panel">
        <div class="panel-h">
          <h2>Alertas importantes</h2>
          <span class="cnt">documentación</span>
        </div>
        <div class="panel-b" id="inicio-alertas"></div>
      </div>
    </div>`;
}

// Las tarjetas KPI del encabezado.
export function renderKpis({ pacientesActivos, profesionalesActivos, asistenciasHoy, turnosHoy }) {
  // Cada tarjeta es un atajo: al tocarla, el controlador navega (data-goto).
  return `
    <div class="kpis">
      <div class="kpi" data-goto="pacientes" title="Ir a Pacientes">
        <div class="lab"><span class="dot"></span>Pacientes activos</div>
        <div class="num">${pacientesActivos}</div>
        <div class="sub">en seguimiento →</div>
      </div>
      <div class="kpi" data-goto="profesionales" title="Ir a Profesionales">
        <div class="lab"><span class="dot"></span>Profesionales activos</div>
        <div class="num">${profesionalesActivos}</div>
        <div class="sub">equipo interdisciplinario →</div>
      </div>
      <div class="kpi" data-goto="agenda" title="Ir a Turnos">
        <div class="lab"><span class="dot"></span>Turnos de hoy</div>
        <div class="num">${turnosHoy}</div>
        <div class="sub">agenda del día →</div>
      </div>
      <div class="kpi" data-goto="asistencia" title="Ir a Asistencia">
        <div class="lab"><span class="dot"></span>Asistencias hoy</div>
        <div class="num">${asistenciasHoy}</div>
        <div class="sub">registradas en el día →</div>
      </div>
    </div>`;
}

// Disponibilidad de hoy: profesionales activos con su estado de fichaje
// (presente / ausente / licencia / sin fichar) y su horario habitual.
// `fichajesPorId` = { profesional_id: fichaje del día }.
export function renderDisponibilidad(profesionales, fichajesPorId = {}) {
  if (!profesionales.length) {
    return `<div class="state">No hay profesionales activos cargados.</div>`;
  }
  // "HH:MM:SS" -> "HH:MM".
  const hhmm = (t) => t ? String(t).slice(0, 5) : null;

  return profesionales.map(p => {
    const f = fichajesPorId[p.id];
    let estadoPill;
    if (!f) estadoPill = `<span class="pill" style="background:var(--card-2);color:var(--ink-faint)"><span class="d" style="background:var(--ink-faint)"></span>Sin fichar</span>`;
    else if (f.estado === 'presente') estadoPill = pill('ok', 'Presente');
    else if (f.estado === 'licencia') estadoPill = pill('warn', 'Licencia');
    else estadoPill = pill('bad', 'Ausente');

    // Horario: lo fichado hoy si está, si no el horario habitual del perfil.
    const ent = hhmm(f?.hora_entrada) || hhmm(p.horario_entrada);
    const sal = hhmm(f?.hora_salida) || hhmm(p.horario_salida);
    const horario = (ent || sal) ? `${ent || '—'} a ${sal || '—'}` : 'Sin horario';

    return `
      <div class="alert">
        <div class="ico i-teal">${esc(iniciales(p.nombre_completo))}</div>
        <div class="tx">
          <b>${esc(p.nombre_completo)}</b>
          <span>${esc(p.profesion || 'Profesional')} · ${esc(horario)}</span>
        </div>
        ${estadoPill}
      </div>`;
  }).join('');
}

// Grilla del día: qué profesional atiende a cada paciente hoy (turnos).
export function renderGrillaDia(turnos) {
  if (!turnos.length) {
    return `<div class="state">No hay turnos programados para hoy. Cargá turnos desde <b>Turnos</b>.</div>`;
  }
  const filas = turnos.map(t => {
    const est = ESTADOS_TURNO[t.estado] || ESTADOS_TURNO.programado;
    const pac = t.pacientes || {};
    const prof = t.profesionales || {};
    const hora = t.hora ? String(t.hora).slice(0, 5) : '—';
    return `
      <tr style="cursor:default">
        <td style="font-weight:600;white-space:nowrap">${hora}</td>
        <td><b>${esc(pac.nombre_completo || '—')}</b></td>
        <td>${esc(prof.nombre_completo || '—')}<br><small style="color:var(--ink-faint)">${esc(prof.profesion || '')}</small></td>
        <td>${pill(est.clase, est.etiqueta)}</td>
      </tr>`;
  }).join('');
  return `
    <table>
      <thead><tr><th>Hora</th><th>Paciente</th><th>Profesional</th><th>Estado</th></tr></thead>
      <tbody>${filas}</tbody>
    </table>`;
}

// Panel de alertas: lista de documentos vencidos o por vencer.
// Recibe los documentos (con el paciente embebido) desde el modelo.
export function renderAlertas(documentos) {
  // Calcula el estado de cada documento y descarta los vigentes.
  const items = documentos
    .map(d => ({ doc: d, e: estadoVencimiento(d.fecha_vencimiento) }))
    .filter(x => x.e.clase !== 'ok')
    // Ordena: primero los vencidos, luego por días restantes ascendente.
    .sort((a, b) =>
      (a.e.clase === 'bad' ? -1 : 0) - (b.e.clase === 'bad' ? -1 : 0)
      || a.e.dias - b.e.dias
    );

  if (!items.length) {
    return `<div class="state">Sin documentos vencidos ni próximos a vencer. ✓</div>`;
  }

  return items.map(({ doc, e }) => {
    const vencido = e.clase === 'bad';
    const nombre = doc.pacientes?.nombre_completo ?? 'Paciente';
    const detalle = vencido
      ? `Vencido hace ${Math.abs(e.dias)} días`
      : `Vence en ${e.dias} días`;
    const icono = doc.tipo === 'cud' ? '🪪' : '📋';
    return `
      <div class="alert">
        <div class="ico ${vencido ? 'i-red' : 'i-amber'}">${icono}</div>
        <div class="tx">
          <b>${esc(nombre)}</b>
          <span>${esc(doc.tipo)} · ${detalle} · ${formatearFecha(doc.fecha_vencimiento)}</span>
        </div>
        <span class="tag ${vencido ? 't-red' : 't-amber'}">${vencido ? 'Vencido' : 'Por vencer'}</span>
      </div>`;
  }).join('');
}
