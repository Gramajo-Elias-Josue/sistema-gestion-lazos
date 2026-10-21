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
// `esNuevo` = true al CREAR (exige fecha de ingreso); al editar un
// paciente ya cargado no se lo exige retroactivamente si le faltaba.
export function validarPaciente(datos, { esNuevo = false } = {}) {
  if (!datos.nombre_completo || !datos.nombre_completo.trim()) {
    return error('Falta el nombre del paciente.');
  }
  if (!datos.dni || !normalizarDni(datos.dni)) {
    return error('Falta el DNI.');
  }
  if (!/^\d{6,9}$/.test(normalizarDni(datos.dni))) {
    return error('Revisá el DNI: van solo números, sin puntos.');
  }
  if (datos.fecha_nacimiento && datos.fecha_nacimiento > hoyISO()) {
    return error('La fecha de nacimiento no puede ser posterior a hoy.');
  }
  if (esNuevo && !datos.fecha_ingreso) {
    return error('Falta la fecha de ingreso.');
  }
  if (datos.fecha_ingreso && datos.fecha_ingreso > hoyISO()) {
    return error('La fecha de ingreso no puede ser posterior a hoy.');
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
    return error('El vencimiento no puede ser anterior a la emisión.');
  }
  return ok();
}

// ---- Turno ----
// Turno CASUAL (persona sin legajo). La hora es obligatoria: sin ella no
// se puede controlar que no pise un turno fijo de la grilla.
export function validarTurno(datos) {
  if (!datos.paciente_nombre || !datos.paciente_nombre.trim()) return error('Escribí el nombre del paciente.');
  if (datos.paciente_dni && !/^\d{6,9}$/.test(normalizarDni(datos.paciente_dni))) {
    return error('Revisá el DNI: van solo números, sin puntos.');
  }
  if (!datos.profesional_id) return error('Elegí el profesional del turno.');
  if (!datos.fecha) return error('Elegí la fecha del turno.');
  if (!datos.hora) return error('Elegí la hora del turno.');
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
    return error('Cargá primero la hora de entrada.');
  }
  if (datos.hora_entrada && datos.hora_salida && datos.hora_salida < datos.hora_entrada) {
    return error('La hora de salida tiene que ser posterior a la de entrada.');
  }

  if (esHoy && ahora) {
    const TOLERANCIA = 10; // minutos
    const limite = horaAMinutos(ahora) + TOLERANCIA;
    if (datos.hora_entrada && horaAMinutos(datos.hora_entrada) > limite) {
      return error('Esa hora de entrada todavía no llegó. Revisá el horario.');
    }
  }
  return ok();
}

// ---- Profesional ----
// `esNuevo` = true al CREAR: ahí se exigen todos los datos (menos
// matrícula y teléfono 2, que quedan opcionales). Al editar uno ya
// cargado no se le exige retroactivamente lo que le faltara.
export function validarProfesional(datos, { esNuevo = false } = {}) {
  if (!datos.nombre_completo || !datos.nombre_completo.trim()) {
    return error('Falta el nombre del profesional.');
  }
  if (esNuevo && (!datos.dni || !normalizarDni(datos.dni))) {
    return error('Falta el DNI.');
  }
  if (datos.dni && !/^\d{6,9}$/.test(normalizarDni(datos.dni))) {
    return error('Revisá el DNI: van solo números, sin puntos.');
  }
  if (esNuevo && !datos.fecha_nacimiento) {
    return error('Falta la fecha de nacimiento.');
  }
  if (datos.fecha_nacimiento && datos.fecha_nacimiento > hoyISO()) {
    return error('La fecha de nacimiento no puede ser posterior a hoy.');
  }
  if (esNuevo && (!datos.profesion || !datos.profesion.trim())) {
    return error('Falta la profesión.');
  }
  if (esNuevo && !datos.sector) {
    return error('Elegí el sector.');
  }
  if (esNuevo && (!datos.especialidad || !datos.especialidad.trim())) {
    return error('Falta la especialidad.');
  }
  if (esNuevo && (!datos.telefono || !datos.telefono.trim())) {
    return error('Falta el teléfono.');
  }
  if (esNuevo && (!datos.email || !datos.email.trim())) {
    return error('Falta el email.');
  }
  if (datos.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(datos.email)) {
    return error('Ese email no parece válido. Revisalo.');
  }
  if (esNuevo && (!datos.direccion || !datos.direccion.trim())) {
    return error('Falta la dirección.');
  }
  // El turno se exige también al editar: sin turno el profesional no
  // aparece en ninguna pestaña de la Grilla de atención.
  if (!Array.isArray(datos.turnos_trabajo) || !datos.turnos_trabajo.length) {
    return error('Elegí al menos un turno (mañana o tarde).');
  }
  if (esNuevo && (!Array.isArray(datos.dias_trabajo) || !datos.dias_trabajo.length)) {
    return error('Elegí al menos un día de trabajo.');
  }
  return ok();
}

// ---- Gasto ----
export function validarGasto(datos) {
  if (!datos.fecha) return error('Elegí la fecha del gasto.');
  if (!datos.concepto || !datos.concepto.trim()) return error('Escribí el concepto del gasto.');
  if (!datos.socio || !datos.socio.trim()) return error('Indicá qué socio pagó el gasto.');
  const monto = Number(datos.monto);
  if (!datos.monto || Number.isNaN(monto) || monto <= 0) return error('El monto tiene que ser mayor a cero.');
  return ok();
}

// Pequeños ayudantes para no repetir la forma del resultado.
function ok() { return { ok: true }; }
function error(mensaje) { return { ok: false, mensaje }; }
