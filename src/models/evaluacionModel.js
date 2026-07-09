// =====================================================================
// MODELO: Evaluaciones diarias
// ---------------------------------------------------------------------
// CAPA MODELO. Acceso a la tabla `evaluaciones`: la evaluación diaria que
// hace un profesional de cada paciente. UNIQUE (paciente_id,
// profesional_id, fecha) => se usa UPSERT (una por paciente/prof/día).
// =====================================================================

import { supabase } from '../config/supabaseClient.js';

const TABLA = 'evaluaciones';

// Evaluaciones que hizo un profesional en una fecha, con el paciente.
export async function listarPorProfesionalFecha(profesionalId, fecha) {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*, pacientes(nombre_completo, dni)')
    .eq('profesional_id', profesionalId)
    .eq('fecha', fecha);
  if (error) throw error;
  return data;
}

// Todas las evaluaciones de UN paciente (para su historia clínica),
// con el profesional que las hizo, de la más reciente a la más vieja.
export async function listarPorPaciente(pacienteId) {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*, profesionales(nombre_completo, profesion, especialidad, matricula)')
    .eq('paciente_id', pacienteId)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return data;
}

// Guarda (o actualiza) la evaluación de un paciente por un profesional
// en una fecha. Upsert por (paciente_id, profesional_id, fecha).
export async function guardarEvaluacion({ pacienteId, profesionalId, fecha, contenido, turnoId = null }) {
  const { data, error } = await supabase
    .from(TABLA)
    .upsert(
      {
        paciente_id: pacienteId,
        profesional_id: profesionalId,
        fecha,
        contenido: contenido || null,
        turno_id: turnoId,
      },
      { onConflict: 'paciente_id,profesional_id,fecha' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}
