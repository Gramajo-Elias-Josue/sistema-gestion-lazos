// =====================================================================
// UTILIDAD: Estructura del informe / evaluación profesional
// ---------------------------------------------------------------------
// El informe que carga el profesional NO es texto suelto: sigue una
// PLANTILLA. Tiene un TIPO (mensual, evaluación, evolución, admisión) que
// define el título, un TÍTULO editable, y VARIAS SECCIONES para llenar
// (el "cuerpo" del desarrollo es el principal; las otras son opcionales).
//
// Para no migrar la base, todo eso se guarda serializado en JSON dentro de
// la columna `evaluaciones.contenido`. Estas funciones son PURAS (sin DB ni
// DOM): convierten entre el objeto que usan el formulario y el PDF, y el
// string JSON de la base. Toleran informes VIEJOS (texto plano o el formato
// anterior de secciones) para que siempre se puedan ver y reimprimir.
// =====================================================================

// Tipos de informe. `key` = lo que se guarda; `titulo` = título por defecto
// que se muestra centrado en el PDF (el profesional puede editarlo).
export const TIPOS_INFORME = [
  { key: 'mensual',   titulo: 'INFORME MENSUAL' },
  { key: 'anual',     titulo: 'INFORME ANUAL' },
  { key: 'diario',    titulo: 'INFORME DIARIO' },
  { key: 'evolucion', titulo: 'INFORME DE EVOLUCIÓN' },
  { key: 'admision',  titulo: 'INFORME DE ADMISIÓN' },
];

// ---------------------------------------------------------------------
// PLAZO DE LA EVALUACIÓN DIARIA
// ---------------------------------------------------------------------
// La evaluación diaria es OPCIONAL: hay profesionales que la llevan en
// papel y está bien. Pero cuando se carga en el sistema no puede cargarse
// meses después, porque deja de ser un registro del día: se admite hasta
// una semana de atraso. Pasado ese plazo el día queda como consulta.
export const DIAS_PLAZO_EVALUACION = 7;

// Diferencia en días entre dos fechas ISO (yyyy-mm-dd). Positiva si la
// primera es posterior. Se calcula a mano (sin new Date() implícito) para
// que la función sea pura y se pueda probar con cualquier "hoy".
function diasEntre(fechaA, fechaB) {
  const a = new Date(`${fechaA}T00:00:00`);
  const b = new Date(`${fechaB}T00:00:00`);
  return Math.round((a - b) / 86400000);
}

// ¿Se puede cargar/editar la evaluación diaria de esa fecha?
// Devuelve { editable, motivo, mensaje } con el mensaje ya escrito para
// el usuario. motivo: 'futuro' | 'vencido' | null.
export function estadoCargaEvaluacion(fecha, hoy, dias = DIAS_PLAZO_EVALUACION) {
  const diferencia = diasEntre(fecha, hoy);

  if (diferencia > 0) {
    return {
      editable: false,
      motivo: 'futuro',
      mensaje: 'Fecha futura: la evaluación se carga el día de la atención o después.',
    };
  }
  if (-diferencia > dias) {
    return {
      editable: false,
      motivo: 'vencido',
      mensaje: `Pasó más de una semana de esta fecha (${-diferencia} días): la evaluación diaria ya no se puede cargar ni cambiar. Queda para consulta.`,
    };
  }
  return { editable: true, motivo: null, mensaje: null };
}

// Días que quedan para cargar la evaluación de una fecha (0 = último
// día). null si ya no se puede. Sirve para avisar antes de que se cierre.
export function diasRestantesEvaluacion(fecha, hoy, dias = DIAS_PLAZO_EVALUACION) {
  const estado = estadoCargaEvaluacion(fecha, hoy, dias);
  if (!estado.editable) return null;
  return dias + diasEntre(fecha, hoy);
}

// Secciones que llena el profesional, en orden. `cuerpo` es el desarrollo
// principal (obligatorio); `objetivos` e `indicaciones` son opcionales.
export const SECCIONES_INFORME = [
  { key: 'objetivos',    label: 'Objetivos / motivo',        opcional: true },
  { key: 'cuerpo',       label: 'Desarrollo del informe',    opcional: false },
  { key: 'indicaciones', label: 'Indicaciones / conclusión', opcional: true },
];

// Título por defecto de un tipo (o el del primer tipo si no se reconoce).
export function tituloPorTipo(tipoKey) {
  const t = TIPOS_INFORME.find(x => x.key === tipoKey);
  return t ? t.titulo : TIPOS_INFORME[0].titulo;
}

// Informe vacío base (tipo mensual, sin contenido).
function baseInforme() {
  const o = { tipo: 'mensual', titulo: tituloPorTipo('mensual') };
  SECCIONES_INFORME.forEach(s => { o[s.key] = ''; });
  return o;
}

// String guardado en `contenido` -> objeto { tipo, titulo, cuerpo, … }.
// Tolera: (a) JSON del formato actual; (b) JSON del formato anterior
// (motivo/desarrollo); (c) texto plano viejo -> va al cuerpo.
export function parseEvaluacion(contenido) {
  const base = baseInforme();
  if (!contenido || typeof contenido !== 'string') return base;

  try {
    const o = JSON.parse(contenido);
    if (o && typeof o === 'object' && !Array.isArray(o)) {
      if (typeof o.tipo === 'string') base.tipo = o.tipo;
      if (typeof o.titulo === 'string' && o.titulo.trim()) base.titulo = o.titulo;
      SECCIONES_INFORME.forEach(s => { if (typeof o[s.key] === 'string') base[s.key] = o[s.key]; });
      // Compatibilidad con el formato anterior de secciones.
      if (!base.cuerpo && typeof o.desarrollo === 'string') base.cuerpo = o.desarrollo;
      if (!base.objetivos && typeof o.motivo === 'string') base.objetivos = o.motivo;
      return base;
    }
  } catch {
    // No era JSON: informe viejo de texto plano.
  }
  base.cuerpo = String(contenido);
  return base;
}

// Objeto del formulario -> string JSON para guardar (recorta espacios y
// completa el título si quedó vacío según el tipo).
export function serializarEvaluacion(datos = {}) {
  const out = {
    tipo: datos.tipo || 'mensual',
    titulo: (datos.titulo || '').trim() || tituloPorTipo(datos.tipo),
  };
  SECCIONES_INFORME.forEach(s => { out[s.key] = (datos[s.key] || '').trim(); });
  return JSON.stringify(out);
}

// true si TODAS las secciones están vacías (no hay informe que guardar).
export function evaluacionVacia(datos = {}) {
  return SECCIONES_INFORME.every(s => !(datos[s.key] || '').trim());
}
