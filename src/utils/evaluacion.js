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
// AUTORES DEL USUARIO
// ---------------------------------------------------------------------
// Un profesional firma SOLO sus informes (la base no le deja guardar
// otros: ver supabase/sql/14-escritura-informes-y-documentos.sql), así
// que en el editor se le ofrecen solo sus filas. Dirección y secretaría
// pueden cargar el de cualquiera. (Quién puede cargar el informe del mes:
// ver autoresElegiblesMes, más abajo.)
export function autoresDelUsuario(autores = [], perfil = null) {
  if (perfil?.rol !== 'profesional') return autores;
  return autores.filter(a => String(a.profesional_id) === String(perfil.profesional_id));
}

// ---------------------------------------------------------------------
// GATE DEL INFORME MENSUAL: atendido ALGÚN día de este mes
// ---------------------------------------------------------------------
// El informe es MENSUAL: se puede cargar cualquier día del mes, siempre
// que el profesional haya atendido al paciente al menos una vez en el
// mes: un mismo día con el paciente presente en la planilla y el
// profesional presente (planilla de la secretaría o su propio fichaje),
// y el paciente en su grilla (asignación vigente).
//   asignaciones     -> asignacionModel.listarPorPaciente(id, {soloVigentes:true})
//   fechasPaciente   -> fechas del mes en que el paciente figuró presente
//   presenciasProf   -> { profesional_id: Set de fechas en que estuvo presente }
// Devuelve los autores con la forma de renderFormEvaluacion (sin turno).
export function autoresElegiblesMes({ asignaciones = [], fechasPaciente = [], presenciasProf = {} } = {}) {
  const autores = [];
  asignaciones
    .filter(a => a.profesional_id)
    .filter(a => {
      const suyas = presenciasProf[String(a.profesional_id)];
      return !!suyas && fechasPaciente.some(f => suyas.has(f));
    })
    .forEach(a => {
      if (!autores.some(x => String(x.profesional_id) === String(a.profesional_id))) {
        autores.push({ id: null, profesional_id: a.profesional_id, profesionales: a.profesionales, hora: null });
      }
    });
  return autores;
}

// Días en que cada profesional estuvo presente, juntando la planilla de
// la secretaría (estado "presente") y su propio fichaje (alguna hora
// fichada). Devuelve { profesional_id: Set de fechas }.
export function presenciasPorProfesional({ planilla = [], propios = [] } = {}) {
  const out = {};
  const sumar = (id, fecha) => { (out[String(id)] ||= new Set()).add(fecha); };
  planilla.filter(r => r.estado === 'presente').forEach(r => sumar(r.profesional_id, r.fecha));
  propios.filter(r => r.hora_entrada || r.hora_entrada_2).forEach(r => sumar(r.profesional_id, r.fecha));
  return out;
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
