// =====================================================================
// MODELO: Sectores (las columnas de la grilla de atención)
// ---------------------------------------------------------------------
// CAPA MODELO. Los sectores son Psicología, Fonoaudiología, T.O.,
// Kinesiología, Psicopedagogía… y los que el centro necesite agregar.
// Están en la base (no en el código) justamente para que se pueda sumar
// una columna nueva desde la app, sin tocar el sistema.
// =====================================================================

import { supabase } from '../config/supabaseClient.js';

const TABLA = 'sectores';

// Sectores activos, en el orden en que se muestran las columnas.
export async function listarSectores({ soloActivos = true } = {}) {
  let query = supabase
    .from(TABLA)
    .select('*')
    .order('orden', { ascending: true });
  if (soloActivos) query = query.eq('activo', true);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// Agrega una columna nueva a la grilla. La `clave` se arma a partir del
// nombre (sin tildes ni espacios) y el orden va al final.
//
// Si esa columna EXISTÍA y se había quitado, se reactiva en vez de
// crearla de nuevo (la clave es única). Así vuelve con lo que tenía
// cargado, en lugar de fallar por duplicada.
export async function crearSector({ etiqueta, clave, orden }) {
  const { data: previos, error: errorBusqueda } = await supabase
    .from(TABLA)
    .select('*')
    .eq('clave', clave)
    .limit(1);
  if (errorBusqueda) throw errorBusqueda;

  if (previos?.length) {
    const { data, error } = await supabase
      .from(TABLA)
      .update({ activo: true, etiqueta, orden })
      .eq('id', previos[0].id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from(TABLA)
    .insert({ etiqueta, clave, orden })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Quita una columna de la grilla. NO borra: la marca inactiva, así lo
// que ya estaba cargado en esa columna no se pierde y la columna se
// puede volver a agregar con todo su contenido.
export async function desactivarSector(id) {
  const { data, error } = await supabase
    .from(TABLA)
    .update({ activo: false })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Cuántas celdas cargadas tiene una columna (para avisar antes de
// quitarla: no es lo mismo sacar una vacía que una con 15 pacientes).
export async function contarCeldas(clave) {
  const { count, error } = await supabase
    .from('asignaciones')
    .select('*', { count: 'exact', head: true })
    .eq('sector', clave)
    .is('vigente_hasta', null);
  if (error) throw error;
  return count ?? 0;
}
