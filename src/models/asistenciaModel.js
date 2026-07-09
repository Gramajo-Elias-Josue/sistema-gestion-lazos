// =====================================================================
// MODELO: Asistencias
// ---------------------------------------------------------------------
// CAPA MODELO. Acceso a datos de la tabla `asistencias`.
// La tabla tiene una restricción UNIQUE(paciente_id, fecha): un paciente
// tiene como mucho un registro de asistencia por día. Por eso se usa
// UPSERT al guardar (inserta o actualiza según corresponda).
// =====================================================================

import { supabase } from '../config/supabaseClient.js';

const TABLA = 'asistencias';

// Asistencias registradas en una fecha dada (yyyy-mm-dd).
export async function listarAsistenciasPorFecha(fecha) {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*')
    .eq('fecha', fecha);
  if (error) throw error;
  return data;
}

// Asistencias dentro de un rango de fechas (para el resumen mensual).
// Trae solo las columnas necesarias para calcular porcentajes.
export async function listarAsistenciasRango(desde, hasta) {
  const { data, error } = await supabase
    .from(TABLA)
    .select('paciente_id, estado, fecha')
    .gte('fecha', desde)
    .lte('fecha', hasta);
  if (error) throw error;
  return data;
}

// Cuenta asistencias registradas en una fecha (para el KPI de inicio).
export async function contarAsistenciasHoy(fecha) {
  const { count, error } = await supabase
    .from(TABLA)
    .select('*', { count: 'exact', head: true })
    .eq('fecha', fecha);
  if (error) throw error;
  return count ?? 0;
}

// Registra o actualiza una asistencia (upsert por paciente_id + fecha).
// onConflict indica la combinación única que decide si inserta o actualiza.
export async function guardarAsistencia({ pacienteId, fecha, estado, observaciones, registradoPor }) {
  const { data, error } = await supabase
    .from(TABLA)
    .upsert(
      {
        paciente_id: pacienteId,
        fecha,
        estado,
        observaciones: observaciones || null,
        registrado_por: registradoPor || null,
      },
      { onConflict: 'paciente_id,fecha' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Guarda varias asistencias de una vez (para "marcar todos presentes").
// Un solo viaje a la base en lugar de un upsert por paciente.
export async function guardarAsistencias(registros) {
  const filas = registros.map(r => ({
    paciente_id: r.pacienteId,
    fecha: r.fecha,
    estado: r.estado,
    observaciones: r.observaciones || null,
  }));
  const { data, error } = await supabase
    .from(TABLA)
    .upsert(filas, { onConflict: 'paciente_id,fecha' })
    .select();
  if (error) throw error;
  return data;
}

// Quita la marca de un paciente en una fecha (volver a "sin marcar").
export async function eliminarAsistencia(pacienteId, fecha) {
  const { error } = await supabase
    .from(TABLA)
    .delete()
    .eq('paciente_id', pacienteId)
    .eq('fecha', fecha);
  if (error) throw error;
}
