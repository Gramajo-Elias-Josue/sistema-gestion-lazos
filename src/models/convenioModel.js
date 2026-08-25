// =====================================================================
// MODELO: Convenios (obras sociales)
// ---------------------------------------------------------------------
// CAPA MODELO. Acceso a datos de la tabla `convenios`.
// Sección recién creada: por ahora solo lista (para el estado vacío). El
// alta/edición se agrega cuando se defina qué datos lleva cada convenio.
// =====================================================================

import { supabase } from '../config/supabaseClient.js';

const TABLA = 'convenios';

// Lista convenios, ordenados por nombre.
export async function listarConvenios() {
  const { data, error } = await supabase.from(TABLA).select('*').order('nombre', { ascending: true });
  if (error) throw error;
  return data;
}
