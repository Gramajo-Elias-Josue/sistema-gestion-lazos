// =====================================================================
// UTILIDAD: Exportar a Excel (.xlsx)
// ---------------------------------------------------------------------
// Dos partes:
//   - Funciones PURAS que arman las filas de cada planilla (qué columnas
//     y qué datos van). Se pueden testear sin navegador.
//   - `descargarExcel`, que arma el archivo con SheetJS y lo descarga.
//     SheetJS se importa de forma dinámica (import()): pesa, así que se
//     baja recién cuando alguien toca "Exportar a Excel".
// =====================================================================

import { formatearFecha } from './fechas.js';
import { etiquetaPeriodo } from './periodos.js';
import { resumenPorSocio, totalGastos } from './gastos.js';
import { ESTADOS_FACTURACION, ESTADO_POR_DEFECTO } from './facturacion.js';
import { minutosDia, horarioTexto, enHoras } from './controlHoras.js';

// Formato de pesos para las celdas de monto (Excel lo muestra con el
// separador de la configuración regional de quien lo abre).
const FORMATO_PESOS = '"$" #,##0.00';

// ---------------------------------------------------------------------
// GASTOS
// ---------------------------------------------------------------------
// Hoja 1: el detalle del mes. Hoja 2: cuánto pagó cada socio + el total.
// Los montos van como NÚMERO (no como texto), para poder sumar en Excel.
export function hojasGastos(gastos = [], periodo) {
  const detalle = [
    [`Gastos — ${etiquetaPeriodo(periodo)}`],
    [],
    ['Fecha', 'Concepto', 'Categoría', 'Socio', 'Monto'],
    ...gastos.map(g => [formatearFecha(g.fecha), g.concepto || '', g.categoria || '', g.socio || '', Number(g.monto || 0)]),
    [],
    ['', '', '', 'Total', totalGastos(gastos)],
  ];
  const porSocio = [
    [`Rendición por socio — ${etiquetaPeriodo(periodo)}`],
    [],
    ['Socio', 'Pagó'],
    ...resumenPorSocio(gastos).map(s => [s.socio, s.total]),
    [],
    ['Total', totalGastos(gastos)],
  ];
  return [
    { nombre: 'Gastos', filas: detalle, anchos: [12, 40, 18, 22, 16], columnasPesos: [4] },
    { nombre: 'Por socio', filas: porSocio, anchos: [26, 16], columnasPesos: [1] },
  ];
}

// ---------------------------------------------------------------------
// FACTURACIÓN
// ---------------------------------------------------------------------
// Un paciente por fila con su estado del mes (el que no tiene registro
// cuenta como "No facturado", igual que en pantalla) + un resumen al pie.
export function hojasFacturacion(pacientes = [], estadosPorId = {}, periodo) {
  const etiqueta = (valor) => ESTADOS_FACTURACION.find(e => e.valor === valor)?.label || valor;
  const cuenta = {};
  const filas = pacientes.map(p => {
    const estado = estadosPorId[p.id] || ESTADO_POR_DEFECTO;
    cuenta[estado] = (cuenta[estado] || 0) + 1;
    return [p.nombre_completo || '', p.dni || '', p.obra_social || 'Sin obra social', p.numero_afiliado || '', etiqueta(estado)];
  });
  return [{
    nombre: 'Facturación',
    filas: [
      [`Facturación — ${etiquetaPeriodo(periodo)}`],
      [],
      ['Paciente', 'DNI', 'Obra social', 'N° de afiliado', 'Estado'],
      ...filas,
      [],
      ...ESTADOS_FACTURACION.map(e => ['', '', '', e.label, cuenta[e.valor] || 0]),
    ],
    anchos: [30, 12, 22, 16, 16],
    columnasPesos: [],
  }];
}

// ---------------------------------------------------------------------
// DESCARGA
// ---------------------------------------------------------------------
// hojas: [{ nombre, filas: [[...]], anchos: [n…], columnasPesos: [i…] }]
// ---------------------------------------------------------------------
// CONTROL DE HORAS (sueldos)
// ---------------------------------------------------------------------
// Hoja 1: un profesional por fila, días y horas según la planilla de la
// secretaría y según su propio fichaje. Hoja 2: el detalle día por día,
// con lo que no cuadra. Las horas van como NÚMERO (con decimales: 7,5 =
// 7 h 30 min) para poder sumarlas o multiplicarlas por el valor hora.
// `resumen` = lo que devuelve resumenControlHoras() (utils/controlHoras.js).
export function hojasControlHoras(resumen = [], periodo) {
  const titulo = `Control de horas — ${etiquetaPeriodo(periodo)}`;
  const totales = [
    [titulo],
    [],
    ['Profesional', 'Profesión', 'Días (secretaría)', 'Horas (secretaría)', 'Días (su fichaje)', 'Horas (su fichaje)', 'Diferencia (horas)', 'Días que no cuadran'],
    ...resumen.map(r => [
      r.profesional.nombre_completo || '', r.profesional.profesion || '',
      r.diasPlanilla, enHoras(r.minPlanilla), r.diasPropio, enHoras(r.minPropio),
      enHoras(r.minPropio - r.minPlanilla), r.alertas,
    ]),
  ];
  const detalle = [
    [`Detalle por día — ${etiquetaPeriodo(periodo)}`],
    [],
    ['Profesional', 'Fecha', 'Planilla: estado', 'Planilla: horario', 'Su fichaje: horario', 'Horas (secretaría)', 'Horas (su fichaje)', 'Observación'],
    ...resumen.flatMap(r => r.dias.map(d => [
      r.profesional.nombre_completo || '', formatearFecha(d.fecha),
      d.planilla?.estado || 'Sin planilla', horarioTexto(d.planilla), horarioTexto(d.propio),
      enHoras(minutosDia(d.planilla)), enHoras(minutosDia(d.propio)), d.alerta || '',
    ])),
  ];
  return [
    { nombre: 'Resumen', filas: totales, anchos: [28, 18, 16, 18, 16, 18, 18, 18] },
    { nombre: 'Detalle', filas: detalle, anchos: [28, 12, 16, 26, 26, 16, 16, 34] },
  ];
}

export async function descargarExcel(nombreArchivo, hojas) {
  const XLSX = await import('xlsx');
  const libro = XLSX.utils.book_new();
  hojas.forEach(h => {
    const hoja = XLSX.utils.aoa_to_sheet(h.filas);
    hoja['!cols'] = (h.anchos || []).map(wch => ({ wch }));
    // Formato de pesos en las celdas numéricas de las columnas de monto.
    h.filas.forEach((fila, r) => {
      (h.columnasPesos || []).forEach(c => {
        const celda = hoja[XLSX.utils.encode_cell({ r, c })];
        if (celda && celda.t === 'n') celda.z = FORMATO_PESOS;
      });
    });
    XLSX.utils.book_append_sheet(libro, hoja, h.nombre);
  });
  XLSX.writeFile(libro, nombreArchivo);
}
