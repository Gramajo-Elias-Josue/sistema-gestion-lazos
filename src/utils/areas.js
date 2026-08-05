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
