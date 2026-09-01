// =====================================================================
// VISTA: Pacientes
// ---------------------------------------------------------------------
// CAPA VISTA. Arma el HTML del listado, del legajo (datos personales),
// de la HISTORIA CLÍNICA (documentos organizados por categoría) y de los
// formularios (alta/edición de paciente y carga de documento).
// Devuelve strings de HTML; el controlador los inserta y conecta eventos.
// =====================================================================

import { calcularEdad, formatearFecha, estadoVencimiento, iniciales } from '../utils/fechas.js';
import { esc, pill } from '../utils/ui.js';
import { TIPOS_INFORME, SECCIONES_INFORME, parseEvaluacion, evaluacionVacia } from '../utils/evaluacion.js';
import { CLINICA } from '../config/clinica.js';

// Tipos de documento de la historia clínica: código (lo que se guarda)
// y etiqueta legible (lo que se muestra).
export const TIPOS_DOCUMENTO = {
  cud:                'CUD',
  dni:                'DNI',
  certificado_medico: 'Certificado médico',
  autorizacion_os:    'Autorización obra social',
  informe_escolar:    'Informe escolar',
  evaluacion:         'Evaluación / Diagnóstico',
  informe:            'Informe de evolución',
  estudios:           'Estudios',
  consentimiento:     'Consentimiento informado',
  otro:               'Otro',
};

// Categorías en las que se ORGANIZA la historia clínica. Cada tarjeta
// agrupa uno o varios tipos de documento. Es la "estantería" del legajo.
export const CATEGORIAS_HISTORIA = [
  { titulo: 'CUD',                    icono: '🪪', tipos: ['cud'] },
  { titulo: 'DNI / Identificación',   icono: '🆔', tipos: ['dni'] },
  { titulo: 'Estudios y evaluaciones', icono: '🔬', tipos: ['estudios', 'evaluacion'] },
  { titulo: 'Historial médico',       icono: '🩺', tipos: ['certificado_medico', 'informe'] },
  { titulo: 'Obra social',            icono: '📋', tipos: ['autorizacion_os'] },
  { titulo: 'Escolar',                icono: '🏫', tipos: ['informe_escolar'] },
  { titulo: 'Otros',                  icono: '▤', tipos: ['consentimiento', 'otro'] },
];

// Devuelve la etiqueta legible de un tipo (o el código si no está mapeado).
function etiquetaTipo(tipo) {
  return TIPOS_DOCUMENTO[tipo] || tipo;
}

// Ordena documentos del más nuevo al más viejo por fecha de emisión.
function ordenarPorEmision(docs) {
  return [...docs].sort((a, b) => {
    if (!a.fecha_emision) return 1;
    if (!b.fecha_emision) return -1;
    return new Date(b.fecha_emision) - new Date(a.fecha_emision);
  });
}

// HTML de una fila de documento (reutilizado en la historia clínica).
function docRowHtml(d) {
  const e = estadoVencimiento(d.fecha_vencimiento);
  const partes = [];
  if (d.numero) partes.push('N° ' + esc(d.numero));
  if (d.fecha_emision) partes.push('emitido ' + formatearFecha(d.fecha_emision));
  if (d.fecha_vencimiento) partes.push('vence ' + formatearFecha(d.fecha_vencimiento));
  const meta = partes.length ? partes.join(' · ') : 'Sin datos de fecha';
  const archivo = d.storage_path ? esc(d.nombre_archivo || 'archivo') : 'Sin archivo adjunto';
  const obs = d.observaciones ? `<small style="color:var(--ink-soft)">${esc(d.observaciones)}</small>` : '';
  // El botón "Ver" solo aparece si hay un archivo adjunto.
  const verBtn = d.storage_path
    ? `<button class="btn ghost btn-ver-doc" style="padding:6px 12px">Ver</button>`
    : '';
  return `
    <div class="docrow" data-doc-id="${d.id}" data-path="${esc(d.storage_path || '')}">
      <div class="di">▤</div>
      <b>${esc(archivo)}<small>${meta}</small>${obs}</b>
      ${pill(e.clase, e.texto)}
      ${verBtn}
    </div>`;
}

// Estructura base: contenedor del listado + contenedor de detalle
// (que muestra el legajo o la historia clínica, según corresponda).
export function renderEstructura() {
  return `
    <div id="lista-pac">
      <div style="margin-bottom:18px">
        <p style="color:var(--ink-soft);font-size:15px">Pacientes admitidos. Tocá un paciente para abrir su legajo; usá los botones para su historia clínica, editar o dar de baja. Los ingresos nuevos se cargan desde <b>Admisión</b>.</p>
      </div>
      <div id="pac-tabla"></div>
    </div>
    <div id="ficha-pac" class="hidden"></div>`;
}

// Estado del CUD según el dato del paciente (tiene / no tiene CUD).
// El número y el archivo del CUD ya no se piden en el alta: el CUD se
// adjunta luego como documento en la historia clínica si hace falta.
function estadoCud(paciente) {
  return paciente.tiene_cud
    ? { texto: 'Con CUD', clase: 'ok' }
    : { texto: 'Sin CUD', clase: 'bad' };
}

// Tabla del listado de pacientes, con acciones por fila.
export function renderTabla(pacientes) {
  if (!pacientes.length) {
    return `<div class="tablewrap"><div class="state">No hay pacientes cargados todavía.</div></div>`;
  }

  const filas = pacientes.map(p => {
    const c = estadoCud(p);
    const activo = p.estado === 'activo';
    // Línea bajo el nombre: el DNI es el identificador del paciente.
    const sub = `DNI ${esc(p.dni || '—')}`;
    // Marca visual de inactivo.
    const tagInactivo = activo ? '' : ` ${pill('bad', 'Inactivo')}`;

    return `
      <tr data-id="${p.id}" style="${activo ? '' : 'opacity:.55'}">
        <td>
          <div class="pname">
            <div class="pav">${esc(iniciales(p.nombre_completo))}</div>
            <div><b>${esc(p.nombre_completo)}${tagInactivo}</b><br><small>${sub}</small></div>
          </div>
        </td>
        <td>${calcularEdad(p.fecha_nacimiento)} años</td>
        <td>${esc(p.obra_social || '—')}</td>
        <td>${pill(c.clase, c.texto)}</td>
        <td style="white-space:nowrap;text-align:right">
          <button class="btn ghost btn-historia" data-id="${p.id}" style="padding:6px 10px">Historia clínica</button>
          <button class="btn ghost btn-editar-row" data-id="${p.id}" style="padding:6px 10px">Editar</button>
          <button class="btn ghost btn-baja" data-id="${p.id}" data-estado="${esc(p.estado || '')}" data-nombre="${esc(p.nombre_completo)}" style="padding:6px 10px;color:${activo ? 'var(--red-600)' : 'var(--teal-700)'}">${activo ? 'Desactivar' : 'Activar'}</button>
        </td>
      </tr>`;
  }).join('');

  return `
    <div class="tablewrap">
      <table>
        <thead>
          <tr><th>Paciente</th><th>Edad</th><th>Obra social</th><th>Estado CUD</th><th></th></tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>`;
}

// Legajo: datos personales + contactos + acceso a la historia clínica.
export function renderFicha(paciente) {
  const cudDoc = (paciente.documentos || []).find(d => d.tipo === 'cud');
  const cudInfo = cudDoc ? estadoVencimiento(cudDoc.fecha_vencimiento) : null;
  const totalDocs = (paciente.documentos || []).length;

  const contactos = paciente.contactos_emergencia || [];
  const contactosHtml = contactos.length
    ? contactos.map(c =>
        `<div class="field"><span class="k">${esc(c.nombre)} · ${esc(c.vinculo || '—')}</span><span class="v">${esc(c.telefono || '—')}</span></div>`
      ).join('')
    : `<div class="field"><span class="k">Sin contactos cargados</span><span class="v">—</span></div>`;

  return `
    <button class="back" id="btn-volver">‹ Volver al listado</button>
    <div class="legajo-top">
      <div class="bigav">${esc(iniciales(paciente.nombre_completo))}</div>
      <div style="flex:1">
        <h2>${esc(paciente.nombre_completo)}</h2>
        <div class="meta">${esc(paciente.diagnostico || 'Sin diagnóstico')} · ${calcularEdad(paciente.fecha_nacimiento)} años · DNI ${esc(paciente.dni || '—')}</div>
      </div>
      <button class="btn ghost" id="btn-editar-pac">Editar legajo</button>
    </div>
    <div class="legajo-grid">
      <div class="panel">
        <div class="panel-h"><h2>Datos personales</h2></div>
        <div class="panel-b" style="padding:6px 20px 14px">
          <div class="field"><span class="k">DNI</span><span class="v">${esc(paciente.dni || '—')}</span></div>
          <div class="field"><span class="k">Fecha de nacimiento</span><span class="v">${formatearFecha(paciente.fecha_nacimiento)}</span></div>
          <div class="field"><span class="k">Domicilio</span><span class="v">${esc(paciente.domicilio || '—')}</span></div>
          <div class="field"><span class="k">Teléfono</span><span class="v">${esc(paciente.telefono || '—')}</span></div>
          <div class="field"><span class="k">Escuela</span><span class="v">${esc(paciente.escuela || '—')}</span></div>
          <div class="field"><span class="k">Referente familiar</span><span class="v">${esc(paciente.referente_familiar || '—')}</span></div>
          <div class="field"><span class="k">Obra social</span><span class="v">${esc(paciente.obra_social || '—')}</span></div>
          <div class="field"><span class="k">N° de afiliado</span><span class="v">${esc(paciente.numero_afiliado || '—')}</span></div>
          <div class="field"><span class="k">CUD</span><span class="v">${paciente.tiene_cud ? pill('ok', 'Sí') : pill('bad', 'No')}</span></div>
          ${cudDoc && cudDoc.fecha_vencimiento ? `<div class="field"><span class="k">CUD vence</span><span class="v">${formatearFecha(cudDoc.fecha_vencimiento)} ${cudInfo ? pill(cudInfo.clase, cudInfo.texto) : ''}</span></div>` : ''}
          <div class="field"><span class="k">Fecha de ingreso</span><span class="v">${formatearFecha(paciente.fecha_ingreso)}</span></div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-h"><h2>Historia clínica</h2><span class="cnt">${totalDocs} documentos</span></div>
        <div class="panel-b" style="padding:16px">
          <p style="color:var(--ink-soft);font-size:14.5px;margin-bottom:14px">CUD, DNI, estudios, informes médicos y demás documentación, organizada por categoría.</p>
          <button class="btn" id="btn-abrir-historia" style="width:100%;text-align:center">Abrir historia clínica</button>
        </div>
      </div>
      <div class="panel">
        <div class="panel-h"><h2>Contactos de emergencia</h2></div>
        <div class="panel-b" style="padding:6px 20px 14px">${contactosHtml}</div>
      </div>
    </div>`;
}

// ¿El documento coincide con el término de búsqueda? Busca en el tipo,
// el número, el nombre del archivo, las observaciones y las fechas.
function docCoincide(d, term) {
  const campos = [
    etiquetaTipo(d.tipo), d.numero, d.nombre_archivo,
    d.observaciones, d.fecha_emision, d.fecha_vencimiento,
  ];
  return campos.some(c => c && String(c).toLowerCase().includes(term));
}

// Tarjetas de categorías de la historia clínica, opcionalmente filtradas.
// Se exporta aparte para poder re-renderizar solo esta parte al buscar.
export function renderCategorias(docs, filtro = '') {
  const term = filtro.trim().toLowerCase();

  const tarjetas = CATEGORIAS_HISTORIA.map(cat => {
    let propios = ordenarPorEmision(docs.filter(d => cat.tipos.includes(d.tipo)));
    if (term) propios = propios.filter(d => docCoincide(d, term));

    // Con búsqueda activa, se ocultan las categorías sin coincidencias.
    if (term && !propios.length) return '';

    const cuerpo = propios.length
      ? propios.map(docRowHtml).join('')
      : `<div class="state" style="padding:18px">Sin documentos.</div>`;

    // El botón "+ Agregar" solo aparece sin búsqueda (al explorar).
    const agregar = term ? '' : `
          <div style="padding:12px 8px 4px">
            <button class="btn ghost btn-agregar-doc" data-tipo="${cat.tipos[0]}" style="width:100%;text-align:center">+ Agregar a ${esc(cat.titulo)}</button>
          </div>`;

    return `
      <div class="panel">
        <div class="panel-h">
          <h2>${cat.icono} ${cat.titulo}</h2>
          <span class="cnt">${propios.length}</span>
        </div>
        <div class="panel-b">${cuerpo}${agregar}</div>
      </div>`;
  }).join('');

  if (term && !tarjetas) {
    return `<div class="state">Sin resultados para “${esc(filtro)}”.</div>`;
  }
  return tarjetas;
}

// Apartado de EVALUACIONES PROFESIONALES dentro de la historia clínica.
// Lista las evaluaciones que los profesionales cargaron al atender al
// paciente (una por profesional/día), de la más reciente a la más vieja.
// La lista es solo lectura; la carga se hace con "+ Nueva evaluación de
// hoy" (renderFormEvaluacion), disponible tras atender al paciente.
export function renderEvaluacionesHistoria(evaluaciones = []) {
  // Cada informe guarda su contenido como JSON; se parsea para mostrar.
  // Se descartan los que quedaron totalmente vacíos.
  const conTexto = evaluaciones
    .map(ev => ({ ev, inf: parseEvaluacion(ev.contenido) }))
    .filter(x => !evaluacionVacia(x.inf));

  const cuerpo = conTexto.length
    ? conTexto.map(({ ev, inf }) => {
        const prof = ev.profesionales?.nombre_completo || 'Profesional';
        const profesion = ev.profesionales?.profesion ? ' · ' + esc(ev.profesionales.profesion) : '';
        // Se listan las secciones con contenido. El cuerpo (desarrollo) va
        // sin subtítulo; objetivos/indicaciones (informes viejos) con etiqueta.
        const secciones = SECCIONES_INFORME
          .filter(s => (inf[s.key] || '').trim())
          .map(s => `
            <div style="margin-top:8px">
              ${s.key === 'cuerpo' ? '' : `<span style="display:block;font-size:13px;font-weight:600;color:var(--teal-700)">${esc(s.label)}</span>`}
              <span style="display:block;color:var(--ink);font-weight:400;white-space:pre-wrap">${esc(inf[s.key])}</span>
            </div>`).join('');
        return `
        <div class="docrow" style="align-items:flex-start">
          <div class="di">📝</div>
          <b style="flex:1">${esc(inf.titulo || 'Informe')}
            <small>${esc(prof)}${profesion} · ${formatearFecha(ev.fecha)}</small>
            ${secciones}
          </b>
          <button class="btn ghost btn-eval-pdf" data-eval-id="${esc(String(ev.id))}" style="padding:6px 10px">⤓ PDF</button>
          <button class="btn ghost btn-eval-ver" data-eval-id="${esc(String(ev.id))}" style="padding:6px 12px">Ver</button>
        </div>`;
      }).join('')
    : `<div class="state" style="padding:18px">Todavía no hay informes. Se cargan con <b>+ Nuevo informe de hoy</b> después de atender al paciente.</div>`;

  return `
    <div class="panel" style="margin-bottom:18px">
      <div class="panel-h">
        <h2>📝 Informes profesionales</h2>
        <span class="cnt">${conTexto.length}</span>
      </div>
      <div class="panel-b">
        ${cuerpo}
        <div style="padding:12px 8px 4px">
          <button class="btn btn-nueva-eval" style="width:100%;text-align:center">+ Nuevo informe de hoy</button>
        </div>
      </div>
    </div>`;
}

// Cabecera de la HOJA (membrete + datos del paciente), compartida por el
// editor y la previsualización. Devuelve el HTML del encabezado del documento.
function hojaCabecera(paciente = {}) {
  const dato = (label, valor) => `<div><b>${label}</b> ${esc(valor || '—')}</div>`;
  return `
      <div class="hoja-band"></div>
      <img class="hoja-logo" src="${CLINICA.logo}" alt="" onerror="this.remove()">
      <div class="hoja-emp">${esc(CLINICA.nombre.toUpperCase())} <span>${esc(CLINICA.subtitulo.toUpperCase())}</span></div>
      <div class="hoja-contacto">
        <div>DIREC: ${esc(CLINICA.direccion)}<br>CUIT: ${esc(CLINICA.cuit)}</div>
        <div>CEL: ${esc(CLINICA.cel)}<br>RES: ${esc(CLINICA.resolucion)}</div>
      </div>
      <hr class="hoja-sep">
      <div class="hoja-datos">
        ${dato('PACIENTE:', paciente.nombre_completo)}
        ${dato('FECHA DE NACIMIENTO:', paciente.fecha_nacimiento ? formatearFecha(paciente.fecha_nacimiento) : '')}
        ${dato('DNI:', paciente.dni)}
        ${dato('DX:', paciente.diagnostico)}
        ${dato('OBRA SOCIAL:', paciente.obra_social)}
        ${dato('AFIL:', paciente.numero_afiliado)}
      </div>`;
}

// Editor tipo HOJA para cargar el INFORME de HOY desde la ficha del paciente.
// En vez de campos sueltos, se escribe sobre un documento que replica el
// membrete del PDF (banda + logo + datos del paciente + título + cuerpo). El
// profesional se elige de los que lo ATENDIERON hoy (turno 'atendido'): eso
// une el gate ("ya atendió") con el autor provisional (en Etapa 2 = login).
// El cuerpo grande es el desarrollo del informe (se guarda en `cuerpo`).
// paciente: objeto completo (datos del membrete).
// turnos: [{ id, profesional_id, hora, profesionales:{nombre_completo, profesion} }]
// datosPorProf: { profesional_id: {tipo, titulo, cuerpo, …} } para prellenar.
export function renderFormEvaluacion(paciente = {}, turnos = [], datosPorProf = {}) {
  const opciones = turnos.map(t => {
    const p = t.profesionales || {};
    // Sin turno.id: es un paciente de la GRILLA (atendido hoy sin turno,
    // ver autoresElegiblesHoy). data-turno vacío, no "null" como texto.
    const et = `${p.nombre_completo || 'Profesional'}${p.profesion ? ' — ' + p.profesion : ''}${t.hora ? ' · ' + String(t.hora).slice(0, 5) : ''}`;
    return `<option value="${t.profesional_id}" data-turno="${t.id ? esc(String(t.id)) : ''}">${esc(et)}</option>`;
  }).join('');

  const primero = turnos[0] ? String(turnos[0].profesional_id) : '';
  const inf = datosPorProf[primero] || { tipo: 'mensual', titulo: TIPOS_INFORME[0].titulo, cuerpo: '' };

  const opcTipo = TIPOS_INFORME.map(t =>
    `<option value="${t.key}" ${t.key === inf.tipo ? 'selected' : ''}>${esc(t.titulo)}</option>`).join('');

  return `
    <div class="overlay" id="overlay-eval">
      <div class="modal" style="max-width:840px;width:96%">
        <div class="modal-h"><h2>Nuevo informe</h2><button class="x" data-cerrar>×</button></div>
        <form id="form-eval">
          <div class="modal-b">
            <!-- Barra de metadatos (no es parte de la hoja) -->
            <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
              <div class="form-field" style="flex:1;min-width:220px"><label>Profesional (atendió hoy) *</label>
                <select id="eval-prof" required>${opciones}</select></div>
              <div class="form-field" style="width:230px"><label>Tipo de informe</label>
                <select id="eval-tipo">${opcTipo}</select></div>
            </div>

            <!-- HOJA: se escribe directamente sobre el documento -->
            <div class="hoja-informe">
              ${hojaCabecera(paciente)}
              <div class="hoja-titulo-wrap"><input id="eval-titulo" class="hoja-titulo" value="${esc(inf.titulo || '')}" placeholder="TÍTULO DEL INFORME"></div>
              <textarea id="eval-cuerpo" class="hoja-cuerpo" placeholder="Escribí acá el informe…">${esc(inf.cuerpo || '')}</textarea>
              <div class="hoja-firma"><span>__________________<br>Firma</span><span>__________________<br>Aclaración y sello</span></div>
            </div>
            <p style="margin:12px 4px 0;color:var(--ink-soft);font-size:13px">Al guardar se genera el PDF con el membrete y se adjunta a la historia clínica.</p>
          </div>
          <div class="modal-f">
            <button type="button" class="btn ghost" data-cerrar>Cancelar</button>
            <button type="submit" class="btn" id="btn-guardar-eval">Guardar y generar PDF</button>
          </div>
        </form>
      </div>
    </div>`;
}

// PREVISUALIZACIÓN (solo lectura) de un informe ya guardado, con la misma
// hoja del editor. Sirve para leer informes anteriores sin descargarlos.
// `editable=true` (solo el informe de HOY) habilita el botón Editar para
// corregir un error del mismo día; los de días pasados quedan solo lectura.
// ev: la fila de evaluaciones (con profesionales embebido). inf: parseado.
export function renderVistaEvaluacion(paciente = {}, ev = {}, inf = {}, editable = false) {
  const prof = ev.profesionales?.nombre_completo || 'Profesional';
  const acl = [prof, ev.profesionales?.matricula ? 'Mat. ' + ev.profesionales.matricula : null]
    .filter(Boolean).join(' · ');

  return `
    <div class="overlay" id="overlay-vista-eval">
      <div class="modal" style="max-width:840px;width:96%">
        <div class="modal-h">
          <h2>Informe · ${formatearFecha(ev.fecha)}</h2>
          <button class="x" data-cerrar>×</button>
        </div>
        <div class="modal-b">
          <div class="hoja-informe">
            ${hojaCabecera(paciente)}
            <div class="hoja-titulo-wrap"><div class="hoja-titulo" style="border-bottom:none">${esc(inf.titulo || 'INFORME')}</div></div>
            <div class="hoja-cuerpo" style="white-space:pre-wrap">${esc(inf.cuerpo || '—')}</div>
            <div class="hoja-firma"><span>__________________<br>Firma</span><span>__________________<br>${esc(acl || 'Aclaración y sello')}</span></div>
          </div>
        </div>
        <div class="modal-f">
          <button type="button" class="btn ghost" data-cerrar>Cerrar</button>
          ${editable ? `<button type="button" class="btn ghost" id="btn-vista-editar" data-eval-id="${esc(String(ev.id))}">Editar (informe de hoy)</button>` : ''}
          <button type="button" class="btn" id="btn-vista-pdf" data-eval-id="${esc(String(ev.id))}">⤓ Descargar PDF</button>
        </div>
      </div>
    </div>`;
}

// Historia clínica: buscador + evaluaciones profesionales + documentos.
export function renderHistoria(paciente, evaluaciones = []) {
  const docs = paciente.documentos || [];

  return `
    <button class="back" id="btn-volver">‹ Volver al listado</button>
    <div class="legajo-top">
      <div class="bigav">${esc(iniciales(paciente.nombre_completo))}</div>
      <div style="flex:1">
        <h2>${esc(paciente.nombre_completo)}</h2>
        <div class="meta">Historia clínica · DNI ${esc(paciente.dni || '—')}</div>
      </div>
      <button class="btn ghost" id="btn-ver-legajo">Ver legajo</button>
    </div>

    <div style="margin-bottom:18px">
      <input id="hist-buscar" type="search" autocomplete="off"
        placeholder="🔎 Buscar en la historia clínica… (tipo, número, fecha, nota)"
        style="width:100%;font-family:var(--body);font-size:15.5px;padding:12px 14px;border:1px solid var(--line);border-radius:11px;background:var(--card);box-shadow:var(--shadow)">
    </div>

    <!-- Evaluaciones cargadas por los profesionales al atender -->
    ${renderEvaluacionesHistoria(evaluaciones)}

    <!-- Documentos por categoría (se re-renderiza al buscar) -->
    <div class="legajo-grid" id="hist-cats">${renderCategorias(docs)}</div>`;
}

// Formulario (modal) de alta/edición de paciente.
// Si recibe un paciente con id, es edición; si no, es alta.
export function renderFormPaciente(paciente = {}) {
  const v = (k) => esc(paciente[k] ?? '');
  const esEdicion = !!paciente.id;
  const tieneCud = paciente.tiene_cud === true;

  return `
    <div class="overlay" id="overlay-pac">
      <div class="modal">
        <div class="modal-h">
          <h2>${esEdicion ? 'Editar paciente' : 'Nuevo paciente'}</h2>
          <button class="x" data-cerrar>×</button>
        </div>
        <form id="form-pac">
          <div class="modal-b">
            <div class="form-grid">
              <div class="form-field full"><label>Nombre completo *</label><input name="nombre_completo" required value="${v('nombre_completo')}"></div>
              <div class="form-field"><label>DNI *</label><input name="dni" required value="${v('dni')}" placeholder="Identificador del paciente"></div>
              <div class="form-field"><label>Fecha de nacimiento</label><input type="date" name="fecha_nacimiento" value="${v('fecha_nacimiento')}"></div>
              <div class="form-field"><label>Teléfono</label><input name="telefono" value="${v('telefono')}"></div>
              <div class="form-field full"><label>Domicilio</label><input name="domicilio" value="${v('domicilio')}"></div>
              <div class="form-field"><label>Escuela <small style="color:var(--ink-faint);font-weight:400">(opcional)</small></label><input name="escuela" value="${v('escuela')}"></div>
              <div class="form-field"><label>Referente familiar</label><input name="referente_familiar" value="${v('referente_familiar')}"></div>
              <div class="form-field full"><label>Diagnóstico según CUD</label><input name="diagnostico" value="${v('diagnostico')}"></div>
              <div class="form-field"><label>¿Tiene CUD?</label>
                <select name="tiene_cud">
                  <option value="false" ${tieneCud ? '' : 'selected'}>No</option>
                  <option value="true" ${tieneCud ? 'selected' : ''}>Sí</option>
                </select>
              </div>
              <div class="form-field"><label>Obra social</label><input name="obra_social" value="${v('obra_social')}"></div>
              <div class="form-field"><label>N° de afiliado</label><input name="numero_afiliado" value="${v('numero_afiliado')}"></div>
              <div class="form-field"><label>Fecha de ingreso${esEdicion ? '' : ' *'}</label><input type="date" name="fecha_ingreso" ${esEdicion ? '' : 'required'} value="${v('fecha_ingreso')}"></div>
              <!-- El campo estado (activo/inactivo) NO se pide acá: es estado
                   interno del sistema. El paciente nace activo y solo cambia
                   con "Desactivar" / "Activar" desde el listado. -->
            </div>
          </div>
          <div class="modal-f">
            <button type="button" class="btn ghost" data-cerrar>Cancelar</button>
            <button type="submit" class="btn" id="btn-guardar-pac">${esEdicion ? 'Guardar cambios' : 'Crear paciente'}</button>
          </div>
        </form>
      </div>
    </div>`;
}

// Formulario (modal) para agregar un documento a la historia clínica.
// tipoDefault: tipo preseleccionado (lo manda la tarjeta de categoría).
export function renderFormDocumento(tipoDefault = 'cud') {
  const opciones = Object.entries(TIPOS_DOCUMENTO)
    .map(([valor, etiqueta]) =>
      `<option value="${valor}" ${valor === tipoDefault ? 'selected' : ''}>${etiqueta}</option>`)
    .join('');
  return `
    <div class="overlay" id="overlay-doc">
      <div class="modal" style="max-width:520px">
        <div class="modal-h"><h2>Agregar a la historia clínica</h2><button class="x" data-cerrar>×</button></div>
        <form id="form-doc">
          <div class="modal-b">
            <div class="form-grid">
              <div class="form-field full"><label>Tipo de documento *</label>
                <select name="tipo" required>${opciones}</select>
              </div>
              <div class="form-field full"><label>Número (si corresponde)</label><input name="numero" placeholder="N° de CUD, certificado…"></div>
              <div class="form-field"><label>Fecha de emisión</label><input type="date" name="fecha_emision"></div>
              <div class="form-field"><label>Fecha de vencimiento</label><input type="date" name="fecha_vencimiento"></div>
              <div class="form-field full"><label>Archivo — respaldo (PDF o imagen)</label><input type="file" name="archivo" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,image/*"><small style="color:var(--ink-faint)">Podés subir un PDF o una foto / imagen del documento.</small></div>
              <div class="form-field full"><label>Observaciones</label><textarea name="observaciones" placeholder="Notas para la historia clínica…"></textarea></div>
            </div>
          </div>
          <div class="modal-f">
            <button type="button" class="btn ghost" data-cerrar>Cancelar</button>
            <button type="submit" class="btn" id="btn-guardar-doc">Guardar</button>
          </div>
        </form>
      </div>
    </div>`;
}
