// =====================================================================
// UTILIDADES: Tramos del fichaje (mañana / tarde)
// ---------------------------------------------------------------------
// Funciones PURAS. Cada día tiene UNA fila de fichaje por profesional,
// con hasta dos tramos (script 17):
//   tramo 1 (hora_entrada / hora_salida)     -> la mañana del que hace los
//                                               dos turnos, o el único
//                                               turno del que hace uno.
//   tramo 2 (hora_entrada_2 / hora_salida_2) -> la tarde del que hace los dos.
//
// Acá están las MISMAS reglas que aplica la base en fichar(): qué botón
// se puede tocar, qué le falta fichar y qué salida se puede deshacer.
// =====================================================================

import { turnosDe, TURNOS_CENTRO } from './turnosCentro.js';

// Columnas de cada tramo en la fila del día.
export const CAMPOS_TRAMO = {
  1: { entrada: 'hora_entrada', salida: 'hora_salida', entradaPor: 'entrada_por', salidaPor: 'salida_por',
       entradaDist: 'entrada_distancia_m', salidaDist: 'salida_distancia_m', fichaEntrada: 'entrada', fichaSalida: 'salida' },
  2: { entrada: 'hora_entrada_2', salida: 'hora_salida_2', entradaPor: 'entrada_2_por', salidaPor: 'salida_2_por',
       entradaDist: 'entrada_2_distancia_m', salidaDist: 'salida_2_distancia_m', fichaEntrada: 'entrada_2', fichaSalida: 'salida_2' },
};

// ¿Trabaja los dos turnos? (entonces ficha dos tramos)
export function esDobleTurno(profesional) {
  return turnosDe(profesional).length >= 2;
}

// Tramos que ficha el profesional, cada uno con su turno del centro:
//   dos turnos -> [{ n: 1, turno: mañana }, { n: 2, turno: tarde }]
//   uno        -> [{ n: 1, turno: ese }]
//   ninguno    -> [{ n: 1, turno: null }]  (ficha igual, sin turno asignado)
export function tramosDe(profesional) {
  const turnos = turnosDe(profesional);
  if (turnos.length >= 2) {
    return [
      { n: 1, turno: TURNOS_CENTRO.find(t => t.clave === 'manana') },
      { n: 2, turno: TURNOS_CENTRO.find(t => t.clave === 'tarde') },
    ];
  }
  return [{ n: 1, turno: turnos[0] || null }];
}

// Qué botones se pueden tocar ahora. Devuelve { entrada, salida,
// entrada_2, salida_2 } (true = habilitado). Misma regla que fichar():
//   entrada   -> sin mañana fichada y sin haber empezado la tarde
//   salida    -> con la entrada de la mañana y sin su salida
//   entrada_2 -> (doble turno) sin tarde, y con la mañana cerrada o sin mañana
//   salida_2  -> con la entrada de la tarde y sin su salida
export function botonesFichaje(fila, dobleTurno = false) {
  if (fila?.estado && fila.estado !== 'presente') {
    return { entrada: false, salida: false, entrada_2: false, salida_2: false };
  }
  const e1 = !!fila?.hora_entrada, s1 = !!fila?.hora_salida;
  const e2 = !!fila?.hora_entrada_2, s2 = !!fila?.hora_salida_2;
  return {
    entrada: !e1 && !e2,
    salida: e1 && !s1,
    entrada_2: dobleTurno && !e2 && (!e1 || s1),
    salida_2: dobleTurno && e2 && !s2,
  };
}

// Lo que le falta fichar hoy (para el recordatorio del Inicio):
//   'bloqueado' (ausente / licencia), 'salida', 'salida_2', 'entrada_2',
//   'entrada' o 'listo'. Primero lo que está abierto (una salida pendiente).
export function pasoFichaje(fila, dobleTurno = false) {
  if (fila?.estado && fila.estado !== 'presente') return 'bloqueado';
  const e1 = !!fila?.hora_entrada, s1 = !!fila?.hora_salida;
  const e2 = !!fila?.hora_entrada_2, s2 = !!fila?.hora_salida_2;
  if (e1 && !s1) return 'salida';
  if (!dobleTurno) return e1 ? 'listo' : 'entrada';
  if (e2 && !s2) return 'salida_2';
  if (s2) return 'listo';
  if (s1) return 'entrada_2';   // cerró la mañana, falta la tarde
  return 'entrada';
}

// ¿Se puede deshacer la salida de ese tramo? (misma regla que la base:
// solo si la fichó él con su ubicación; la de la mañana, si todavía no
// empezó la tarde)
export function puedeDeshacerSalida(fila, tramo = 1) {
  const c = CAMPOS_TRAMO[tramo];
  if (!c || !fila?.[c.salida] || fila[c.salidaPor] !== 'ubicacion') return false;
  if (tramo === 1 && fila.hora_entrada_2) return false;
  return true;
}

// Hora fichada que devolvió la base para lo que se fichó ('entrada',
// 'salida', 'entrada_2', 'salida_2'). Sin hora = no se guardó nada.
export function horaFichada(fila, que) {
  const columna = {
    entrada: 'hora_entrada', salida: 'hora_salida',
    entrada_2: 'hora_entrada_2', salida_2: 'hora_salida_2',
  }[que];
  return columna ? fila?.[columna] || null : null;
}
