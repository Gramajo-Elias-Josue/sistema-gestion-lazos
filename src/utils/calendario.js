// =====================================================================
// UTILIDADES: Calendario de asistencia
// ---------------------------------------------------------------------
// Funciones PURAS que arman la grilla mensual de asistencia (la misma
// que usan la planilla de pacientes y el fichaje de profesionales) y su
// resumen. No tocan el DOM ni Supabase: reciben los registros y
// devuelven los días ya clasificados, listos para pintar en pantalla o
// en el PDF.
//
// Regla del centro: sábados y domingos la clínica NO abre, así que esos
// días no cuentan como inasistencia (se muestran en gris).
// =====================================================================

import { hoyISO } from './fechas.js';

// Estados posibles de un día, con su etiqueta, la clase CSS que lo pinta
// y el color RGB equivalente para el PDF (mismos colores en pantalla y
// en papel).
export const ESTADOS_CALENDARIO = {
  presente:          { etiqueta: 'Presente',           clase: 'cal-ok',   rgb: [42, 157, 110] },
  ausente:           { etiqueta: 'Ausente',            clase: 'cal-bad',  rgb: [212, 66, 66] },
  ausente_con_aviso: { etiqueta: 'Ausente con aviso',  clase: 'cal-avi',  rgb: [224, 154, 38] },
  enfermedad:        { etiqueta: 'Enfermedad',         clase: 'cal-enf',  rgb: [138, 108, 214] },
  licencia:          { etiqueta: 'Licencia',           clase: 'cal-avi',  rgb: [224, 154, 38] },
};

// Días de la semana, de lunes a domingo (como se lee la planilla).
export const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const pad = (n) => String(n).padStart(2, '0');

// Nombre del mes con el año. Ej: "Julio 2026".
export function etiquetaMes(anio, mes) {
  return `${MESES[mes - 1]} ${anio}`;
}

// Primer y último día del mes en ISO, para pedirle el rango a la base.
export function rangoDelMes(anio, mes) {
  return {
    desde: `${anio}-${pad(mes)}-01`,
    hasta: `${anio}-${pad(mes)}-${pad(new Date(anio, mes, 0).getDate())}`,
  };
}

// Mueve el mes n posiciones (±1 = mes anterior / siguiente), sin salirse
// de rango: diciembre + 1 = enero del año siguiente.
export function moverMes(anio, mes, pasos) {
  const d = new Date(anio, mes - 1 + pasos, 1);
  return { anio: d.getFullYear(), mes: d.getMonth() + 1 };
}

// Índice de semana (0 = primera fila del calendario) al que pertenece una
// fecha del mes. Sirve para abrir la tira de la fila de la planilla en la
// semana que corresponde en vez del mes entero.
export function semanaDeFecha(anio, mes, fechaISO) {
  const dia = Number(fechaISO.split('-')[2]);
  const offset = (new Date(anio, mes - 1, 1).getDay() + 6) % 7;
  return Math.floor((offset + dia - 1) / 7);
}

// Cantidad de semanas (filas de 7 días) que ocupa el mes en el calendario.
export function semanasDelMes(anio, mes) {
  const diasDelMes = new Date(anio, mes, 0).getDate();
  const offset = (new Date(anio, mes - 1, 1).getDay() + 6) % 7;
  return Math.ceil((offset + diasDelMes) / 7);
}

// Mes y año de una fecha ISO (yyyy-mm-dd). Sin argumento, el de hoy.
export function mesDeFecha(fechaISO = hoyISO()) {
  const [a, m] = fechaISO.split('-').map(Number);
  return { anio: a, mes: m };
}

// Arma el mes completo:
//   semanas -> filas de 7 celdas (lunes a domingo); null = relleno
//   dias    -> solo los días reales del mes
//   resumen -> conteos para la ficha
//
//   anio, mes  -> mes a dibujar (mes de 1 a 12)
//   registros  -> [{ fecha, estado, observaciones, hora_entrada, hora_salida }]
//   hoy        -> fecha de referencia (los días posteriores no se juzgan)
export function armarCalendario({ anio, mes, registros = [], hoy = hoyISO() }) {
  const porFecha = {};
  registros.forEach(r => { porFecha[r.fecha] = r; });

  const diasDelMes = new Date(anio, mes, 0).getDate();
  // getDay() devuelve 0 para domingo; se corre para que la semana empiece
  // el lunes (0 = lunes … 6 = domingo).
  const offset = (new Date(anio, mes - 1, 1).getDay() + 6) % 7;

  const celdas = Array(offset).fill(null);
  for (let d = 1; d <= diasDelMes; d++) {
    const iso = `${anio}-${pad(mes)}-${pad(d)}`;
    const diaSemana = new Date(anio, mes - 1, d).getDay();
    const reg = porFecha[iso] || null;
    celdas.push({
      iso,
      dia: d,
      finde: diaSemana === 0 || diaSemana === 6, // la clínica no abre
      futuro: iso > hoy,
      estado: reg?.estado ?? null,
      nota: reg?.observaciones ?? null,
      entrada: reg?.hora_entrada ?? null,
      salida: reg?.hora_salida ?? null,
    });
  }
  while (celdas.length % 7 !== 0) celdas.push(null);

  const semanas = [];
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7));

  const dias = celdas.filter(Boolean);
  return { anio, mes, semanas, dias, resumen: resumirMes(dias) };
}

// Resumen del mes. Los días hábiles son los de semana ya transcurridos:
// el fin de semana no se cuenta (la clínica está cerrada) y el futuro
// tampoco (todavía no pasó).
export function resumirMes(dias) {
  const habiles = dias.filter(d => !d.finde && !d.futuro);
  const cuenta = (estado) => habiles.filter(d => d.estado === estado).length;

  const presentes = cuenta('presente');
  const ausentes = cuenta('ausente');
  const avisados = cuenta('ausente_con_aviso') + cuenta('licencia') + cuenta('enfermedad');
  const registrados = presentes + ausentes + avisados;

  return {
    habiles: habiles.length,
    presentes,
    ausentes,
    avisados,
    registrados,
    sinRegistro: habiles.length - registrados,
    // Presentismo sobre los días con registro (no se castiga lo no cargado).
    pct: registrados ? Math.round((presentes / registrados) * 100) : 0,
  };
}
