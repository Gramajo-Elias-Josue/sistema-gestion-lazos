// =====================================================================
// MODELO: Admisión (checklist de documentación)
// ---------------------------------------------------------------------
// CAPA MODELO. Maneja el checklist de documentación que se controla
// durante la admisión de un paciente (tabla `admision_documentos`).
// Cada fila = un requisito de un paciente, con su marca de presentado.
//
// El cambio de estado de admisión del paciente (aprobar / rechazar) vive
// en pacienteModel.cambiarEstadoAdmision, porque toca la tabla pacientes.
// =====================================================================

import { supabase } from '../config/supabaseClient.js';

const TABLA = 'admision_documentos';

// Trae el checklist guardado de un paciente (los requisitos ya tocados).
// Los que nunca se marcaron simplemente no tienen fila: la vista los
// completa con la lista estándar de requisitos.
export async function listarChecklist(pacienteId) {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*')
    .eq('paciente_id', pacienteId);
  if (error) throw error;
  return data;
}

// Marca (o desmarca) un requisito como presentado. Upsert por la
// combinación única (paciente_id, requisito): inserta o actualiza.
export async function marcarRequisito(pacienteId, requisito, presentado, observaciones = null) {
  const { data, error } = await supabase
    .from(TABLA)
    .upsert(
      {
        paciente_id: pacienteId,
        requisito,
        presentado,
        observaciones: observaciones || null,
      },
      { onConflict: 'paciente_id,requisito' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}
