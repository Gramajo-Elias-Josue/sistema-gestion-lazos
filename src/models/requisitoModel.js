// =====================================================================
// MODELO: Requisitos de admisión (documentación que se pide al ingresar)
// ---------------------------------------------------------------------
// CAPA MODELO. La lista (DNI, CUD, certificado médico…) está en la base
// para que dirección y secretaría la editen desde Admisión →
// "Documentación", sin tocar el sistema. Lo marcado de cada paciente
// sigue en admision_documentos (ver admisionModel).
// =====================================================================

import { supabase } from '../config/supabaseClient.js';

const TABLA = 'requisitos_admision';

// Requisitos que se piden hoy, en orden.
export async function listarRequisitos() {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*')
    .eq('activo', true)
    .order('orden', { ascending: true });
  if (error) throw error;
  return data || [];
}

// Agrega un requisito al final. Si ya EXISTÍA con esa clave y se había
// quitado, se reactiva (la clave es única): así lo que ya estaba marcado
// en admisiones anteriores vuelve a verse.
export async function crearRequisito({ etiqueta, clave, orden }) {
  const { data: previos, error: errorBusqueda } = await supabase
    .from(TABLA).select('id').eq('clave', clave).limit(1);
  if (errorBusqueda) throw errorBusqueda;

  const consulta = previos?.length
    ? supabase.from(TABLA).update({ activo: true, etiqueta, orden }).eq('id', previos[0].id)
    : supabase.from(TABLA).insert({ etiqueta, clave, orden });
  const { data, error } = await consulta.select().single();
  if (error) throw error;
  return data;
}

// Cambia solo el nombre que se muestra (la clave queda igual, así lo ya
// marcado sigue enganchado).
export async function renombrarRequisito(id, etiqueta) {
  const { data, error } = await supabase
    .from(TABLA).update({ etiqueta }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// Deja de pedirse. NO borra: lo marcado en admisiones anteriores se
// conserva y vuelve si el requisito se agrega de nuevo.
export async function quitarRequisito(id) {
  const { error } = await supabase.from(TABLA).update({ activo: false }).eq('id', id);
  if (error) throw error;
}
