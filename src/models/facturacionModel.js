// =====================================================================
// MODELO: Facturación
// ---------------------------------------------------------------------
// CAPA MODELO. Acceso a datos de la tabla `facturacion`: SOLO control de
// estado (no facturado / facturado y no cobrado / facturado y cobrado)
// por paciente y por mes. No genera facturas ni montos: es una planilla
// de seguimiento, como la de asistencia.
// La tabla tiene UNIQUE(paciente_id, periodo): por eso se usa UPSERT.
// =====================================================================

import { supabase } from '../config/supabaseClient.js';

const TABLA = 'facturacion';

// Estados de facturación registrados en un período ('yyyy-mm').
export async function listarPorPeriodo(periodo) {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*')
    .eq('periodo', periodo);
  if (error) throw error;
  return data;
}

// Registra o actualiza el estado de un paciente en un período (upsert
// por paciente_id + periodo).
export async function guardarEstado({ pacienteId, periodo, estado, nota }) {
  const { data, error } = await supabase
    .from(TABLA)
    .upsert(
      { paciente_id: pacienteId, periodo, estado, nota: nota || null, updated_at: new Date().toISOString() },
      { onConflict: 'paciente_id,periodo' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}
