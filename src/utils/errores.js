// =====================================================================
// UTILIDADES: Mensajes de error
// ---------------------------------------------------------------------
// Traduce los errores técnicos de Supabase/Postgres a mensajes claros
// en español para mostrarle al usuario. Así, en vez de un código críptico
// (p. ej. "23505"), ve algo entendible ("Ya existe ese DNI").
//
// Códigos de Postgres más comunes:
//   23505 -> valor duplicado (violación de índice único)
//   23503 -> clave foránea (el registro está referenciado por otro)
//   23502 -> NOT NULL (falta un dato obligatorio)
//   42501 -> sin permisos (lo rechazó la RLS por rol de la base)
// =====================================================================

export function mensajeError(err, respaldo = 'No se pudo completar la operación.') {
  const codigo = err?.code || '';
  // Juntamos message + details porque el nombre del campo a veces está
  // en uno o en el otro según el error.
  const texto = `${err?.message || ''} ${err?.details || ''}`.toLowerCase();

  // Valor duplicado: tratamos de decir QUÉ campo se repitió.
  if (codigo === '23505') {
    if (texto.includes('dni')) return 'Ya existe un paciente con ese DNI.';
    if (texto.includes('email')) return 'Ya existe un profesional con ese email.';
    if (texto.includes('matricula')) return 'Ya existe un profesional con esa matrícula.';
    return 'Ese registro ya existe (hay un dato duplicado).';
  }

  if (codigo === '23503') {
    return 'No se puede completar: el registro está relacionado con otros datos.';
  }
  if (codigo === '23502') {
    return 'Falta completar un dato obligatorio.';
  }

  // Sin permisos: la RLS por rol de la base rechazó la operación. Pasa
  // cuando el rol no puede hacer eso, o cuando al usuario le falta su fila
  // en `perfiles` (queda sin permisos de escritura).
  if (codigo === '42501' || /row-level security|row level security/.test(texto)) {
    return 'No tenés permisos para hacer esto con tu rol.';
  }

  // Error típico de Storage cuando no está creado el bucket "documentos".
  if (/bucket|not found/.test(texto)) {
    return 'No se pudo subir el archivo: falta crear el bucket "documentos" en Supabase Storage.';
  }

  // Si no lo reconocemos, devolvemos el respaldo + el detalle técnico.
  return respaldo + (err?.message ? ` (${err.message})` : '');
}
