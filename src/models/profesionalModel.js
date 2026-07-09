// =====================================================================
// MODELO: Profesionales
// ---------------------------------------------------------------------
// CAPA MODELO. Acceso a datos de la tabla `profesionales`.
// =====================================================================

import { supabase } from '../config/supabaseClient.js';

const TABLA = 'profesionales';

// Lista profesionales ordenados por nombre.
// Incluye el conteo de pacientes asignados embebido desde la tabla
// `asignaciones` (PostgREST devuelve asignaciones: [{ count: N }]).
export async function listarProfesionales({ soloActivos = false } = {}) {
  let query = supabase
    .from(TABLA)
    .select('*, asignaciones(count)')
    .order('nombre_completo', { ascending: true });

  if (soloActivos) query = query.eq('estado', 'activo');

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// Cuenta profesionales activos (para el KPI del panel de inicio).
export async function contarProfesionalesActivos() {
  const { count, error } = await supabase
    .from(TABLA)
    .select('*', { count: 'exact', head: true })
    .eq('estado', 'activo');
  if (error) throw error;
  return count ?? 0;
}

// Trae un profesional por id.
export async function obtenerProfesional(id) {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

// Crea un profesional nuevo y devuelve el registro insertado.
export async function crearProfesional(datos) {
  const { data, error } = await supabase
    .from(TABLA)
    .insert(datos)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Actualiza un profesional existente y devuelve el registro actualizado.
export async function actualizarProfesional(id, datos) {
  const { data, error } = await supabase
    .from(TABLA)
    .update(datos)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Elimina un profesional. Puede fallar si tiene asignaciones (clave
// foránea): en ese caso conviene marcarlo inactivo en lugar de borrarlo.
export async function eliminarProfesional(id) {
  const { error } = await supabase
    .from(TABLA)
    .delete()
    .eq('id', id);
  if (error) throw error;
}
