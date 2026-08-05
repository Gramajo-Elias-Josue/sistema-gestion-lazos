// =====================================================================
// MODELO: Asignaciones (celdas de la grilla de atención)
// ---------------------------------------------------------------------
// CAPA MODELO. Acceso a la tabla `asignaciones`: con qué profesional se
// atiende cada paciente y a qué hora. Los horarios son fijos y se
// repiten todos los días, así que una fila vale para todos los días
// mientras esté vigente.
//
// VIGENCIA: una celda no se pisa ni se borra cuando cambia el
// profesional. Se le pone `vigente_hasta` (queda cerrada, como historia)
// y se crea otra. Por eso todas las consultas de la grilla filtran por
// `vigente_hasta is null`.
// =====================================================================

import { supabase } from '../config/supabaseClient.js';
import { hoyISO } from '../utils/fechas.js';

const TABLA = 'asignaciones';

// Todas las celdas vigentes, con el nombre del paciente y del
// profesional embebidos (la grilla los necesita para los avisos).
export async function listarVigentes() {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*, pacientes(nombre_completo), profesionales(nombre_completo, profesion)')
    .is('vigente_hasta', null);
  if (error) throw error;
  return data || [];
}

// Historial de un paciente: sus celdas vigentes y también las cerradas
// (con quién se atendía antes y hasta cuándo), de la más nueva a la más
// vieja.
export async function listarPorPaciente(pacienteId, { soloVigentes = false } = {}) {
  let query = supabase
    .from(TABLA)
    .select('*, profesionales(nombre_completo, profesion, matricula)')
    .eq('paciente_id', pacienteId)
    .order('vigente_desde', { ascending: false });
  if (soloVigentes) query = query.is('vigente_hasta', null);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// Guarda una celda de la grilla (el cruce paciente × sector).
//   profesionalId     -> si se eligió uno de los cargados en el sistema
//   profesionalNombre -> si se escribió a mano (o una "X")
//
// Si en esa celda ya había OTRO profesional, no se pisa: se cierra la
// anterior y se crea una nueva, así queda registro de con quién se
// atendía antes.
export async function guardarCelda({ pacienteId, sector, profesionalId = null, profesionalNombre = null }) {
  const { data: existentes, error: errorBusqueda } = await supabase
    .from(TABLA)
    .select('*')
    .eq('paciente_id', pacienteId)
    .eq('sector', sector)
    .is('vigente_hasta', null)
    .limit(1);
  if (errorBusqueda) throw errorBusqueda;

  const actual = existentes?.[0];
  if (actual) {
    const mismoProfesional =
      String(actual.profesional_id ?? '') === String(profesionalId ?? '') &&
      (actual.profesional_nombre ?? '') === (profesionalNombre ?? '');
    if (mismoProfesional) return actual;   // nada que cambiar
    // Cambió el profesional: se cierra la celda anterior (historia).
    await cerrarCelda(actual.id, 'Cambio de profesional');
  }

  const { data, error } = await supabase
    .from(TABLA)
    .insert({
      paciente_id: pacienteId,
      sector,
      profesional_id: profesionalId,
      profesional_nombre: profesionalNombre,
    })
    .select('*, pacientes(nombre_completo), profesionales(nombre_completo, profesion)')
    .single();
  if (error) throw error;
  return data;
}

// Cierra una celda (vaciarla en la grilla). No borra: le pone fecha de
// fin, así queda registro de que ese paciente se atendía con ese
// profesional hasta esa fecha.
export async function cerrarCelda(id, motivo = null) {
  const { data, error } = await supabase
    .from(TABLA)
    .update({ vigente_hasta: hoyISO(), motivo_cierre: motivo })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Cierra TODAS las celdas vigentes de un profesional (cuando se da de
// baja del centro). Las filas de la grilla quedan libres para reasignar.
export async function cerrarPorProfesional(profesionalId, motivo = 'Baja del profesional') {
  const { data, error } = await supabase
    .from(TABLA)
    .update({ vigente_hasta: hoyISO(), motivo_cierre: motivo })
    .eq('profesional_id', profesionalId)
    .is('vigente_hasta', null)
    .select();
  if (error) throw error;
  return data || [];
}

// Ídem cuando se da de baja un paciente.
export async function cerrarPorPaciente(pacienteId, motivo = 'Baja del paciente') {
  const { data, error } = await supabase
    .from(TABLA)
    .update({ vigente_hasta: hoyISO(), motivo_cierre: motivo })
    .eq('paciente_id', pacienteId)
    .is('vigente_hasta', null)
    .select();
  if (error) throw error;
  return data || [];
}
