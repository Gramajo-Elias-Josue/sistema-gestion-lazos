// =====================================================================
// MODELO: Evaluaciones e informes
// ---------------------------------------------------------------------
// CAPA MODELO. Acceso a la tabla `evaluaciones`, que guarda DOS cosas
// distintas del mismo profesional sobre el mismo paciente:
//
//   - tipo 'diaria'  -> la evaluación del día (opcional, texto suelto).
//   - los INFORMES   -> 'mensual', 'anual', 'evolucion', 'admision'
//                       (obligatorios, JSON con título y cuerpo).
//
// El `tipo` forma parte de la clave única junto con paciente, profesional
// y fecha: si no, el informe del mes pisaba la evaluación diaria del
// mismo día (se entreveraban).
// =====================================================================

import { supabase } from '../config/supabaseClient.js';

const TABLA = 'evaluaciones';

// El tipo de la evaluación del día (para distinguirla de los informes).
export const TIPO_DIARIA = 'diaria';

// Evaluaciones DIARIAS que hizo un profesional en una fecha.
export async function listarPorProfesionalFecha(profesionalId, fecha) {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*, pacientes(nombre_completo, dni)')
    .eq('profesional_id', profesionalId)
    .eq('fecha', fecha)
    .eq('tipo', TIPO_DIARIA);
  if (error) throw error;
  return data;
}

// Evaluaciones de UN paciente para su historia clínica, con el
// profesional que las hizo, de la más reciente a la más vieja.
// Por defecto trae solo los INFORMES: la evaluación diaria es material
// de trabajo del día y no tiene por qué mezclarse en el legajo.
export async function listarPorPaciente(pacienteId, { incluirDiarias = false } = {}) {
  let query = supabase
    .from(TABLA)
    .select('*, profesionales(nombre_completo, profesion, especialidad, matricula)')
    .eq('paciente_id', pacienteId)
    .order('fecha', { ascending: false });
  if (!incluirDiarias) query = query.neq('tipo', TIPO_DIARIA);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// Informes de un tipo dentro de un rango de fechas, con el profesional
// embebido. Sirve para saber quién entregó el informe del mes y quién no.
export async function listarInformesPorRango(tipo, desde, hasta) {
  const { data, error } = await supabase
    .from(TABLA)
    .select('id, profesional_id, fecha, tipo, profesionales(nombre_completo, profesion)')
    .eq('tipo', tipo)
    .gte('fecha', desde)
    .lte('fecha', hasta);
  if (error) throw error;
  return data || [];
}

// Guarda (o actualiza) una evaluación o informe.
// Upsert por (paciente_id, profesional_id, fecha, tipo).
export async function guardarEvaluacion({
  pacienteId, profesionalId, fecha, contenido, turnoId = null, tipo = TIPO_DIARIA,
}) {
  const { data, error } = await supabase
    .from(TABLA)
    .upsert(
      {
        paciente_id: pacienteId,
        profesional_id: profesionalId,
        fecha,
        contenido: contenido || null,
        turno_id: turnoId,
        tipo,
      },
      { onConflict: 'paciente_id,profesional_id,fecha,tipo' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}
