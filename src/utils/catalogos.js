// =====================================================================
// UTILIDAD: listas editables (documentación de admisión y categorías)
// ---------------------------------------------------------------------
// Funciones puras que comparten las pestañas "Documentación" (Admisión)
// y "Categorías" (Pacientes): las dos son listas que dirección y
// secretaría editan desde la app, como las profesiones.
// =====================================================================

import { normalizar } from './areas.js';

// Categorías de la historia clínica que usa el sistema (la base no deja
// borrarlas, ver supabase/sql/15-documentacion-y-categorias.sql):
//   - CUD: de ahí sale el aviso de vencimiento del CUD.
//   - Historial médico: ahí se adjunta el PDF de cada informe.
export const CATEGORIA_CUD = 'cud';
export const CATEGORIA_INFORMES = 'historial';
export const CATEGORIAS_FIJAS = [CATEGORIA_CUD, CATEGORIA_INFORMES];

// Íconos para elegir al crear o editar una categoría.
export const ICONOS_CATEGORIA = ['📁', '🪪', '🆔', '🔬', '🩺', '📋', '🏫', '💊', '🧠', '🦻', '🗣️', '🧩', '📝', '⚖️', '💳', '🏥'];

// La clave identifica el elemento en la base: el nombre sin tildes ni
// espacios ("Certificado de vacunas" → "certificado_de_vacunas"). Se arma
// al crearlo y no cambia aunque después se renombre.
export function claveDesdeNombre(nombre) {
  return normalizar(nombre).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

// Orden para un elemento nuevo: al final de la lista.
export function siguienteOrden(lista) {
  return lista.reduce((max, x) => Math.max(max, x.orden ?? 0), 0) + 1;
}

// ¿Ya hay otro elemento con ese nombre? Compara por clave (sin tildes ni
// mayúsculas), salvo contra sí mismo cuando se está renombrando.
export function nombreRepetido(lista, nombre, idPropio = null) {
  const clave = claveDesdeNombre(nombre);
  return lista.some(x => x.clave === clave && String(x.id) !== String(idPropio));
}
