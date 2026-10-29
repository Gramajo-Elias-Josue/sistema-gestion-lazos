// =====================================================================
// MODELO: Configuración del centro
// ---------------------------------------------------------------------
// CAPA MODELO. Acceso a la tabla `configuracion_centro` (una sola fila):
// la ubicación del centro y el radio permitido para el fichaje por
// ubicación. La lee cualquier usuario logueado; la cambia solo el
// director (lo hace cumplir la RLS, script 16).
// =====================================================================

import { supabase } from '../config/supabaseClient.js';

const TABLA = 'configuracion_centro';

// La fila de configuración ({ latitud, longitud, radio_m, updated_at }).
export async function obtenerConfiguracion() {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*')
    .eq('id', true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Guarda la ubicación del centro y el radio.
export async function guardarUbicacion({ latitud, longitud, radio_m }) {
  const { data, error } = await supabase
    .from(TABLA)
    .update({ latitud, longitud, radio_m, updated_at: new Date().toISOString() })
    .eq('id', true)
    .select()
    .single();
  if (error) throw error;
  return data;
}
