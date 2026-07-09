// =====================================================================
// UTILIDADES: Validación de formularios
// ---------------------------------------------------------------------
// Funciones PURAS: reciben los datos de un formulario y devuelven
//   { ok: true }                 -> si está todo bien
//   { ok: false, mensaje: '…' }  -> con el primer problema encontrado
// No tocan el DOM ni la base. Así la regla de negocio queda en un solo
// lugar, fácil de leer y de probar. Las validaciones que necesitan
// consultar la base (p. ej. DNI repetido) se hacen aparte en el modelo.
// =====================================================================

import { hoyISO, horaAMinutos } from './fechas.js';

// Deja solo los dígitos de un texto. Ej: "12.345.678" -> "12345678".
export function normalizarDni(dni) {
  return String(dni || '').replace(/\D/g, '');
}

// ---- Paciente ----
// El DNI es el identificador principal del paciente: es obligatorio.
export function validarPaciente(datos) {
  if (!datos.nombre_completo || !datos.nombre_completo.trim()) {
    return error('El nombre del paciente es obligatorio.');
  }
  if (!datos.dni || !normalizarDni(datos.dni)) {
    return error('El DNI es obligatorio.');
  }
  if (!/^\d{6,9}$/.test(normalizarDni(datos.dni))) {
    return error('El DNI debe tener solo números (entre 6 y 9 dígitos).');
  }
  if (datos.fecha_nacimiento && datos.fecha_nacimiento > hoyISO()) {
    return error('La fecha de nacimiento no puede ser una fecha futura.');
  }
  if (datos.fecha_ingreso && datos.fecha_ingreso > hoyISO()) {
    return error('La fecha de ingreso no puede ser una fecha futura.');
  }
  return ok();
}

// ---- Documento de la historia clínica ----
export function validarDocumento(datos) {
  if (!datos.tipo) {
    return error('Elegí el tipo de documento.');
  }
  if (datos.fecha_emision && datos.fecha_vencimiento &&
      datos.fecha_vencimiento < datos.fecha_emision) {
    return error('El vencimiento no puede ser anterior a la fecha de emisión.');
  }
  return ok();
}

// ---- Turno ----
export function validarTurno(datos) {
  if (!datos.paciente_id) return error('Elegí el paciente del turno.');
  if (!datos.profesional_id) return error('Elegí el profesional del turno.');
  if (!datos.fecha) return error('La fecha del turno es obligatoria.');
  return ok();
}

// ---- Fichaje (asistencia) de profesional ----
// `ctx` da el contexto temporal: { esHoy, ahora: 'HH:MM' }. Reglas:
//   - "Presente" NO exige horas: marca que el profesional asiste hoy
//     (sirve para confirmar disponibilidad temprano y asignar turnos).
//     La entrada/salida se registran después, cuando ocurren.
//   - No puede haber salida sin entrada, ni salida anterior a la entrada.
//   - Si la fecha es HOY, no se puede registrar la hora de entrada si todavía no
//     ocurrió (con 10 min de tolerancia por desfasajes de reloj).
export function validarFichajeProfesional(datos, ctx = {}) {
  const { esHoy = false, ahora = '' } = ctx;

  if (datos.hora_salida && !datos.hora_entrada) {
    return error('No se puede registrar una salida sin la hora de entrada.');
  }
  if (datos.hora_entrada && datos.hora_salida && datos.hora_salida < datos.hora_entrada) {
    return error('La hora de salida no puede ser anterior a la de entrada.');
  }

  if (esHoy && ahora) {
    const TOLERANCIA = 10; // minutos
    const limite = horaAMinutos(ahora) + TOLERANCIA;
    if (datos.hora_entrada && horaAMinutos(datos.hora_entrada) > limite) {
      return error(`La hora de entrada (${datos.hora_entrada}) todavía no ocurrió: solo se puede fichar lo que ya pasó.`);
    }
  }
  return ok();
}

// ---- Evaluación diaria ----
export function validarEvaluacion(datos) {
  if (!datos.contenido || !datos.contenido.trim()) {
    return error('Escribí la evaluación antes de guardar.');
  }
  return ok();
}

// ---- Profesional ----
export function validarProfesional(datos) {
  if (!datos.nombre_completo || !datos.nombre_completo.trim()) {
    return error('El nombre del profesional es obligatorio.');
  }
  if (datos.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(datos.email)) {
    return error('El email no tiene un formato válido.');
  }
  return ok();
}

// Pequeños ayudantes para no repetir la forma del resultado.
function ok() { return { ok: true }; }
function error(mensaje) { return { ok: false, mensaje }; }
