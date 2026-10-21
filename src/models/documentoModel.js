// =====================================================================
// MODELO: Documentos
// ---------------------------------------------------------------------
// CAPA MODELO. Maneja dos cosas que van juntas:
//   1) La METADATA del documento en la tabla `documentos`.
//   2) El ARCHIVO físico en Supabase Storage (bucket "documentos").
//
// IMPORTANTE: el bucket "documentos" debe existir en el panel de
// Supabase. Si no existe, guardarDocumento() lanzará un error indicándolo.
// =====================================================================

import { supabase } from '../config/supabaseClient.js';

const TABLA = 'documentos';
const BUCKET = 'documentos';

// Lista documentos vencidos o próximos a vencer dentro de `limiteDias`.
// Trae embebido el nombre del paciente (join) para el panel de alertas.
// Incluye los ya vencidos (fecha_vencimiento <= hoy + limiteDias).
export async function listarVencimientos(limiteDias = 30) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const limite = new Date(hoy.getTime() + limiteDias * 86400000);
  const limiteISO = limite.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from(TABLA)
    .select('*, pacientes(nombre_completo)')
    .not('fecha_vencimiento', 'is', null)
    .lte('fecha_vencimiento', limiteISO)
    .order('fecha_vencimiento', { ascending: true });
  if (error) throw error;
  return data;
}

// Guarda un documento de la historia clínica del paciente.
// El archivo (PDF/imagen) es OPCIONAL: actúa como respaldo. Si no se
// adjunta, el documento queda igual con sus datos (tipo + fechas + notas).
//   - archivo: File de un <input type="file"> (opcional)
//   - fechaEmision / fechaVencimiento: 'yyyy-mm-dd' (opcionales)
// Devuelve el documento creado.
export async function guardarDocumento({
  pacienteId, tipo, archivo = null, numero = null,
  fechaEmision = null, fechaVencimiento = null, observaciones = null,
}) {
  let storagePath = null;
  let nombreArchivo = null;

  // 1) Si vino un archivo, lo subimos al bucket con una ruta única.
  if (archivo && archivo.size) {
    const nombreLimpio = archivo.name.replace(/[^\w.\-]/g, '_');
    storagePath = `paciente_${pacienteId}/${Date.now()}-${nombreLimpio}`;
    const { error: errUp } = await supabase
      .storage
      .from(BUCKET)
      .upload(storagePath, archivo, { cacheControl: '3600', upsert: false });
    if (errUp) throw errUp;
    nombreArchivo = archivo.name;
  }

  // 2) Guardamos la metadata en la tabla `documentos`.
  const { data, error } = await supabase
    .from(TABLA)
    .insert({
      paciente_id: pacienteId,
      tipo,
      numero: numero || null,
      nombre_archivo: nombreArchivo,
      storage_path: storagePath,
      fecha_emision: fechaEmision || null,
      fecha_vencimiento: fechaVencimiento || null,
      observaciones: observaciones || null,
    })
    .select()
    .single();

  if (error) {
    // Si el insert falla y habíamos subido un archivo, lo borramos para
    // no dejar un archivo "huérfano" sin registro en la tabla.
    if (storagePath) await supabase.storage.from(BUCKET).remove([storagePath]);
    throw error;
  }
  return data;
}

// Genera una URL temporal FIRMADA para ver/descargar un documento.
// (El bucket es privado; la URL caduca a los `segundos` indicados.)
export async function urlDocumento(storagePath, segundos = 3600) {
  const { data, error } = await supabase
    .storage
    .from(BUCKET)
    .createSignedUrl(storagePath, segundos);
  if (error) throw error;
  return data.signedUrl;
}
