// =====================================================================
// MODELO: Turnos (agenda de pacientes CASUALES)
// ---------------------------------------------------------------------
// CAPA MODELO. Acceso a datos de la tabla `turnos`. La agenda es solo
// para consultas sueltas de personas SIN legajo: su nombre, teléfono y
// DNI se guardan en el mismo turno (paciente_nombre / _telefono / _dni).
// Los pacientes fijos se organizan en la Grilla de atención, no acá.
// =====================================================================

import { supabase } from '../config/supabaseClient.js';

const TABLA = 'turnos';

// Turnos de una fecha (yyyy-mm-dd), ordenados por hora, con el
// profesional embebido. `pacientes` sigue embebido por los turnos viejos
// que apuntaban a un paciente cargado (hasta que se limpien).
export async function listarTurnosPorFecha(fecha) {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*, pacientes(nombre_completo, dni), profesionales(nombre_completo, profesion, especialidad, matricula)')
    .eq('fecha', fecha)
    .order('hora', { ascending: true, nullsFirst: true });
  if (error) throw error;
  return data;
}

// Crea un turno casual.
export async function crearTurno({ pacienteNombre, pacienteTelefono, pacienteDni, profesionalId, fecha, hora, observaciones }) {
  const { data, error } = await supabase
    .from(TABLA)
    .insert({
      paciente_nombre: pacienteNombre,
      paciente_telefono: pacienteTelefono || null,
      paciente_dni: pacienteDni || null,
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

// Turnos casuales con un DNI (de cualquier fecha). Sirve para controlar
// que el DNI no sea de otra persona y que no saque dos turnos el mismo día.
export async function listarCasualesPorDni(dni) {
  const { data, error } = await supabase
    .from(TABLA)
    .select('id, paciente_nombre, fecha, hora, estado')
    .is('paciente_id', null)
    .eq('paciente_dni', dni);
  if (error) throw error;
  return data || [];
}

// Elimina un turno.
export async function eliminarTurno(id) {
  const { error } = await supabase.from(TABLA).delete().eq('id', id);
  if (error) throw error;
}
