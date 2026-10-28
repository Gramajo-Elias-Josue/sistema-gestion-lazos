// =====================================================================
// UTILIDAD: Estructura del informe / evaluación profesional
// ---------------------------------------------------------------------
// El informe que carga el profesional NO es texto suelto: sigue una
// PLANTILLA. Tiene un TIPO (mensual, anual, evolución, admisión, o la
// evaluación / certificado ocasional) que define el título, un TÍTULO
// editable, y VARIAS SECCIONES para llenar
// (el "cuerpo" del desarrollo es el principal; las otras son opcionales).
//
// Para no migrar la base, todo eso se guarda serializado en JSON dentro de
// la columna `evaluaciones.contenido`. Estas funciones son PURAS (sin DB ni
// DOM): convierten entre el objeto que usan el formulario y el PDF, y el
// string JSON de la base. Toleran informes VIEJOS (texto plano o el formato
// anterior de secciones) para que siempre se puedan ver y reimprimir.
// =====================================================================

// Tipos de INFORME (los periódicos, que se cargan tras atender al
// paciente). `key` = lo que se guarda; `titulo` = título por defecto que
// se muestra centrado en el PDF (el profesional puede editarlo).
export const TIPOS_INFORME = [
  { key: 'mensual',   titulo: 'INFORME MENSUAL' },
  { key: 'anual',     titulo: 'INFORME ANUAL' },
  { key: 'evolucion', titulo: 'INFORME DE EVOLUCIÓN' },
  { key: 'admision',  titulo: 'INFORME DE ADMISIÓN' },
];

// EVALUACIÓN / CERTIFICADO: documento OCASIONAL (se hace cuando alguien
// lo pide), para pacientes habituales y también para casuales sin legajo.
// No entra en la lista de informes: tiene su propio botón y su propio
// requisito (haber asistido alguna vez, no necesariamente hoy).
export const TIPO_CERTIFICADO = { key: 'certificado', titulo: 'EVALUACIÓN / CERTIFICADO' };

// Secciones que llena el profesional, en orden. `cuerpo` es el desarrollo
// principal (obligatorio); `objetivos` e `indicaciones` son opcionales.
export const SECCIONES_INFORME = [
  { key: 'objetivos',    label: 'Objetivos / motivo',        opcional: true },
  { key: 'cuerpo',       label: 'Desarrollo del informe',    opcional: false },
  { key: 'indicaciones', label: 'Indicaciones / conclusión', opcional: true },
];

// Título por defecto de un tipo (o el del primer tipo si no se reconoce).
export function tituloPorTipo(tipoKey) {
  const t = [...TIPOS_INFORME, TIPO_CERTIFICADO].find(x => x.key === tipoKey);
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

// ---------------------------------------------------------------------
// GATE "ATENDIDO HOY": quién puede cargar el informe de un paciente
// ---------------------------------------------------------------------
// El paciente con legajo se atiende por la GRILLA (la agenda de turnos es
// solo para casuales sin legajo, que no tienen historia clínica). Puede
// cargar el informe el profesional que lo tiene asignado en la grilla
// (asignación vigente), si AMBOS figuran presentes hoy: el paciente en la
// planilla de asistencia y el profesional en su fichaje.
//
// Devuelve la lista de "autores" posibles con la forma que espera
// pacientesView.renderFormEvaluacion (id de turno null, profesional_id,
// profesionales embebido, hora null). Un profesional que lo tiene en
// varias franjas aparece una sola vez.
//   asignaciones     -> asignacionModel.listarPorPaciente(id, {soloVigentes:true})
//   pacientePresente -> boolean (asistencias de hoy)
//   idsProfPresentes -> Set de profesional_id fichados presente hoy
// Un profesional firma SOLO sus informes (la base no le deja guardar
// otros: ver supabase/sql/14-escritura-informes-y-documentos.sql), así
// que en el editor se le ofrecen solo sus filas. Dirección y secretaría
// pueden cargar el de cualquiera.
export function autoresDelUsuario(autores = [], perfil = null) {
  if (perfil?.rol !== 'profesional') return autores;
  return autores.filter(a => String(a.profesional_id) === String(perfil.profesional_id));
}

export function autoresElegiblesHoy({ asignaciones = [], pacientePresente = false, idsProfPresentes = new Set() } = {}) {
  const autores = [];
  if (!pacientePresente) return autores;

  asignaciones
    .filter(a => a.profesional_id && idsProfPresentes.has(String(a.profesional_id)))
    .forEach(a => {
      if (!autores.some(x => String(x.profesional_id) === String(a.profesional_id))) {
        autores.push({ id: null, profesional_id: a.profesional_id, profesionales: a.profesionales, hora: null });
      }
    });

  return autores;
}

// ---------------------------------------------------------------------
// REQUISITO DE LA EVALUACIÓN / CERTIFICADO (paciente habitual)
// ---------------------------------------------------------------------
// No hace falta que haya venido HOY, pero sí que su asistencia con ese
// profesional esté confirmada alguna vez: un día marcado "presente" en
// la planilla mientras lo tenía en su grilla (asignación vigente ese día,
// aunque hoy ya esté cerrada). Así nadie firma por un paciente que nunca
// atendió.
//   asignaciones   -> asignacionModel.listarPorPaciente(id) (vigentes Y cerradas)
//   fechasPresente -> fechas 'yyyy-mm-dd' en que el paciente figuró presente
// Devuelve los autores con la forma de renderFormEvaluacion (sin turno).
export function autoresCertificado({ asignaciones = [], fechasPresente = [] } = {}) {
  const autores = [];
  asignaciones
    .filter(a => a.profesional_id)
    .filter(a => fechasPresente.some(f =>
      (!a.vigente_desde || f >= a.vigente_desde) && (!a.vigente_hasta || f <= a.vigente_hasta)))
    .forEach(a => {
      if (!autores.some(x => String(x.profesional_id) === String(a.profesional_id))) {
        autores.push({ id: null, profesional_id: a.profesional_id, profesionales: a.profesionales, hora: null });
      }
    });
  return autores;
}
