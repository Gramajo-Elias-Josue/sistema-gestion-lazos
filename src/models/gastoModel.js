// =====================================================================
// MODELO: Gastos
// ---------------------------------------------------------------------
// CAPA MODELO. Acceso a datos de la tabla `gastos`. Cada gasto queda
// atado a qué socio lo pagó (para rendir cuentas entre los dueños).
// =====================================================================

import { supabase } from '../config/supabaseClient.js';

const TABLA = 'gastos';

// Gastos dentro de un rango de fechas (yyyy-mm-dd), del más nuevo al más viejo.
export async function listarPorRango(desde, hasta) {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*')
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return data;
}

// Crea un gasto nuevo.
export async function crearGasto({ fecha, concepto, monto, socio, categoria }) {
  const { data, error } = await supabase
    .from(TABLA)
    .insert({ fecha, concepto, monto, socio, categoria: categoria || null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Elimina un gasto (se cargó mal, o hay que corregirlo con uno nuevo).
export async function eliminarGasto(id) {
  const { error } = await supabase.from(TABLA).delete().eq('id', id);
  if (error) throw error;
}
