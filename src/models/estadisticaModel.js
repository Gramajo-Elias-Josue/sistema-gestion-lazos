// =====================================================================
// MODELO: Estadísticas
// ---------------------------------------------------------------------
// CAPA MODELO. Trae de una vez, y solo con las columnas necesarias, todo
// lo que usan las estadísticas de un rango de meses. No hay tablas ni
// consultas especiales: los números se calculan en utils/estadisticas.js.
//
// La RLS decide qué ve cada uno: facturación y gastos solo los devuelve
// a dirección y secretaría (a otro rol le llegan vacíos).
// =====================================================================

import { supabase } from '../config/supabaseClient.js';

// Supabase devuelve como mucho 1000 filas por pedido. La asistencia de
// seis meses las supera, así que se pide de a páginas hasta traer todo.
const PAGINA = 1000;
async function traerTodo(armarConsulta) {
  const filas = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await armarConsulta().range(desde, desde + PAGINA - 1);
    if (error) throw error;
    filas.push(...(data || []));
    if (!data || data.length < PAGINA) return filas;
  }
}

// Todo lo necesario para las estadísticas entre `desde` y `hasta`
// (yyyy-mm-dd). `meses` = los períodos 'yyyy-mm' de ese rango.
export async function datosDelRango({ desde, hasta, meses }) {
  const enRango = (tabla, columnas) => () =>
    supabase.from(tabla).select(columnas).gte('fecha', desde).lte('fecha', hasta).order('fecha');

  const [
    asistencias, fichajes, pacientes, profesionales, sectores,
    asignaciones, evaluaciones, turnos, facturacion, gastos,
  ] = await Promise.all([
    traerTodo(enRango('asistencias', 'paciente_id, fecha, estado')),
    traerTodo(enRango('asistencias_profesionales', 'profesional_id, fecha, estado')),
    traerTodo(() => supabase.from('pacientes')
      .select('id, nombre_completo, estado, estado_admision, tiene_cud, fecha_ingreso, created_at').order('id')),
    traerTodo(() => supabase.from('profesionales')
      .select('id, nombre_completo, sector, estado').order('id')),
    traerTodo(() => supabase.from('sectores').select('clave, etiqueta, orden').eq('activo', true).order('orden')),
    traerTodo(() => supabase.from('asignaciones')
      .select('profesional_id, paciente_id, hora').is('vigente_hasta', null).order('id')),
    traerTodo(() => enRango('evaluaciones', 'profesional_id, paciente_id, fecha, tipo')().neq('tipo', 'diaria')),
    // La agenda es solo de casuales: los turnos viejos con paciente de
    // legajo (de antes de separar la agenda) no se cuentan.
    traerTodo(() => enRango('turnos', 'fecha, estado')().is('paciente_id', null)),
    traerTodo(() => supabase.from('facturacion').select('paciente_id, periodo, estado').in('periodo', meses).order('periodo')),
    traerTodo(enRango('gastos', 'fecha, monto, socio, categoria')),
  ]);

  return { asistencias, fichajes, pacientes, profesionales, sectores, asignaciones, evaluaciones, turnos, facturacion, gastos };
}
