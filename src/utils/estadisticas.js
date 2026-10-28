// =====================================================================
// UTILIDADES: Estadísticas
// ---------------------------------------------------------------------
// Funciones PURAS (sin DOM ni Supabase). Reciben las filas tal como
// salen de la base y devuelven los números que dibuja la vista. Se
// calculan acá, y no con consultas especiales, para poder probarlas y
// para no tocar la base: todo sale de lo que el sistema ya guarda.
//
// Un "período" es 'yyyy-mm' (ver periodos.js). Las tendencias muestran
// los últimos MESES_TENDENCIA meses hasta el mes elegido.
// =====================================================================

import { moverPeriodo, periodoMensual } from './periodos.js';
import { rangoMes } from './fechas.js';

export const MESES_TENDENCIA = 6;

// Porcentaje entero (0 si no hay base para calcularlo).
export const porcentaje = (parte, total) => (total ? Math.round((parte * 100) / total) : 0);

// Los `n` meses que terminan en `periodo`, del más viejo al más nuevo.
// '2026-10' con 3 -> ['2026-08', '2026-09', '2026-10'].
export function mesesHasta(periodo, n = MESES_TENDENCIA) {
  return Array.from({ length: n }, (_, i) => moverPeriodo(periodo, i - (n - 1)));
}

// Rango de fechas que cubre una lista de meses: { desde, hasta }.
export function rangoDeMeses(meses) {
  return { desde: `${meses[0]}-01`, hasta: rangoMes(`${meses[meses.length - 1]}-01`).hasta };
}

// Agrupa filas por el mes de una fecha: { '2026-10': [filas…] }.
function porMes(filas, campo = 'fecha') {
  const grupos = {};
  filas.forEach(f => {
    const k = periodoMensual(f[campo]);
    (grupos[k] ||= []).push(f);
  });
  return grupos;
}

// ---------------------------------------------------------------------
// ASISTENCIA
// ---------------------------------------------------------------------

// Asistencia del centro mes a mes: cuántos registros hubo de cada estado
// y el % de presentes sobre lo registrado.
export function asistenciaPorMes(asistencias = [], meses = []) {
  const grupos = porMes(asistencias);
  return meses.map(periodo => {
    const regs = grupos[periodo] || [];
    const cuenta = (estado) => regs.filter(r => r.estado === estado).length;
    const presentes = cuenta('presente');
    return {
      periodo, total: regs.length, presentes,
      ausentes: cuenta('ausente'), aviso: cuenta('ausente_con_aviso'), enfermedad: cuenta('enfermedad'),
      pct: porcentaje(presentes, regs.length),
    };
  });
}

// Pacientes que más faltaron en el mes (ausente, con aviso o enfermo),
// de más a menos faltas. Solo los que faltaron al menos una vez.
export function ausentismoPorPaciente(asistencias = [], pacientes = [], periodo, limite = 8) {
  const nombre = Object.fromEntries(pacientes.map(p => [String(p.id), p.nombre_completo]));
  const porPaciente = {};
  asistencias
    .filter(a => periodoMensual(a.fecha) === periodo)
    .forEach(a => {
      const k = String(a.paciente_id);
      const fila = (porPaciente[k] ||= { id: k, nombre: nombre[k] || 'Paciente', registros: 0, faltas: 0 });
      fila.registros++;
      if (a.estado !== 'presente') fila.faltas++;
    });
  return Object.values(porPaciente)
    .filter(f => f.faltas > 0)
    .map(f => ({ ...f, pct: porcentaje(f.registros - f.faltas, f.registros) }))
    .sort((a, b) => b.faltas - a.faltas || a.nombre.localeCompare(b.nombre))
    .slice(0, limite);
}

// Fichaje de cada profesional activo en el mes: días presente, ausente y
// de licencia. Ordenado por nombre.
export function fichajePorProfesional(fichajes = [], profesionales = [], periodo) {
  const delMes = fichajes.filter(f => periodoMensual(f.fecha) === periodo);
  return profesionales
    .filter(p => p.estado !== 'inactivo')
    .map(p => {
      const suyos = delMes.filter(f => String(f.profesional_id) === String(p.id));
      const cuenta = (estado) => suyos.filter(f => f.estado === estado).length;
      return {
        id: p.id, nombre: p.nombre_completo,
        presentes: cuenta('presente'), ausentes: cuenta('ausente'), licencias: cuenta('licencia'),
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

// ---------------------------------------------------------------------
// ATENCIÓN Y GRILLA
// ---------------------------------------------------------------------

// Situación de los pacientes hoy. `pacientes` = todos (admitidos o no).
export function resumenPacientes(pacientes = []) {
  const admitidos = pacientes.filter(p => p.estado_admision === 'admitido');
  const activos = admitidos.filter(p => p.estado === 'activo');
  return {
    activos: activos.length,
    inactivos: admitidos.length - activos.length,
    enAdmision: pacientes.filter(p => p.estado_admision === 'en_admision').length,
    conCud: activos.filter(p => p.tiene_cud).length,
  };
}

// Pacientes admitidos que ingresaron cada mes (por su fecha de ingreso;
// si no la tienen, por la fecha en que se cargaron).
export function ingresosPorMes(pacientes = [], meses = []) {
  const admitidos = pacientes
    .filter(p => p.estado_admision === 'admitido')
    .map(p => ({ fecha: p.fecha_ingreso || String(p.created_at || '').slice(0, 10) }));
  const grupos = porMes(admitidos);
  return meses.map(periodo => ({ periodo, valor: (grupos[periodo] || []).length }));
}

// Cuántos pacientes distintos atiende cada profesión en la grilla vigente.
// Las profesiones salen de `sectores` (en su orden); un profesional sin
// sector cuenta como "Sin profesión".
export function pacientesPorProfesion(asignaciones = [], profesionales = [], sectores = []) {
  const sectorDe = Object.fromEntries(profesionales.map(p => [String(p.id), p.sector || '']));
  const pacientes = {};
  asignaciones
    .filter(a => a.paciente_id)
    .forEach(a => {
      const k = sectorDe[String(a.profesional_id)] || '';
      (pacientes[k] ||= new Set()).add(String(a.paciente_id));
    });
  const filas = [...sectores]
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
    .map(s => ({ clave: s.clave, etiqueta: s.etiqueta, valor: pacientes[s.clave]?.size || 0 }));
  if (pacientes['']?.size) filas.push({ clave: '', etiqueta: 'Sin profesión', valor: pacientes[''].size });
  return filas;
}

// ---------------------------------------------------------------------
// INFORMES Y TURNOS
// ---------------------------------------------------------------------

// Informes y certificados emitidos por mes. Los "informes" son los
// periódicos (mensual, anual, evolución, admisión).
export function documentosPorMes(evaluaciones = [], meses = []) {
  const grupos = porMes(evaluaciones);
  return meses.map(periodo => {
    const delMes = grupos[periodo] || [];
    const certificados = delMes.filter(e => e.tipo === 'certificado').length;
    return { periodo, informes: delMes.length - certificados, certificados };
  });
}

// Informe mensual de cada profesional: de sus pacientes en la grilla,
// a cuántos ya les cargó el informe mensual del período.
export function entregasDeInformes(evaluaciones = [], profesionales = [], asignaciones = [], periodo) {
  return profesionales
    .filter(p => p.estado !== 'inactivo')
    .map(p => {
      const suyos = new Set(
        asignaciones.filter(a => String(a.profesional_id) === String(p.id) && a.paciente_id).map(a => String(a.paciente_id))
      );
      const conInforme = new Set(
        evaluaciones
          .filter(e => e.tipo === 'mensual' && String(e.profesional_id) === String(p.id) && periodoMensual(e.fecha) === periodo)
          .map(e => String(e.paciente_id))
      );
      const entregados = [...suyos].filter(id => conInforme.has(id)).length;
      return { id: p.id, nombre: p.nombre_completo, entregados, pacientes: suyos.size, pct: porcentaje(entregados, suyos.size) };
    })
    .filter(f => f.pacientes > 0)
    .sort((a, b) => a.pct - b.pct || a.nombre.localeCompare(b.nombre));
}

// Turnos de pacientes casuales por mes, separados por estado.
export function turnosCasualesPorMes(turnos = [], meses = []) {
  const grupos = porMes(turnos);
  return meses.map(periodo => {
    const delMes = grupos[periodo] || [];
    const cuenta = (estado) => delMes.filter(t => t.estado === estado).length;
    return {
      periodo, total: delMes.length,
      atendidos: cuenta('atendido'), ausentes: cuenta('ausente'), cancelados: cuenta('cancelado'), programados: cuenta('programado'),
    };
  });
}

// ---------------------------------------------------------------------
// GESTIÓN
// ---------------------------------------------------------------------

// Pacientes facturados (sin cobrar) y cobrados en cada mes. El "no
// facturado" no tiene fila en la base, por eso acá no se cuenta.
export function facturacionPorMes(filas = [], meses = []) {
  return meses.map(periodo => {
    const delMes = filas.filter(f => f.periodo === periodo);
    return {
      periodo,
      facturados: delMes.filter(f => f.estado === 'facturado_no_cobrado').length,
      cobrados: delMes.filter(f => f.estado === 'facturado_cobrado').length,
    };
  });
}

// Total gastado en cada mes.
export function gastosPorMes(gastos = [], meses = []) {
  const grupos = porMes(gastos);
  return meses.map(periodo => ({
    periodo, valor: (grupos[periodo] || []).reduce((acc, g) => acc + Number(g.monto || 0), 0),
  }));
}

// Total por categoría, de mayor a menor. Sin categoría -> "Sin categoría".
export function gastosPorCategoria(gastos = []) {
  const totales = {};
  gastos.forEach(g => {
    const k = (g.categoria || '').trim() || 'Sin categoría';
    totales[k] = (totales[k] ?? 0) + Number(g.monto || 0);
  });
  return Object.entries(totales)
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total);
}
