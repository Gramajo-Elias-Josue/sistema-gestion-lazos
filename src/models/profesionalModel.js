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

// Cambia el estado del profesional ('activo' / 'inactivo').
// Se usa para la BAJA LÓGICA: no se borra el registro, solo se marca
// inactivo. Es lo mismo que hace pacienteModel.cambiarEstadoPaciente.
//
// No existe un borrado real a propósito: si se eliminara el registro se
// perderían sus turnos, sus fichajes de asistencia y la AUTORÍA de los
// informes que firmó. En una historia clínica el autor de un informe no
// puede desaparecer. Un profesional dado de baja se puede reactivar.
export async function cambiarEstadoProfesional(id, estado) {
  const { data, error } = await supabase
    .from(TABLA)
    .update({ estado })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
