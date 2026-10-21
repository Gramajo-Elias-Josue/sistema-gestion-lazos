// =====================================================================
// MODELO: Asignaciones (celdas de la grilla de atención)
// ---------------------------------------------------------------------
// CAPA MODELO. Acceso a la tabla `asignaciones`: con qué paciente se
// atiende cada profesional y a qué hora (la celda es el cruce PROFESIONAL
// × FRANJA HORARIA, no paciente × sector — ver la migración
// supabase/sql/09-grilla-horarios.sql). Los horarios son fijos y se
// repiten todos los días, así que una fila vale para todos los días
// mientras esté vigente.
//
// VIGENCIA: una celda no se pisa ni se borra cuando cambia el paciente.
// Se le pone `vigente_hasta` (queda cerrada, como historia) y se crea
// otra. Por eso todas las consultas de la grilla filtran por
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

// Celdas vigentes de UN profesional (sus franjas fijas ocupadas), con el
// paciente. La agenda las usa para no dar un turno casual encima.
export async function listarVigentesDeProfesional(profesionalId) {
  const { data, error } = await supabase
    .from(TABLA)
    .select('hora, pacientes(nombre_completo)')
    .eq('profesional_id', profesionalId)
    .is('vigente_hasta', null)
    .not('hora', 'is', null);
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

// Guarda una celda de la grilla (el cruce profesional × franja horaria).
//   profesionalId -> siempre uno de los cargados en el sistema (la
//                    columna ES ese profesional; ya no se escribe a mano)
//   hora          -> inicio de la franja de 30 min ('HH:MM')
//   pacienteId    -> siempre uno de los pacientes cargados
//   sector        -> el sector del profesional al momento de asignarlo
//                    (queda de historia; la grilla agrupa por el sector
//                    ACTUAL del profesional, no por este campo)
//
// Si esa franja ya tenía OTRO paciente, no se pisa: se cierra la celda
// anterior y se crea una nueva (historia de con quién se atendía antes).
// Si ESE MISMO paciente ya tenía otra franja con ESTE profesional, esa
// otra se cierra también: se está reprogramando, no duplicando.
export async function guardarCelda({ pacienteId, profesionalId, hora, sector = null }) {
  const { data: ocupando, error: errorBusqueda } = await supabase
    .from(TABLA)
    .select('*')
    .eq('profesional_id', profesionalId)
    .eq('hora', hora)
    .is('vigente_hasta', null)
    .limit(1);
  if (errorBusqueda) throw errorBusqueda;

  const actual = ocupando?.[0];
  if (actual) {
    if (String(actual.paciente_id) === String(pacienteId)) return actual;   // nada que cambiar
    await cerrarCelda(actual.id, 'Reemplazado desde la grilla');
  }

  // Si el paciente ya tenía OTRA franja con este mismo profesional (se
  // está moviendo de horario), esa queda como historia.
  const { data: previas, error: errorPrevias } = await supabase
    .from(TABLA)
    .select('id, hora')
    .eq('paciente_id', pacienteId)
    .eq('profesional_id', profesionalId)
    .is('vigente_hasta', null);
  if (errorPrevias) throw errorPrevias;
  for (const previa of previas || []) {
    if (previa.hora !== hora) await cerrarCelda(previa.id, 'Cambio de horario');
  }

  const { data, error } = await supabase
    .from(TABLA)
    .insert({ paciente_id: pacienteId, profesional_id: profesionalId, hora, sector })
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
