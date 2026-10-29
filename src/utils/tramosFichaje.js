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
// El de doble turno tiene además un ESTADO por turno (script 18):
// estado_1 (mañana) y estado_2 (tarde). Puede faltar a la mañana y venir
// a la tarde. El estado del día (`estado`) lo calcula la base.
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

// Estado de UN turno (tramo n). Con un solo turno, el del día. Con doble
// turno, su estado_n; si no se marcó ningún turno, vale el del día (así
// una licencia cargada para todo el día bloquea los dos turnos).
export function estadoDeTramo(fila, n = 1, dobleTurno = false) {
  if (!fila) return null;
  if (!dobleTurno) return fila.estado || null;
  if (fila.estado_1 == null && fila.estado_2 == null) return fila.estado || null;
  return fila[`estado_${n}`] || null;
}

// ¿Ese turno está marcado ausente / licencia? (entonces no se ficha)
export function tramoBloqueado(fila, n = 1, dobleTurno = false) {
  const e = estadoDeTramo(fila, n, dobleTurno);
  return !!e && e !== 'presente';
}

// Qué botones se pueden tocar ahora. Devuelve { entrada, salida,
// entrada_2, salida_2 } (true = habilitado). Misma regla que fichar():
//   entrada   -> sin mañana fichada y sin haber empezado la tarde
//   salida    -> con la entrada de la mañana y sin su salida
//   entrada_2 -> (doble turno) sin tarde, y con la mañana cerrada o sin mañana
//   salida_2  -> con la entrada de la tarde y sin su salida
export function botonesFichaje(fila, dobleTurno = false) {
  const b1 = tramoBloqueado(fila, 1, dobleTurno);
  const b2 = !dobleTurno || tramoBloqueado(fila, 2, dobleTurno);
  const e1 = !!fila?.hora_entrada, s1 = !!fila?.hora_salida;
  const e2 = !!fila?.hora_entrada_2, s2 = !!fila?.hora_salida_2;
  return {
    entrada: !b1 && !e1 && !e2,
    salida: !b1 && e1 && !s1,
    // La tarde: con la mañana cerrada, o sin mañana (faltó o no la fichó).
    entrada_2: !b2 && !e2 && (!e1 || s1 || b1),
    salida_2: !b2 && e2 && !s2,
  };
}

// Lo que le falta fichar hoy (para el recordatorio del Inicio):
//   'bloqueado' (ausente / licencia), 'salida', 'salida_2', 'entrada_2',
//   'entrada' o 'listo'. Primero lo que está abierto (una salida pendiente).
export function pasoFichaje(fila, dobleTurno = false) {
  const b1 = tramoBloqueado(fila, 1, dobleTurno);
  const b2 = dobleTurno && tramoBloqueado(fila, 2, dobleTurno);
  if (b1 && (!dobleTurno || b2)) return 'bloqueado';
  const e1 = !!fila?.hora_entrada, s1 = !!fila?.hora_salida;
  const e2 = !!fila?.hora_entrada_2, s2 = !!fila?.hora_salida_2;
  if (!b1 && e1 && !s1) return 'salida';
  if (!dobleTurno) return e1 ? 'listo' : 'entrada';
  if (!b2 && e2 && !s2) return 'salida_2';
  // Un turno está "terminado" si se fichó su salida o está marcado
  // ausente / licencia (la mañana, también si arrancó directo la tarde).
  const listaManana = b1 || s1 || (e2 && !e1);
  const listaTarde = b2 || s2;
  if (!listaManana && !e2) return 'entrada';
  if (!listaTarde) return 'entrada_2';
  return 'listo';
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
