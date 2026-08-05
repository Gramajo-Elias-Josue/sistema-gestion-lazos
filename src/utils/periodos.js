// =====================================================================
// UTILIDADES: Períodos y entregas del mes
// ---------------------------------------------------------------------
// Funciones PURAS (sin DOM ni Supabase) para lo que cada profesional
// entrega por mes:
//   - el informe MENSUAL (y el ANUAL una vez al año);
//   - al menos UNA FOTO de su trabajo.
//
// Un "período" es un texto corto y ordenable: '2026-08' para un mes y
// '2026' para un año. Se guarda así en la base para poder comparar y
// agrupar sin hacer cuentas con fechas.
// =====================================================================

import { hoyISO } from './fechas.js';

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// Al menos una foto por mes: es el requisito del centro.
export const FOTOS_MINIMAS_POR_MES = 1;

// A los 3 meses las fotos se borran solas (son material de difusión del
// momento, no archivo histórico).
export const MESES_A_CONSERVAR_FOTOS = 3;

const pad = (n) => String(n).padStart(2, '0');

// Período MENSUAL de una fecha ISO. '2026-08-15' -> '2026-08'.
export function periodoMensual(fechaISO = hoyISO()) {
  return String(fechaISO).slice(0, 7);
}

// Período ANUAL de una fecha ISO. '2026-08-15' -> '2026'.
export function periodoAnual(fechaISO = hoyISO()) {
  return String(fechaISO).slice(0, 4);
}

// Nombre legible de un período: '2026-08' -> 'Agosto 2026'; '2026' -> '2026'.
export function etiquetaPeriodo(periodo) {
  const [anio, mes] = String(periodo).split('-');
  if (!mes) return anio || '';
  return `${MESES[Number(mes) - 1]} ${anio}`;
}

// Mueve un período mensual n meses (±). '2026-01' con -1 -> '2025-12'.
export function moverPeriodo(periodo, pasos) {
  const [anio, mes] = String(periodo).split('-').map(Number);
  const d = new Date(anio, (mes - 1) + pasos, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

// ---------------------------------------------------------------------
// PENDIENTES DEL MES
// ---------------------------------------------------------------------
// Quiénes NO entregaron todavía. Se calcula acá (no en la vista ni en la
// base) para poder probarlo y para que el panel de inicio y la sección
// de galería muestren exactamente lo mismo.
//
//   profesionales: [{ id, nombre_completo, profesion }] (activos)
//   informes:      los informes MENSUALES cargados, tal como salen de
//                  `evaluaciones`: [{ profesional_id, tipo, fecha }].
//                  Alcanza con UNO en el mes para estar al día.
//   fotos:         [{ profesional_id, periodo }]
//
// Devuelve { periodo, informes: [prof…], fotos: [prof…], alDia: bool }.
export function pendientesDelMes({ profesionales = [], informes = [], fotos = [], periodo = periodoMensual() } = {}) {
  const conInforme = new Set(
    informes
      .filter(i => i.tipo === 'mensual' && periodoMensual(i.fecha) === periodo)
      .map(i => String(i.profesional_id))
  );

  // Cuántas fotos subió cada profesional en ese mes.
  const fotosPorProf = {};
  fotos
    .filter(f => f.periodo === periodo)
    .forEach(f => {
      const k = String(f.profesional_id);
      fotosPorProf[k] = (fotosPorProf[k] || 0) + 1;
    });

  const sinInforme = profesionales.filter(p => !conInforme.has(String(p.id)));
  const sinFoto = profesionales.filter(p => (fotosPorProf[String(p.id)] || 0) < FOTOS_MINIMAS_POR_MES);

  return {
    periodo,
    informes: sinInforme,
    fotos: sinFoto,
    alDia: sinInforme.length === 0 && sinFoto.length === 0,
  };
}

// Quiénes deben el informe ANUAL de un año.
export function pendientesDelAnio({ profesionales = [], informes = [], periodo = periodoAnual() } = {}) {
  const entregaron = new Set(
    informes
      .filter(i => i.tipo === 'anual' && periodoAnual(i.fecha) === periodo)
      .map(i => String(i.profesional_id))
  );
  return { periodo, informes: profesionales.filter(p => !entregaron.has(String(p.id))) };
}

// ---------------------------------------------------------------------
// LIMPIEZA DE FOTOS
// ---------------------------------------------------------------------
// Fotos que ya cumplieron su vida útil (más de `meses` desde que se
// subieron). Devuelve las fotos a borrar: el modelo se encarga de sacar
// el archivo del Storage y después la fila.
export function fotosVencidas(fotos = [], hoy = hoyISO(), meses = MESES_A_CONSERVAR_FOTOS) {
  const limite = new Date(`${hoy}T00:00:00`);
  limite.setMonth(limite.getMonth() - meses);

  return fotos.filter(f => {
    if (!f.created_at) return false;
    return new Date(f.created_at) < limite;
  });
}
