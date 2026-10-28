// =====================================================================
// VISTA: Estadísticas
// ---------------------------------------------------------------------
// CAPA VISTA. Funciones PURAS que reciben los números ya calculados
// (utils/estadisticas.js) y devuelven el HTML. Los gráficos son barras
// hechas con HTML y CSS (sin librerías): se adaptan al modo oscuro y al
// celular igual que el resto de la app.
// =====================================================================

import { esc, tonoDe } from '../utils/ui.js';
import { etiquetaPeriodo, MESES } from '../utils/periodos.js';
import { formatearMonto } from '../utils/gastos.js';
import { MESES_TENDENCIA } from '../utils/estadisticas.js';

// 'Oct 26' para el pie de cada columna.
const mesCorto = (periodo) => {
  const [anio, mes] = String(periodo).split('-');
  return `${MESES[Number(mes) - 1].slice(0, 3)} ${anio.slice(2)}`;
};
const vacio = (texto) => `<div class="es-vacio">${esc(texto)}</div>`;

// Encabezado: navegación de mes + los cuatro bloques.
export function renderEstructura(periodo) {
  return `
    <div class="asis-head">
      <div class="datenav">
        <button class="nav-dia" id="es-prev" title="Mes anterior">‹</button>
        <div class="datechip"><b id="es-periodo">${esc(etiquetaPeriodo(periodo))}</b></div>
        <button class="nav-dia" id="es-next" title="Mes siguiente">›</button>
        <button class="btn ghost" id="es-hoy">Mes actual</button>
      </div>
      <p class="es-ayuda">Los gráficos muestran los últimos ${MESES_TENDENCIA} meses hasta el mes elegido.</p>
    </div>
    <div id="es-asistencia" class="es-bloque"></div>
    <div id="es-atencion" class="es-bloque"></div>
    <div id="es-informes" class="es-bloque"></div>
    <div id="es-gestion" class="es-bloque"></div>`;
}

// ---------------------------------------------------------------------
// GRÁFICOS
// ---------------------------------------------------------------------

// Columnas por mes. datos: [{ periodo, partes: [{ valor, clase }] , texto }]
// Cada columna apila sus partes; la altura es relativa al mayor total.
export function columnasPorMes(datos = [], leyenda = []) {
  const totales = datos.map(d => d.partes.reduce((a, p) => a + p.valor, 0));
  const max = Math.max(...totales, 0);
  if (!max) return vacio('Sin datos en estos meses.');
  const columnas = datos.map((d, i) => {
    const alto = Math.round((totales[i] * 100) / max);
    const partes = d.partes.filter(p => p.valor > 0).map(p =>
      `<span class="es-parte ${p.clase}" style="flex:${p.valor}" title="${esc(p.titulo || '')}: ${p.valor}"></span>`).join('');
    return `
      <div class="es-col">
        <span class="es-val">${esc(d.texto ?? totales[i])}</span>
        <div class="es-barra" style="height:${alto}%">${partes}</div>
        <span class="es-mes">${mesCorto(d.periodo)}</span>
      </div>`;
  }).join('');
  const ley = leyenda.length
    ? `<div class="es-leyenda">${leyenda.map(l => `<span><i class="es-parte ${l.clase}"></i>${esc(l.texto)}</span>`).join('')}</div>`
    : '';
  return `<div class="es-cols">${columnas}</div>${ley}`;
}

// Barras horizontales. filas: [{ etiqueta, valor, max, texto, tono }]
export function barrasHorizontales(filas = [], textoVacio = 'Sin datos.') {
  if (!filas.length) return vacio(textoVacio);
  const max = Math.max(...filas.map(f => f.max ?? f.valor), 0) || 1;
  return `<div class="es-filas">${filas.map(f => {
    const ancho = Math.round((f.valor * 100) / (f.max ?? max));
    return `
      <div class="es-fila${f.tono != null ? ' tono-' + f.tono : ''}${f.clase ? ' ' + f.clase : ''}">
        <span class="es-etq">${esc(f.etiqueta)}</span>
        <span class="es-track"><span class="es-fill" style="width:${Math.min(ancho, 100)}%"></span></span>
        <span class="es-num">${esc(f.texto ?? f.valor)}</span>
      </div>`;
  }).join('')}</div>`;
}

const tarjeta = (titulo, cuerpo, nota = '') => `
  <div class="panel es-card">
    <div class="panel-h"><h2>${esc(titulo)}</h2>${nota ? `<span class="cnt">${esc(nota)}</span>` : ''}</div>
    <div class="panel-b">${cuerpo}</div>
  </div>`;
const kpi = (etiqueta, numero, sub = '') => `
  <div class="kpi"><div class="lab"><span class="dot"></span>${esc(etiqueta)}</div>
    <div class="num">${esc(numero)}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</div>`;
const titulo = (t) => `<h2 class="es-titulo">${esc(t)}</h2>`;

// ---------------------------------------------------------------------
// BLOQUES
// ---------------------------------------------------------------------

export function renderAsistencia({ periodo, porMes = [], ausentismo = [], fichaje = [] }) {
  const mes = porMes.find(m => m.periodo === periodo) || { pct: 0, total: 0, presentes: 0 };
  const grafico = columnasPorMes(
    porMes.map(m => ({
      periodo: m.periodo, texto: m.total ? `${m.pct}%` : '—',
      partes: [
        { valor: m.presentes, clase: 'es-ok', titulo: 'Presentes' },
        { valor: m.aviso, clase: 'es-aviso', titulo: 'Con aviso' },
        { valor: m.enfermedad, clase: 'es-enf', titulo: 'Enfermedad' },
        { valor: m.ausentes, clase: 'es-mal', titulo: 'Ausentes' },
      ],
    })),
    [{ clase: 'es-ok', texto: 'Presente' }, { clase: 'es-aviso', texto: 'Con aviso' }, { clase: 'es-enf', texto: 'Enfermedad' }, { clase: 'es-mal', texto: 'Ausente' }],
  );
  const faltas = barrasHorizontales(
    ausentismo.map(a => ({ etiqueta: a.nombre, valor: a.faltas, texto: `${a.faltas} ${a.faltas === 1 ? 'falta' : 'faltas'} de ${a.registros} días`, tono: tonoDe(a.id) })),
    'Nadie faltó este mes.',
  );
  const fichajes = fichaje.length ? `
    <table class="es-tabla">
      <thead><tr><th>Profesional</th><th>Presente</th><th>Ausente</th><th>Licencia</th></tr></thead>
      <tbody>${fichaje.map(f => `<tr><td>${esc(f.nombre)}</td><td>${f.presentes}</td><td>${f.ausentes}</td><td>${f.licencias}</td></tr>`).join('')}</tbody>
    </table>` : vacio('No hay profesionales activos.');

  return `${titulo('Asistencia')}
    <div class="kpis es-kpis">
      ${kpi('Asistencia del mes', mes.total ? `${mes.pct}%` : '—', `${mes.presentes} presentes de ${mes.total} registros`)}
    </div>
    <div class="es-grid">
      ${tarjeta('Asistencia de pacientes por mes', grafico, '% presentes')}
      ${tarjeta('Pacientes con más faltas', faltas, etiquetaPeriodo(periodo))}
    </div>
    ${tarjeta('Fichaje de profesionales (días)', `<div class="tablewrap">${fichajes}</div>`, etiquetaPeriodo(periodo))}`;
}

export function renderAtencion({ resumen, ingresos = [], porProfesion = [] }) {
  const graficoIngresos = columnasPorMes(
    ingresos.map(m => ({ periodo: m.periodo, partes: [{ valor: m.valor, clase: 'es-ok', titulo: 'Ingresos' }] })),
  );
  const profesiones = barrasHorizontales(
    porProfesion.map(s => ({ etiqueta: s.etiqueta, valor: s.valor, texto: `${s.valor} pac.`, tono: tonoDe(s.clave) })),
    'No hay profesiones cargadas.',
  );
  return `${titulo('Atención y grilla')}
    <div class="kpis es-kpis">
      ${kpi('Pacientes activos', resumen.activos, `${resumen.conCud} con CUD`)}
      ${kpi('En admisión', resumen.enAdmision, 'esperando aprobación')}
      ${kpi('Dados de baja', resumen.inactivos, 'inactivos')}
    </div>
    <div class="es-grid">
      ${tarjeta('Ingresos por mes', graficoIngresos, 'pacientes admitidos')}
      ${tarjeta('Pacientes por profesión', profesiones, 'grilla vigente')}
    </div>`;
}

export function renderInformes({ periodo, documentos = [], entregas = [], casuales = [] }) {
  const graficoDocs = columnasPorMes(
    documentos.map(m => ({ periodo: m.periodo, partes: [
      { valor: m.informes, clase: 'es-ok', titulo: 'Informes' },
      { valor: m.certificados, clase: 'es-enf', titulo: 'Certificados' },
    ] })),
    [{ clase: 'es-ok', texto: 'Informes' }, { clase: 'es-enf', texto: 'Evaluaciones / certificados' }],
  );
  const graficoEntregas = barrasHorizontales(
    entregas.map(e => ({ etiqueta: e.nombre, valor: e.entregados, max: e.pacientes, texto: `${e.entregados}/${e.pacientes}`, clase: e.pct === 100 ? 'es-completo' : '' })),
    'No hay profesionales con pacientes en la grilla.',
  );
  const graficoCasuales = columnasPorMes(
    casuales.map(m => ({ periodo: m.periodo, partes: [
      { valor: m.atendidos, clase: 'es-ok', titulo: 'Atendidos' },
      { valor: m.programados, clase: 'es-prog', titulo: 'Programados' },
      { valor: m.ausentes, clase: 'es-mal', titulo: 'Ausentes' },
      { valor: m.cancelados, clase: 'es-gris', titulo: 'Cancelados' },
    ] })),
    [{ clase: 'es-ok', texto: 'Atendido' }, { clase: 'es-prog', texto: 'Programado' }, { clase: 'es-mal', texto: 'Ausente' }, { clase: 'es-gris', texto: 'Cancelado' }],
  );
  return `${titulo('Informes y turnos')}
    <div class="es-grid">
      ${tarjeta('Informes y certificados por mes', graficoDocs)}
      ${tarjeta('Informe mensual: pacientes con informe', graficoEntregas, etiquetaPeriodo(periodo))}
    </div>
    ${tarjeta('Turnos de pacientes casuales por mes', graficoCasuales)}`;
}

export function renderGestion({ periodo, facturacion = [], resumenMes, gastosMes = [], porSocio = [], porCategoria = [], total = 0 }) {
  const graficoFact = columnasPorMes(
    facturacion.map(m => ({ periodo: m.periodo, partes: [
      { valor: m.cobrados, clase: 'es-ok', titulo: 'Cobrados' },
      { valor: m.facturados, clase: 'es-aviso', titulo: 'Facturados sin cobrar' },
    ] })),
    [{ clase: 'es-ok', texto: 'Cobrado' }, { clase: 'es-aviso', texto: 'Facturado sin cobrar' }],
  );
  const graficoGastos = columnasPorMes(
    gastosMes.map(m => ({ periodo: m.periodo, texto: m.valor ? formatearMonto(m.valor).replace(',00', '') : '—', partes: [{ valor: m.valor, clase: 'es-gasto', titulo: 'Gastos' }] })),
  );
  const socios = barrasHorizontales(
    porSocio.map(s => ({ etiqueta: s.socio, valor: s.total, texto: formatearMonto(s.total), tono: tonoDe(s.socio) })),
    'No hay gastos este mes.',
  );
  const categorias = barrasHorizontales(
    porCategoria.map(c => ({ etiqueta: c.categoria, valor: c.total, texto: formatearMonto(c.total), tono: tonoDe(c.categoria) })),
    'No hay gastos este mes.',
  );
  return `${titulo('Gestión')}
    <div class="kpis es-kpis">
      ${kpi('Cobrados', resumenMes.facturado_cobrado, etiquetaPeriodo(periodo))}
      ${kpi('Facturados sin cobrar', resumenMes.facturado_no_cobrado, 'pendientes de cobro')}
      ${kpi('Sin facturar', resumenMes.no_facturado, 'de los pacientes activos')}
      ${kpi('Gastos del mes', formatearMonto(total), 'entre todos los socios')}
    </div>
    <div class="es-grid">
      ${tarjeta('Facturación por mes', graficoFact, 'pacientes')}
      ${tarjeta('Gastos por mes', graficoGastos)}
      ${tarjeta('Gastos por socio', socios, etiquetaPeriodo(periodo))}
      ${tarjeta('Gastos por categoría', categorias, etiquetaPeriodo(periodo))}
    </div>`;
}
