// =====================================================================
// MODELO: Fotos del trabajo (galería)
// ---------------------------------------------------------------------
// CAPA MODELO. Maneja la metadata en `fotos_trabajo` y el archivo en el
// Storage (bucket "documentos", carpeta "galeria/"). Cada profesional
// sube al menos una foto por mes; con eso se arma el contenido de
// difusión del centro.
//
// Las fotos NO son historia clínica: no cuelgan del paciente y se borran
// solas a los 3 meses (ver utils/periodos.js).
// =====================================================================

import { supabase } from '../config/supabaseClient.js';
import { fotosVencidas, MESES_A_CONSERVAR_FOTOS } from '../utils/periodos.js';

const TABLA = 'fotos_trabajo';
const BUCKET = 'documentos';
const CARPETA = 'galeria';

// Fotos de un mes ('2026-08'), de la más nueva a la más vieja.
export async function listarPorPeriodo(periodo) {
  const { data, error } = await supabase
    .from(TABLA)
    .select('*, profesionales(nombre_completo, profesion)')
    .eq('periodo', periodo)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// Todas las fotos (para calcular pendientes y para la limpieza).
export async function listarTodas() {
  const { data, error } = await supabase
    .from(TABLA)
    .select('id, profesional_id, periodo, storage_path, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// Sube una foto y guarda su metadata. El archivo va a
// "galeria/<periodo>/<profesional>/<timestamp>-<nombre>".
export async function subirFoto({ profesionalId, periodo, archivo, descripcion = null }) {
  if (!archivo || !archivo.size) throw new Error('No se eligió ninguna foto.');

  const nombreLimpio = archivo.name.replace(/[^\w.\-]/g, '_');
  const storagePath = `${CARPETA}/${periodo}/${profesionalId}/${Date.now()}-${nombreLimpio}`;

  const { error: errUp } = await supabase
    .storage
    .from(BUCKET)
    .upload(storagePath, archivo, { cacheControl: '3600', upsert: false });
  if (errUp) throw errUp;

  const { data, error } = await supabase
    .from(TABLA)
    .insert({
      profesional_id: profesionalId,
      periodo,
      storage_path: storagePath,
      nombre_archivo: archivo.name,
      descripcion: descripcion || null,
    })
    .select('*, profesionales(nombre_completo, profesion)')
    .single();

  if (error) {
    // Si falla el insert, se saca el archivo para no dejarlo huérfano.
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw error;
  }
  return data;
}

// URL temporal firmada para mostrar la foto (el bucket es privado).
export async function urlFoto(storagePath, segundos = 3600) {
  const { data, error } = await supabase
    .storage
    .from(BUCKET)
    .createSignedUrl(storagePath, segundos);
  if (error) throw error;
  return data.signedUrl;
}

// Elimina una foto: primero el archivo, después la fila.
export async function eliminarFoto(id, storagePath) {
  if (storagePath) await supabase.storage.from(BUCKET).remove([storagePath]);
  const { error } = await supabase.from(TABLA).delete().eq('id', id);
  if (error) throw error;
}

// Borra las fotos que pasaron su vida útil (3 meses por defecto).
// Se llama al abrir la galería: así el espacio se libera solo, sin
// depender de que alguien se acuerde. Devuelve cuántas borró.
export async function limpiarVencidas(meses = MESES_A_CONSERVAR_FOTOS) {
  const todas = await listarTodas();
  const vencidas = fotosVencidas(todas, undefined, meses);
  if (!vencidas.length) return 0;

  const rutas = vencidas.map(f => f.storage_path).filter(Boolean);
  if (rutas.length) await supabase.storage.from(BUCKET).remove(rutas);

  const { error } = await supabase.from(TABLA).delete().in('id', vencidas.map(f => f.id));
  if (error) throw error;
  return vencidas.length;
}
