// =====================================================================
// MODELO: Pacientes
// ---------------------------------------------------------------------
// CAPA MODELO. Encapsula TODO el acceso a datos de la entidad paciente
// (tabla `pacientes`) y de sus relaciones (contactos de emergencia y
// documentos). Las vistas y los controladores NUNCA hablan con Supabase
// directamente: siempre pasan por estas funciones.
//
// Cada función devuelve los datos o lanza el error (throw) para que el
// controlador decida cómo mostrarlo en pantalla.
// =====================================================================

import { supabase } from '../config/supabaseClient.js';

const TABLA = 'pacientes';

// Lista pacientes YA ADMITIDOS, ordenados por nombre.
// Trae embebidos sus documentos (solo tipo y vencimiento) por si se
// necesitan en el listado. soloActivos=true filtra además por estado
// 'activo' (excluye los dados de baja). Los pacientes en proceso de
// admisión NO aparecen acá (ver listarEnAdmision).
export async function listarPacientes({ soloActivos = true } = {}) {
  let query = supabase
    .from(TABLA)
    .select('*, documentos(tipo, fecha_vencimiento)')
    .eq('estado_admision', 'admitido')
    .order('nombre_completo', { ascending: true });

  if (soloActivos) query = query.eq('estado', 'activo');

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// Lista pacientes EN PROCESO DE ADMISIÓN (todavía no admitidos).
export async function listarEnAdmision() {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*')
    .eq('estado_admision', 'en_admision')
    .order('nombre_completo', { ascending: true });
  if (error) throw error;
  return data;
}

// Cambia el estado de admisión del paciente ('en_admision' | 'admitido' |
// 'rechazado'). Aprobar la admisión = pasarlo a 'admitido'.
export async function cambiarEstadoAdmision(id, estadoAdmision) {
  const { data, error } = await supabase
    .from(TABLA)
    .update({ estado_admision: estadoAdmision })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Trae un paciente por id, con sus contactos de emergencia y todos sus
// documentos (datos completos para armar el legajo).
export async function obtenerPaciente(id) {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*, contactos_emergencia(*), documentos(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

// Busca un paciente por DNI. Sirve para evitar DNIs repetidos antes de
// guardar (la base no tiene esa restricción, así que se controla acá).
// `exceptoId` excluye al propio paciente cuando se está editando.
// Devuelve el paciente encontrado o null.
export async function buscarPorDni(dni, exceptoId = null) {
  let query = supabase
    .from(TABLA)
    .select('id, nombre_completo, dni')
    .eq('dni', dni);
  if (exceptoId) query = query.neq('id', exceptoId);

  const { data, error } = await query.limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

// Crea un paciente nuevo y devuelve el registro insertado.
export async function crearPaciente(datos) {
  const { data, error } = await supabase
    .from(TABLA)
    .insert(datos)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Actualiza un paciente existente y devuelve el registro actualizado.
export async function actualizarPaciente(id, datos) {
  const { data, error } = await supabase
    .from(TABLA)
    .update(datos)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Cambia el estado del paciente ('activo' / 'inactivo').
// Se usa para la BAJA LÓGICA: no se borra el registro, solo se marca
// inactivo (así no se pierde su historia clínica ni sus asistencias).
export async function cambiarEstadoPaciente(id, estado) {
  const { data, error } = await supabase
    .from(TABLA)
    .update({ estado })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
