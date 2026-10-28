// =====================================================================
// MODELO: Categorías de la historia clínica
// ---------------------------------------------------------------------
// CAPA MODELO. Las "carpetas" en las que se ordenan los documentos de un
// paciente (CUD, Estudios, Escolar…). Están en la base para que
// dirección y secretaría las editen desde Pacientes → "Categorías".
// Cada documento guarda la clave de su categoría en documentos.tipo.
// =====================================================================

import { supabase } from '../config/supabaseClient.js';

const TABLA = 'categorias_documento';

// Todas las categorías, en el orden en que se muestran.
export async function listarCategorias() {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*')
    .order('orden', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function crearCategoria({ titulo, icono, clave, orden }) {
  const { data, error } = await supabase
    .from(TABLA).insert({ titulo, icono, clave, orden }).select().single();
  if (error) throw error;
  return data;
}

// Cambia el nombre y el ícono (la clave queda igual: los documentos
// siguen en su categoría).
export async function editarCategoria(id, { titulo, icono }) {
  const { data, error } = await supabase
    .from(TABLA).update({ titulo, icono }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// Borra una categoría VACÍA. Con documentos la base no la deja borrar
// (clave foránea), y CUD e Historial médico tampoco (las usa el sistema).
export async function eliminarCategoria(id) {
  const { error } = await supabase.from(TABLA).delete().eq('id', id);
  if (error) throw error;
}

// Cuántos documentos (de todos los pacientes) hay en una categoría, para
// avisar antes de intentar borrarla.
export async function contarDocumentos(clave) {
  const { count, error } = await supabase
    .from('documentos')
    .select('*', { count: 'exact', head: true })
    .eq('tipo', clave);
  if (error) throw error;
  return count ?? 0;
}
