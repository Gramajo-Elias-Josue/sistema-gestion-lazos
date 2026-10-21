// =====================================================================
// TURNOS DEL CENTRO: mañana y tarde
// ---------------------------------------------------------------------
// Funciones PURAS. El centro trabaja en dos turnos fijos (como en la
// clínica real): mañana de 8 a 12 y tarde de 14 a 18. Cada profesional
// tilda en cuál trabaja (uno o los dos) y eso se guarda en
// `profesionales.turnos_trabajo` (['manana'], ['tarde'] o ambos).
//
// De acá salen las franjas de la Grilla de atención y el horario
// "habitual" que usan el fichaje, la agenda y el panel de Inicio.
// (No confundir con los TURNOS de la agenda: esos son las citas.)
// =====================================================================

export const TURNOS_CENTRO = [
  { clave: 'manana', etiqueta: 'Turno mañana', corto: 'Mañana', desde: '08:00', hasta: '12:00' },
  { clave: 'tarde',  etiqueta: 'Turno tarde',  corto: 'Tarde',  desde: '14:00', hasta: '18:00' },
];

// '08:00' -> '8', '14:30' -> '14:30' (para textos tipo "8 a 12 hs").
function horaCorta(hhmm) {
  const [h, m] = hhmm.split(':');
  return m === '00' ? String(Number(h)) : `${Number(h)}:${m}`;
}

// "8 a 12 hs" de un turno del centro.
export function rangoTurno(turno) {
  return `${horaCorta(turno.desde)} a ${horaCorta(turno.hasta)} hs`;
}

// Turnos del centro en los que trabaja el profesional, en orden.
export function turnosDe(profesional) {
  const claves = Array.isArray(profesional?.turnos_trabajo) ? profesional.turnos_trabajo : [];
  return TURNOS_CENTRO.filter(t => claves.includes(t.clave));
}

// Horario habitual del día: desde que empieza su primer turno hasta que
// termina el último ({ entrada: '08:00', salida: '18:00' } si hace los
// dos). Sin turnos cargados, los dos vacíos.
export function horarioDe(profesional) {
  const turnos = turnosDe(profesional);
  if (!turnos.length) return { entrada: '', salida: '' };
  return { entrada: turnos[0].desde, salida: turnos[turnos.length - 1].hasta };
}

// Texto para mostrar: "Mañana (8 a 12 hs)", "Mañana y tarde", o '' si no
// tiene ninguno.
export function textoTurnos(profesional) {
  const turnos = turnosDe(profesional);
  if (turnos.length === 1) return `${turnos[0].corto} (${rangoTurno(turnos[0])})`;
  if (turnos.length > 1) return 'Mañana y tarde';
  return '';
}

// ¿Esa hora ('HH:MM') cae dentro de alguno de sus turnos?
export function atiendeALaHora(profesional, hora) {
  const hhmm = String(hora || '').slice(0, 5);
  return turnosDe(profesional).some(t => hhmm >= t.desde && hhmm < t.hasta);
}

// Turno que conviene mostrar primero según la hora actual: a la mañana
// (y antes de abrir) el de la mañana; desde el mediodía, el de la tarde.
export function turnoSegunHora(ahora) {
  return String(ahora || '').slice(0, 5) >= '12:00' ? 'tarde' : 'manana';
}
