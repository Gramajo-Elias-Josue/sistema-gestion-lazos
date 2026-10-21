// =====================================================================
// VISTA: Inicio (panel de dirección)
// ---------------------------------------------------------------------
// CAPA VISTA. Solo arma HTML a partir de los datos que le pasa el
// controlador. No accede a Supabase ni decide nada de negocio.
// =====================================================================

import { estadoVencimiento, fechaLarga, formatearFecha, iniciales } from '../utils/fechas.js';
import { etiquetaPeriodo } from '../utils/periodos.js';
import { esc, pill } from '../utils/ui.js';
import { horarioDe } from '../utils/turnosCentro.js';

// Estructura general de la vista: contenedores que el controlador rellena.
export function renderInicio() {
  return `
    <div class="panel" style="margin-bottom:20px">
      <div class="panel-h">
        <h2>Grilla de atención</h2>
        <span class="cnt">${esc(fechaLarga())}</span>
      </div>
      <div class="panel-b">
        <p class="ga-ayuda">
          Tocá una franja horaria y escribí el paciente que la ocupa.
          Enter baja a la franja de abajo; Shift+Tab sube a la de arriba.
        </p>
        <div id="inicio-grilla"></div>
      </div>
    </div>
    <div id="inicio-kpis"></div>
    <div class="panel" style="margin-bottom:20px">
      <div class="panel-h">
        <h2>Entregas del mes</h2>
        <span class="cnt">informes y fotos</span>
      </div>
      <div class="panel-b" id="inicio-entregas"></div>
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

// Tarjeta KPI del encabezado. Antes había 4 (pacientes activos,
// profesionales activos, turnos de hoy, asistencias hoy): la grilla de
// atención ya reemplaza a "turnos de hoy", y los conteos fijos de
// pacientes/profesionales activos no dicen mucho del día a día. Queda
// solo la que sí cambia mientras transcurre la jornada.
export function renderKpis({ asistenciasHoy }) {
  // Es un atajo: al tocarla, el controlador navega (data-goto).
  return `
    <div class="kpis">
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
    const ent = hhmm(f?.hora_entrada) || horarioDe(p).entrada;
    const sal = hhmm(f?.hora_salida) || horarioDe(p).salida;
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

// Entregas del mes: quién debe el informe mensual y quién no subió
// todavía su foto de trabajo. Es lo que evita perseguir a la gente de
// memoria. `pendientes` viene de utils/periodos.js.
export function renderEntregas({ periodo, informes = [], fotos = [], alDia = false } = {}) {
  const mes = etiquetaPeriodo(periodo);
  if (alDia) {
    return `<div class="state">Todo el equipo entregó su informe y su foto de ${esc(mes)}. ✓</div>`;
  }

  // Singular y plural van separados: "1 profesional debe" / "3 profesionales deben".
  const bloque = ({ uno, varios }, gente, clase, icono) => {
    if (!gente.length) return '';
    const encabezado = gente.length === 1 ? `1 profesional ${uno}` : `${gente.length} profesionales ${varios}`;
    return `
      <div class="alert">
        <div class="ico ${clase}">${icono}</div>
        <div class="tx">
          <b>${encabezado}</b>
          <span>${gente.map(p => esc(p.nombre_completo)).join(' · ')}</span>
        </div>
        <span class="tag ${clase === 'i-red' ? 't-red' : 't-amber'}">${esc(mes)}</span>
      </div>`;
  };

  return `
    ${bloque({ uno: 'debe el informe del mes', varios: 'deben el informe del mes' }, informes, 'i-red', '📄')}
    ${bloque({ uno: 'no subió su foto del mes', varios: 'no subieron su foto del mes' }, fotos, 'i-amber', '📷')}
    <div class="hint" style="margin-top:10px;font-size:13.5px;color:var(--ink-faint)">
      Los <b>informes</b> se cargan en la historia clínica de cada paciente; las
      <b>fotos</b>, en <b>Galería</b>.
    </div>`;
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
    // Singular/plural correcto, y "Vence hoy" cuando faltan 0 días.
    const plural = (n) => (n === 1 ? 'día' : 'días');
    let detalle;
    if (vencido) {
      const n = Math.abs(e.dias);
      detalle = `Vencido hace ${n} ${plural(n)}`;
    } else if (e.dias === 0) {
      detalle = 'Vence hoy';
    } else {
      detalle = `Vence en ${e.dias} ${plural(e.dias)}`;
    }
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
