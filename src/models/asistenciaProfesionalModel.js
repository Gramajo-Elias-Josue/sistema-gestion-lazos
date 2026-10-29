// =====================================================================
// MODELO: Asistencia de profesionales (fichaje)
// ---------------------------------------------------------------------
// CAPA MODELO. Acceso a la tabla `asistencias_profesionales`: el fichaje
// diario de cada profesional (entrada / salida / estado). UNIQUE
// (profesional_id, fecha) => se usa UPSERT.
// =====================================================================

import { supabase } from '../config/supabaseClient.js';

const TABLA = 'asistencias_profesionales';

// Fichajes registrados en una fecha (yyyy-mm-dd).
export async function listarPorFecha(fecha) {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*')
    .eq('fecha', fecha);
  if (error) throw error;
  return data;
}

// Fichajes de un profesional dentro de un rango (para informes).
export async function listarPorProfesionalRango(profesionalId, desde, hasta) {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*')
    .eq('profesional_id', profesionalId)
    .gte('fecha', desde)
    .lte('fecha', hasta);
  if (error) throw error;
  return data;
}

// Registra o actualiza el fichaje de un profesional en una fecha.
// `horaEntrada2` / `horaSalida2` (la tarde) se mandan solo para quien
// hace los dos turnos: si no vienen (undefined), no se tocan.
export async function guardarFichaje({ profesionalId, fecha, horaEntrada, horaSalida, horaEntrada2, horaSalida2, estado, observaciones }) {
  const fila = {
    profesional_id: profesionalId,
    fecha,
    hora_entrada: horaEntrada || null,
    hora_salida: horaSalida || null,
    estado: estado || 'presente',
    observaciones: observaciones || null,
  };
  if (horaEntrada2 !== undefined) fila.hora_entrada_2 = horaEntrada2 || null;
  if (horaSalida2 !== undefined) fila.hora_salida_2 = horaSalida2 || null;
  const { data, error } = await supabase
    .from(TABLA)
    .upsert(fila, { onConflict: 'profesional_id,fecha' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Fichaje del día de UN profesional (o null si todavía no tiene).
export async function fichajeDelDia(profesionalId, fecha) {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*')
    .eq('profesional_id', profesionalId)
    .eq('fecha', fecha)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Fichaje por ubicación del profesional logueado. Manda dónde está y qué
// ficha ('entrada' | 'salida' | 'entrada_2' | 'salida_2'): la base (función fichar(), script 16)
// decide si está en el centro y si le toca, y pone la hora. Devuelve la
// fila del día.
export async function ficharConUbicacion(lat, lng, que) {
  const { data, error } = await supabase.rpc('fichar', { lat, lng, que });
  if (error) throw error;
  return data;
}

// Deshace una salida de HOY del profesional logueado (por si la fichó por
// error): tramo 1 = la de la mañana (o su único turno), 2 = la de la
// tarde. La base solo lo permite si la fichó él con su ubicación.
export async function deshacerSalida(tramo = 1) {
  const { data, error } = await supabase.rpc('deshacer_salida', { tramo });
  if (error) throw error;
  return data;
}
