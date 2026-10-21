// =====================================================================
// UTILIDADES: Áreas de intervención
// ---------------------------------------------------------------------
// El área (sector) de un profesional sale de su campo `sector`, que se
// elige de un desplegable. Los profesionales cargados ANTES de existir
// ese campo solo tienen `profesion`, texto libre ("Psicología", "Lic. en
// Psicologia", "psicologa"…): acá se normaliza esa variedad a un puñado
// de áreas conocidas, para que igual se agrupen y coloreen bien.
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
