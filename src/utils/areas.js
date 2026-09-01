// =====================================================================
// UTILIDADES: Áreas de intervención
// ---------------------------------------------------------------------
// `profesionales.profesion` es texto libre: cada quien escribe
// "Psicología", "Lic. en Psicologia" o "psicologa". Acá se normaliza esa
// variedad a un puñado de áreas conocidas, para poder agrupar y ordenar
// las columnas de la grilla por área.
//
// Es una lista ABIERTA: si aparece una profesión que no está (por
// ejemplo Musicoterapia), no se pierde — queda con área null y la vista
// la muestra igual, al final. Agregar un área acá es solo agregar una
// línea.
// =====================================================================

export const AREAS = [
  { clave: 'psicologia',     etiqueta: 'Psicología',     patron: /psicolog/ },
  { clave: 'fono',           etiqueta: 'Fonoaudiología', patron: /fono/ },
  { clave: 'to',             etiqueta: 'T.O.',           patron: /terapia\s*ocupacional|^t\.?\s*o\.?$/ },
  { clave: 'kinesiologia',   etiqueta: 'Kinesiología',   patron: /kine/ },
  { clave: 'psicopedagogia', etiqueta: 'Psicopedagogía', patron: /psicopedagog/ },
];

// Pasa un texto a minúsculas y sin tildes, para comparar sin sorpresas.
export function normalizar(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

// Devuelve la clave del área de una profesión, o null si no coincide con
// ninguna de las conocidas.
export function areaDeProfesion(profesion) {
  const texto = normalizar(profesion);
  if (!texto) return null;
  return AREAS.find(a => a.patron.test(texto))?.clave ?? null;
}

// Etiqueta legible de un área ('to' -> 'T.O.').
export function etiquetaArea(clave) {
  return AREAS.find(a => a.clave === clave)?.etiqueta ?? null;
}

// Área real de un profesional: su `sector` (el que se elige de un
// desplegable al crearlo — ver Profesionales → pestaña "Profesiones") o,
// de reserva, lo que se adivine de su `profesion` (compatibilidad con lo
// cargado antes de tener el campo `sector`). null si no se pudo saber.
// Un solo lugar para esta cuenta: así el mensaje que se le muestra al
// usuario SIEMPRE coincide con el área que realmente se usó para decidir
// (antes se recalculaba distinto en cada lugar y a veces daba "undefined").
export function areaDelProfesional(profesional) {
  return profesional?.sector || areaDeProfesion(profesional?.profesion) || null;
}

// ¿El profesional encaja en ese sector (columna de la grilla de
// atención)? No se puede poner a un psicólogo en la columna de
// Fonoaudiología. Da true también cuando no se le conoce el área a ese
// profesional: es una lista ABIERTA (ver AREAS arriba), y bloquear ahí
// sería más ruido que ayuda.
export function coincideConSector(profesional, sector) {
  const area = areaDelProfesional(profesional);
  return !area || area === sector;
}

// Ordena profesionales agrupándolos por área (en el orden de AREAS) y,
// dentro de cada una, por nombre. Los que no tienen área conocida van al
// final. Es el orden en que se muestran las columnas de la grilla.
export function ordenarPorArea(profesionales = []) {
  const peso = (p) => {
    const i = AREAS.findIndex(a => a.clave === areaDeProfesion(p.profesion));
    return i === -1 ? AREAS.length : i;
  };
  return [...profesionales].sort((a, b) =>
    peso(a) - peso(b) || String(a.nombre_completo || '').localeCompare(String(b.nombre_completo || ''), 'es')
  );
}
