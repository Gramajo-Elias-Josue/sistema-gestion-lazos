// =====================================================================
// MODELO: Turnos
// ---------------------------------------------------------------------
// CAPA MODELO. Acceso a datos de la tabla `turnos` (citas paciente ↔
// profesional por fecha). Trae embebidos el paciente y el profesional
// para armar la grilla del día sin consultas extra.
// =====================================================================

import { supabase } from '../config/supabaseClient.js';

const TABLA = 'turnos';

// Turnos de una fecha (yyyy-mm-dd), ordenados por hora.
export async function listarTurnosPorFecha(fecha) {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*, pacientes(nombre_completo, dni), profesionales(nombre_completo, profesion)')
    .eq('fecha', fecha)
    .order('hora', { ascending: true, nullsFirst: true });
  if (error) throw error;
  return data;
}

// Crea un turno nuevo.
export async function crearTurno({ pacienteId, profesionalId, fecha, hora, observaciones }) {
  const { data, error } = await supabase
    .from(TABLA)
    .insert({
      paciente_id: pacienteId,
      profesional_id: profesionalId,
      fecha,
      hora: hora || null,
      observaciones: observaciones || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Cambia el estado de un turno (programado | atendido | ausente | cancelado).
export async function actualizarEstadoTurno(id, estado) {
  const { data, error } = await supabase
    .from(TABLA)
    .update({ estado })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Devuelve todos los turnos activos (no cancelados) de un paciente en una
// fecha, con el profesional embebido. El controlador calcula si alguno cae
// dentro de la ventana de duración de sesión (un paciente no puede tener dos
// turnos pegados, aunque sean con profesionales distintos: no puede estar en
// dos sesiones a la vez).
export async function listarTurnosPacientePorFecha(pacienteId, fecha) {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*, profesionales(nombre_completo)')
    .eq('paciente_id', pacienteId)
    .eq('fecha', fecha)
    .neq('estado', 'cancelado')
    .order('hora', { ascending: true });
  if (error) throw error;
  return data || [];
}

// Devuelve todos los turnos activos (no cancelados) de un profesional en una fecha.
// El controlador calcula si alguno queda dentro de la ventana de duración de sesión.
export async function listarTurnosProfesionalPorFecha(profesionalId, fecha) {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*, pacientes(nombre_completo)')
    .eq('profesional_id', profesionalId)
    .eq('fecha', fecha)
    .neq('estado', 'cancelado')
    .order('hora', { ascending: true });
  if (error) throw error;
  return data || [];
}

// Turnos ATENDIDOS de un paciente en una fecha, con el profesional que lo
// atendió. Habilita la carga de la evaluación desde la historia clínica:
// solo se puede evaluar a quien fue atendido ese día (gate "atendido HOY").
export async function listarAtendidosPacienteFecha(pacienteId, fecha) {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*, profesionales(nombre_completo, profesion, especialidad, matricula)')
    .eq('paciente_id', pacienteId)
    .eq('fecha', fecha)
    .eq('estado', 'atendido')
    .order('hora', { ascending: true, nullsFirst: true });
  if (error) throw error;
  return data || [];
}

// Elimina un turno.
export async function eliminarTurno(id) {
  const { error } = await supabase.from(TABLA).delete().eq('id', id);
  if (error) throw error;
}
