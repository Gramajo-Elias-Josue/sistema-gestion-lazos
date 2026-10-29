// =====================================================================
// MODELO: Informes y evaluaciones / certificados
// ---------------------------------------------------------------------
// CAPA MODELO. Acceso a la tabla `evaluaciones`, que guarda los
// documentos que escribe el profesional (JSON con título y cuerpo):
//
//   - los INFORMES periódicos -> 'mensual', 'anual', 'evolucion', 'admision'
//   - la EVALUACIÓN / CERTIFICADO ocasional -> 'certificado'. El de un
//     paciente CASUAL (sin legajo) no tiene paciente_id: va atado a su
//     turno de la agenda (turno_id).
//
// El `tipo` forma parte de la clave única junto con paciente, profesional
// y fecha, para que un documento no pise a otro del mismo día.
// (La vieja evaluación 'diaria' ya no se carga; si quedara alguna en la
// base, no se muestra.)
// =====================================================================

import { supabase } from '../config/supabaseClient.js';

const TABLA = 'evaluaciones';
const TIPO_CERTIFICADO = 'certificado';

// Informes y certificados de UN paciente para su historia clínica, con
// el profesional que los hizo, del más reciente al más viejo.
export async function listarPorPaciente(pacienteId) {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*, profesionales(nombre_completo, profesion, especialidad, matricula)')
    .eq('paciente_id', pacienteId)
    .neq('tipo', 'diaria')
    .order('fecha', { ascending: false });
  if (error) throw error;
  return data;
}

// Informes de un tipo dentro de un rango de fechas, con el profesional
// embebido. Sirve para saber quién entregó el informe del mes y quién no.
export async function listarInformesPorRango(tipo, desde, hasta) {
  const { data, error } = await supabase
    .from(TABLA)
    .select('id, profesional_id, paciente_id, fecha, tipo, profesionales(nombre_completo, profesion)')
    .eq('tipo', tipo)
    .gte('fecha', desde)
    .lte('fecha', hasta);
  if (error) throw error;
  return data || [];
}

// Guarda (o actualiza) un informe o certificado de un paciente con legajo.
// Upsert por (paciente_id, profesional_id, fecha, tipo).
export async function guardarEvaluacion({ pacienteId, profesionalId, fecha, contenido, turnoId = null, tipo }) {
  const { data, error } = await supabase
    .from(TABLA)
    .upsert(
      {
        paciente_id: pacienteId,
        profesional_id: profesionalId,
        fecha,
        contenido: contenido || null,
        turno_id: turnoId,
        tipo,
      },
      { onConflict: 'paciente_id,profesional_id,fecha,tipo' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Certificados de pacientes CASUALES de una lista de turnos (para saber
// cuáles ya lo tienen en la agenda del día).
export async function listarCertificadosDeTurnos(turnoIds = []) {
  if (!turnoIds.length) return [];
  const { data, error } = await supabase
    .from(TABLA)
    .select('*')
    .is('paciente_id', null)
    .eq('tipo', TIPO_CERTIFICADO)
    .in('turno_id', turnoIds);
  if (error) throw error;
  return data || [];
}

// Guarda el certificado de un paciente CASUAL (uno por turno: si ya
// existe se actualiza). No se puede usar upsert: el índice único que lo
// protege es parcial (solo filas sin paciente) y PostgREST no lo admite
// como onConflict.
export async function guardarCertificadoCasual({ turnoId, profesionalId, fecha, contenido }) {
  const { data: existentes, error: errorBusqueda } = await supabase
    .from(TABLA)
    .select('id')
    .is('paciente_id', null)
    .eq('tipo', TIPO_CERTIFICADO)
    .eq('turno_id', turnoId)
    .limit(1);
  if (errorBusqueda) throw errorBusqueda;

  const fila = { profesional_id: profesionalId, fecha, contenido, turno_id: turnoId, tipo: TIPO_CERTIFICADO, paciente_id: null };
  const consulta = existentes?.[0]
    ? supabase.from(TABLA).update(fila).eq('id', existentes[0].id)
    : supabase.from(TABLA).insert(fila);
  const { data, error } = await consulta.select().single();
  if (error) throw error;
  return data;
}

// Borra el certificado de un turno casual (al eliminar el turno: sin
// turno ni paciente no tendría de quién ser).
export async function eliminarCertificadoDeTurno(turnoId) {
  const { error } = await supabase
    .from(TABLA)
    .delete()
    .is('paciente_id', null)
    .eq('turno_id', turnoId);
  if (error) throw error;
}
