// =====================================================================
// MODELO: Asistencia de profesionales (fichaje)
// ---------------------------------------------------------------------
// CAPA MODELO. Acceso a la tabla `asistencias_profesionales`: el fichaje
// diario de cada profesional (entrada / salida / estado). UNIQUE
// (profesional_id, fecha) => se usa UPSERT.
// =====================================================================

import { supabase } from '../config/supabaseClient.js';

const TABLA = 'asistencias_profesionales';

// Fichajes registrados en una fecha (yyyy-mm-dd).
export async function listarPorFecha(fecha) {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*')
    .eq('fecha', fecha);
  if (error) throw error;
  return data;
}

// Fichajes de un profesional dentro de un rango (para informes).
export async function listarPorProfesionalRango(profesionalId, desde, hasta) {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*')
    .eq('profesional_id', profesionalId)
    .gte('fecha', desde)
    .lte('fecha', hasta);
  if (error) throw error;
  return data;
}

// Registra o actualiza el fichaje de un profesional en una fecha.
export async function guardarFichaje({ profesionalId, fecha, horaEntrada, horaSalida, estado, observaciones }) {
  const { data, error } = await supabase
    .from(TABLA)
    .upsert(
      {
        profesional_id: profesionalId,
        fecha,
        hora_entrada: horaEntrada || null,
        hora_salida: horaSalida || null,
        estado: estado || 'presente',
        observaciones: observaciones || null,
      },
      { onConflict: 'profesional_id,fecha' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}
