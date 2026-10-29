// =====================================================================
// UTILIDADES: Control de horas (para los sueldos, solo dirección)
// ---------------------------------------------------------------------
// Funciones PURAS. Comparan, por profesional y por día, los DOS registros
// de asistencia que hay desde el script 19:
//   planilla -> lo que cargó la SECRETARÍA (asistencias_profesionales)
//   propio   -> lo que fichó el PROFESIONAL con su ubicación (fichajes_propios)
// y marcan las diferencias, para que la dirección pague sabiendo qué
// cuadra y qué no. Cada registro puede tener dos tramos (mañana y tarde
// de quien hace los dos turnos).
// =====================================================================

import { horaAMinutos } from './fechas.js';

// Diferencia (en minutos) a partir de la cual se avisa que los dos
// registros no coinciden. Menos que eso es "lo mismo" (un par de minutos
// de diferencia entre que llegó y la secretaría lo anotó).
export const TOLERANCIA_MIN = 15;

// "HH:MM:SS" -> "HH:MM" (o null).
const hhmm = (t) => (t ? String(t).slice(0, 5) : null);

// Minutos de un tramo (entrada → salida). Sin alguna de las dos: 0.
export function minutosTramo(entrada, salida) {
  if (!entrada || !salida) return 0;
  const m = horaAMinutos(hhmm(salida)) - horaAMinutos(hhmm(entrada));
  return m > 0 ? m : 0;
}

// Minutos del día de un registro (los dos tramos).
export function minutosDia(reg) {
  if (!reg) return 0;
  return minutosTramo(reg.hora_entrada, reg.hora_salida) + minutosTramo(reg.hora_entrada_2, reg.hora_salida_2);
}

// "08:00 a 12:00 · 14:00 a 18:00" (los tramos que tengan alguna hora).
export function horarioTexto(reg) {
  if (!reg) return '—';
  const tramo = (e, s) => (e || s) ? `${hhmm(e) || '—'} a ${hhmm(s) || '—'}` : null;
  const partes = [tramo(reg.hora_entrada, reg.hora_salida), tramo(reg.hora_entrada_2, reg.hora_salida_2)].filter(Boolean);
  return partes.length ? partes.join(' · ') : '—';
}

// 450 -> "7 h 30 min"; 0 -> "—".
export function formatearHoras(min) {
  if (!min) return '—';
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

// Minutos -> horas con dos decimales (para el Excel: se puede sumar).
export const enHoras = (min) => Math.round((min / 60) * 100) / 100;

// ¿Le quedó un tramo abierto (fichó la entrada y no la salida)?
function incompleto(reg) {
  return !!reg && ((reg.hora_entrada && !reg.hora_salida) || (reg.hora_entrada_2 && !reg.hora_salida_2));
}

// Qué no cuadra en un día (o null si los dos registros coinciden).
export function alertaDelDia(planilla, propio) {
  const presentePlanilla = planilla?.estado === 'presente';
  const fichoPropio = !!(propio?.hora_entrada || propio?.hora_entrada_2);
  if (presentePlanilla && !fichoPropio) return 'Solo en la planilla (no fichó)';
  if (fichoPropio && !presentePlanilla) {
    return planilla ? `Fichó, pero la planilla dice "${planilla.estado}"` : 'Solo en su fichaje (sin planilla)';
  }
  if (incompleto(propio)) return 'Su fichaje quedó sin salida';
  const conHorasPlanilla = minutosDia(planilla) > 0;
  if (presentePlanilla && fichoPropio && conHorasPlanilla) {
    const dif = Math.abs(minutosDia(planilla) - minutosDia(propio));
    if (dif > TOLERANCIA_MIN) return `Diferencia de ${formatearHoras(dif)}`;
  }
  return null;
}

// Resumen del mes por profesional:
//   profesionales -> activos [{ id, nombre_completo, profesion }]
//   planillas     -> asistencias_profesionales del mes
//   propios       -> fichajes_propios del mes
// Devuelve [{ profesional, diasPlanilla, minPlanilla, diasPropio,
//   minPropio, alertas, dias: [{ fecha, planilla, propio, alerta }] }]
// ordenado por nombre. Un día cuenta para la planilla si dice
// "presente", y para el fichaje si fichó alguna entrada.
export function resumenControlHoras({ profesionales = [], planillas = [], propios = [] } = {}) {
  return profesionales.map(profesional => {
    const id = String(profesional.id);
    const suyasP = planillas.filter(r => String(r.profesional_id) === id);
    const suyasF = propios.filter(r => String(r.profesional_id) === id);
    const fechas = [...new Set([...suyasP.map(r => r.fecha), ...suyasF.map(r => r.fecha)])].sort();

    const dias = fechas.map(fecha => {
      const planilla = suyasP.find(r => r.fecha === fecha) || null;
      const propio = suyasF.find(r => r.fecha === fecha) || null;
      return { fecha, planilla, propio, alerta: alertaDelDia(planilla, propio) };
    });

    const enPlanilla = dias.filter(d => d.planilla?.estado === 'presente');
    const enPropio = dias.filter(d => d.propio?.hora_entrada || d.propio?.hora_entrada_2);
    return {
      profesional,
      diasPlanilla: enPlanilla.length,
      minPlanilla: enPlanilla.reduce((t, d) => t + minutosDia(d.planilla), 0),
      diasPropio: enPropio.length,
      minPropio: enPropio.reduce((t, d) => t + minutosDia(d.propio), 0),
      alertas: dias.filter(d => d.alerta).length,
      dias,
    };
  }).sort((a, b) => (a.profesional.nombre_completo || '').localeCompare(b.profesional.nombre_completo || '', 'es'));
}
