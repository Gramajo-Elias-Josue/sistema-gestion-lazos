// =====================================================================
// UTILIDAD: Documentos PDF de la clínica (jsPDF + autotable)
// ---------------------------------------------------------------------
// Todos llevan el MISMO membrete institucional y zona de firma y sello:
//   - generarInformeEvaluacion: informes (mensual, anual, …) y la
//     evaluación / certificado ocasional.
//   - generarPlanillaAsistencia: planilla mensual de asistencia de un
//     paciente o un profesional.
// Se importa de forma dinámica (import()) desde los controladores: jsPDF
// pesa, así que solo se descarga cuando alguien genera un PDF.
// =====================================================================

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fechaLarga, formatearFecha } from './fechas.js';
import { SECCIONES_INFORME } from './evaluacion.js';
import { DIAS_SEMANA, ESTADOS_CALENDARIO, etiquetaMes, diasConHorario, origenFichaje, tieneSegundoTramo, textoTurnoDia } from './calendario.js';
import { CLINICA } from '../config/clinica.js';

// Carga el logo institucional como dataURL (base64) para incrustarlo en el
// PDF. Se cachea entre informes. Si el archivo no existe (public/logo-...),
// devuelve '' y el informe se arma sin logo. Devuelve también el tipo para
// jsPDF ('PNG' | 'JPEG').
let _logoCache;
async function cargarLogo() {
  if (_logoCache !== undefined) return _logoCache;
  try {
    const resp = await fetch(CLINICA.logo);
    if (!resp.ok) throw new Error('logo no encontrado');
    const blob = await resp.blob();
    const dataUrl = await new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = rej;
      fr.readAsDataURL(blob);
    });
    const formato = blob.type.includes('jpeg') || blob.type.includes('jpg') ? 'JPEG' : 'PNG';
    _logoCache = { dataUrl, formato };
  } catch {
    _logoCache = null;
  }
  return _logoCache;
}

// Fuente Comic Sans MS para el título del membrete. No es una fuente nativa
// de jsPDF, así que se EMBEBE el .ttf (copiado a public/). Se baja una vez y
// se cachea en base64; luego se registra en cada documento con sus 4 estilos.
// Si no se puede cargar, se usa la fuente por defecto.
let _fuentesCache;
async function _ttfBase64(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('fuente no encontrada: ' + url);
  const bytes = new Uint8Array(await resp.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
async function registrarComicSans(doc) {
  try {
    if (!_fuentesCache) {
      const [n, b, i, z] = await Promise.all([
        _ttfBase64('/comic.ttf'), _ttfBase64('/comicbd.ttf'),
        _ttfBase64('/comici.ttf'), _ttfBase64('/comicz.ttf'),
      ]);
      _fuentesCache = { n, b, i, z };
    }
    const F = _fuentesCache;
    doc.addFileToVFS('comic.ttf', F.n);   doc.addFont('comic.ttf', 'ComicSansMS', 'normal');
    doc.addFileToVFS('comicbd.ttf', F.b); doc.addFont('comicbd.ttf', 'ComicSansMS', 'bold');
    doc.addFileToVFS('comici.ttf', F.i);  doc.addFont('comici.ttf', 'ComicSansMS', 'italic');
    doc.addFileToVFS('comicz.ttf', F.z);  doc.addFont('comicz.ttf', 'ComicSansMS', 'bolditalic');
    return true;
  } catch (e) {
    console.warn('No se pudo cargar Comic Sans; se usa la fuente por defecto.', e);
    return false;
  }
}

// "HH:MM:SS" -> "HH:MM" (o '—').
function hhmm(t) { return t ? String(t).slice(0, 5) : '—'; }

// ---------------------------------------------------------------------
// MEMBRETE INSTITUCIONAL (compartido por los documentos de la clínica)
// ---------------------------------------------------------------------
// Réplica del membrete en papel: banda diagonal con degradé naranja →
// celeste, logo circular a la derecha, nombre del centro en Comic Sans y
// los datos de contacto debajo. Devuelve la coordenada Y donde puede
// empezar el contenido del documento.
//
// Es ASYNC porque el logo y la fuente se cargan por fetch (y se cachean).
async function dibujarMembrete(doc, { W, margin, contentW }) {
  // Banda decorativa: rectángulo partido de esquina a esquina por una
  // diagonal; el TRIÁNGULO SUPERIOR lleva el degradé y la diagonal una
  // línea blanca. jsPDF no tiene degradé nativo: se simula con franjas
  // verticales finas, cada una con un color interpolado y una altura
  // recortada a la diagonal.
  const hbIzq = 62, hbDer = 0;            // alto de la banda: izquierda / esquina derecha
  const NAR = [238, 118, 35], CEL = [123, 203, 240];
  const lerp = (a, b, t) => Math.round(a + (b - a) * t);
  const altoEn = (t) => hbIzq + (hbDer - hbIzq) * t; // diagonal (0,hbIzq)→(W,hbDer)
  const paso = 1;                          // ancho de cada franja (pt): 1 = diagonal bien limpia
  for (let x = 0; x < W; x += paso) {
    const t = x / W;
    const alto = altoEn(t);
    if (alto <= 0) continue;               // en la esquina derecha el color se va a cero
    doc.setFillColor(lerp(NAR[0], CEL[0], t), lerp(NAR[1], CEL[1], t), lerp(NAR[2], CEL[2], t));
    doc.rect(x, 0, paso + 0.6, alto, 'F'); // franja recortada a la diagonal
  }
  doc.setDrawColor(255, 255, 255);         // borde BLANCO sobre la diagonal
  doc.setLineWidth(2.5); doc.line(0, hbIzq, W, hbDer);

  // Logo circular, arriba a la derecha, sobre la banda.
  const logo = await cargarLogo();
  if (logo) {
    try { doc.addImage(logo.dataUrl, logo.formato, W - margin - 84, -4, 84, 84); }
    catch { /* si el formato del logo falla, sigue sin él */ }
  }

  // Nombre + subtítulo SOBRE la banda, en NEGRO y centrados en la zona
  // libre (entre el margen y el logo). Título en Comic Sans MS (embebida);
  // si no se puede cargar, times.
  const ff = (await registrarComicSans(doc)) ? 'ComicSansMS' : 'times';
  const nombre = CLINICA.nombre.toUpperCase();
  const sub = CLINICA.subtitulo.toUpperCase();
  const gap = 9;
  doc.setFont(ff, 'bolditalic'); doc.setFontSize(22);
  const wNombre = doc.getTextWidth(nombre);
  doc.setFont(ff, 'italic'); doc.setFontSize(13.5);
  const wSub = doc.getTextWidth(sub);
  const zonaDer = W - 96;                 // reservado para el logo a la derecha
  const totalW = wNombre + gap + wSub;
  const xIni = Math.max(margin, margin + (zonaDer - margin - totalW) / 2);
  const yTit = 40;                        // baseline: alineado (centrado) con el logo
  doc.setTextColor(0, 0, 0);
  doc.setFont(ff, 'bolditalic'); doc.setFontSize(22);
  doc.text(nombre, xIni, yTit);
  doc.setFont(ff, 'italic'); doc.setFontSize(13.5);
  doc.text(sub, xIni + wNombre + gap, yTit);

  // Datos de contacto DEBAJO de la banda.
  let y = hbIzq + 16;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(60);
  doc.text(`DIREC: ${CLINICA.direccion}`, margin, y);
  doc.text(`CUIT: ${CLINICA.cuit}`, margin, y + 14);
  doc.text(`CEL: ${CLINICA.cel}`, margin + contentW * 0.55, y);
  doc.text(`RES: ${CLINICA.resolucion}`, margin + contentW * 0.55, y + 14);

  y += 30;
  doc.setDrawColor(180); doc.setLineWidth(1); doc.line(margin, y, W - margin, y);
  return y + 26;
}

// Firma y sello al pie del documento, con la aclaración de quien firma.
// Devuelve la Y usada (por si hace falta seguir escribiendo).
function dibujarFirma(doc, { W, H, margin, y, aclaracion = '' }) {
  let yf = y;
  if (yf > H - 90) { doc.addPage(); yf = 130; }
  const colW = (W - margin * 2 - 50) / 2;
  doc.setDrawColor(120); doc.setLineWidth(0.5);
  doc.line(margin, yf, margin + colW, yf);
  doc.line(margin + colW + 50, yf, W - margin, yf);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90);
  doc.text('Firma', margin, yf + 14);
  doc.text(aclaracion || 'Aclaración y sello', margin + colW + 50, yf + 14);
  return yf;
}

// =====================================================================
// Informe profesional (plantilla igual a la que usa la clínica)
// ---------------------------------------------------------------------
// Replica el informe en papel de Lazos: membrete institucional (logo +
// dirección/CUIT/CEL/RES), bloque de datos del paciente con etiquetas
// subrayadas (PACIENTE, FECHA DE NACIMIENTO, DNI, DX, OBRA SOCIAL, AFIL),
// título centrado según el tipo (INFORME MENSUAL, etc.), y el cuerpo con
// las secciones que cargó el profesional. Cierra con firma / sello.
// Es ASYNC porque puede incrustar el logo (se carga por fetch).
// Datos:
//   paciente:    { nombre_completo, fecha_nacimiento, dni, diagnostico, obra_social, numero_afiliado }
//   profesional: { nombre_completo, profesion, especialidad, matricula }
//   fecha:       'yyyy-mm-dd'
//   informe:     { tipo, titulo, objetivos, cuerpo, indicaciones }
// Devuelve { blob, filename }.
export async function generarInformeEvaluacion({ paciente = {}, profesional = {}, fecha, informe = {} }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = W - margin * 2;
  let y = margin;

  // Salta de página si no entran `alto` puntos antes del pie.
  const asegurar = (alto) => { if (y + alto > H - 70) { doc.addPage(); y = margin; } };

  // --- Membrete institucional (banda diagonal + logo + datos) ---
  y = await dibujarMembrete(doc, { W, margin, contentW });

  // --- Datos del paciente (etiqueta en negrita + subrayado, como el papel) ---
  const campo = (label, value) => {
    asegurar(22);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(0);
    doc.text(label, margin, y);
    const lw = doc.getTextWidth(label);
    doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(margin, y + 2, margin + lw, y + 2);
    doc.setFont('helvetica', 'normal');
    doc.text(' ' + (value || '—'), margin + lw + 2, y);
    y += 20;
  };
  campo('PACIENTE:', paciente.nombre_completo);
  campo('FECHA DE NACIMIENTO:', paciente.fecha_nacimiento ? formatearFecha(paciente.fecha_nacimiento) : '—');
  campo('DNI:', paciente.dni);
  campo('DX:', paciente.diagnostico);
  campo('OBRA SOCIAL:', paciente.obra_social);
  campo('AFIL:', paciente.numero_afiliado);

  // --- Título del informe (centrado + subrayado) ---
  y += 14;
  asegurar(34);
  const titulo = (informe.titulo || 'INFORME').toUpperCase();
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(0);
  doc.text(titulo, W / 2, y, { align: 'center' });
  const tw = doc.getTextWidth(titulo);
  doc.setLineWidth(0.6); doc.line(W / 2 - tw / 2, y + 3, W / 2 + tw / 2, y + 3);
  y += 28;

  // --- Cuerpo ---
  // Imprime párrafos (separa por saltos de línea), sangrando la 1ª línea.
  const parrafos = (texto) => {
    String(texto || '').split(/\n+/).map(p => p.trim()).filter(Boolean).forEach(par => {
      doc.splitTextToSize(par, contentW - 14).forEach((ln, i) => {
        asegurar(16);
        doc.text(ln, margin + (i === 0 ? 14 : 0), y); y += 15;
      });
      y += 6;
    });
  };
  // Sección opcional (con subtítulo) — solo si tiene contenido.
  const seccionOpcional = (label, texto) => {
    if (!(texto || '').trim()) return;
    asegurar(30);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(23, 119, 179);
    doc.text(label, margin, y); y += 16;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(20);
    parrafos(texto);
    y += 4;
  };

  const etq = (k) => { const s = SECCIONES_INFORME.find(x => x.key === k); return s ? s.label : k; };
  seccionOpcional(etq('objetivos'), informe.objetivos);
  // Cuerpo principal (narrativa), sin subtítulo, como el informe en papel.
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(20);
  parrafos(informe.cuerpo);
  seccionOpcional(etq('indicaciones'), informe.indicaciones);

  // --- Firma y sello (con aclaración del profesional) ---
  const acl = [profesional.nombre_completo, profesional.matricula ? 'Mat. ' + profesional.matricula : null]
    .filter(Boolean).join(' · ');
  dibujarFirma(doc, { W, H, margin, y: y + 46, aclaracion: acl });

  // --- Pie ---
  doc.setFontSize(8); doc.setTextColor(150);
  doc.text(`Generado por el sistema de gestión ${CLINICA.nombre} · ${fechaLarga(fecha)}`, margin, H - 24);

  const slug = (paciente.nombre_completo || 'paciente').replace(/[^\w]+/g, '_').replace(/^_|_$/g, '');
  const filename = `${informe.tipo === 'certificado' ? 'certificado' : 'informe'}-${slug}-${fecha}.pdf`;
  doc.save(filename);              // descarga inmediata para el profesional
  const blob = doc.output('blob'); // mismo PDF, para adjuntar a la historia
  return { blob, filename };
}

// =====================================================================
// Planilla mensual de asistencia (paciente o profesional)
// ---------------------------------------------------------------------
// Lleva el MISMO membrete que los informes de la clínica y reproduce en
// papel el calendario que se ve en pantalla: verde los días que asistió,
// rojo los que faltó, gris los fines de semana (la clínica no abre).
// Cierra con el resumen del mes, el detalle de las ausencias y la zona
// de firma y sello.
// Datos:
//   persona:    { nombre_completo, dni, ... }
//   tipo:       'paciente' | 'profesional'
//   subtitulo:  diagnóstico (paciente) o profesión y matrícula
//   calendario: lo que devuelve armarCalendario() de utils/calendario.js
// Devuelve { blob, filename }.
export async function generarPlanillaAsistencia({ persona = {}, tipo = 'paciente', subtitulo = '', calendario }) {
  const { anio, mes, semanas, dias, resumen } = calendario;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = W - margin * 2;

  // --- Membrete institucional (el mismo de los informes) ---
  let y = await dibujarMembrete(doc, { W, margin, contentW });

  // --- Datos de la persona (etiquetas subrayadas, como el papel) ---
  const campo = (label, value) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(0);
    doc.text(label, margin, y);
    const lw = doc.getTextWidth(label);
    doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(margin, y + 2, margin + lw, y + 2);
    doc.setFont('helvetica', 'normal');
    doc.text(' ' + (value || '—'), margin + lw + 2, y);
    y += 20;
  };
  campo(tipo === 'profesional' ? 'PROFESIONAL:' : 'PACIENTE:', persona.nombre_completo);
  campo(tipo === 'profesional' ? 'PROFESIÓN:' : 'DX:', subtitulo);
  if (persona.dni) campo('DNI:', persona.dni);
  campo('MES:', etiquetaMes(anio, mes));

  // --- Título centrado y subrayado ---
  y += 12;
  const titulo = 'PLANILLA DE ASISTENCIA';
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(0);
  doc.text(titulo, W / 2, y, { align: 'center' });
  const tw = doc.getTextWidth(titulo);
  doc.setLineWidth(0.6); doc.line(W / 2 - tw / 2, y + 3, W / 2 + tw / 2, y + 3);
  y += 26;

  // --- Calendario del mes ---
  const colW = contentW / 7;
  const filaH = 34;

  // Encabezado de días (lunes a domingo).
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(90);
  DIAS_SEMANA.forEach((d, i) => {
    doc.text(d, margin + colW * i + colW / 2, y, { align: 'center' });
  });
  y += 8;

  const GRIS_CERRADO = [232, 232, 232];  // fin de semana: la clínica no abre
  semanas.forEach(semana => {
    semana.forEach((dia, i) => {
      const x = margin + colW * i;
      if (!dia) return;                   // relleno del principio / final del mes

      const est = dia.estado ? ESTADOS_CALENDARIO[dia.estado] : null;
      let texto = [60, 60, 60];
      if (dia.finde) {
        doc.setFillColor(...GRIS_CERRADO);
        doc.rect(x, y, colW - 3, filaH - 3, 'F');
        texto = [130, 130, 130];
      } else if (est) {
        doc.setFillColor(...est.rgb);
        doc.rect(x, y, colW - 3, filaH - 3, 'F');
        texto = [255, 255, 255];          // número en blanco sobre el color
      } else {
        doc.setDrawColor(205); doc.setLineWidth(0.5);
        doc.rect(x, y, colW - 3, filaH - 3, 'S');
        texto = dia.futuro ? [185, 185, 185] : [110, 110, 110];
      }

      doc.setTextColor(...texto);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      doc.text(String(dia.dia), x + 6, y + 14);
      // El horario no va dentro del día: va en la tabla "Detalle de
      // horarios", más abajo (igual que en pantalla, donde se ve al tocarlo).
    });
    y += filaH;
  });

  // --- Referencia de colores ---
  y += 6;
  const refs = [
    ['Asistió', ESTADOS_CALENDARIO.presente.rgb],
    ['No asistió', ESTADOS_CALENDARIO.ausente.rgb],
    ['Con aviso / licencia', ESTADOS_CALENDARIO.ausente_con_aviso.rgb],
    ['Enfermedad', ESTADOS_CALENDARIO.enfermedad.rgb],
    ['Fin de semana (cerrado)', GRIS_CERRADO],
  ];
  let xr = margin;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(80);
  refs.forEach(([texto, rgb]) => {
    doc.setFillColor(...rgb);
    doc.rect(xr, y - 6, 9, 9, 'F');
    doc.text(texto, xr + 13, y + 1);
    xr += 13 + doc.getTextWidth(texto) + 14;
  });
  y += 22;

  // --- Resumen del mes ---
  autoTable(doc, {
    startY: y,
    head: [['Días hábiles', 'Presentes', 'Ausentes', 'Con aviso', 'Sin registro', '% asistencia']],
    body: [[resumen.habiles, resumen.presentes, resumen.ausentes, resumen.avisados, resumen.sinRegistro, `${resumen.pct}%`]],
    styles: { fontSize: 10, cellPadding: 6, halign: 'center', lineColor: [225, 225, 225], lineWidth: 0.5 },
    headStyles: { fillColor: [23, 119, 179], textColor: 255, fontStyle: 'bold' },
    margin: { left: margin, right: margin },
  });
  y = (doc.lastAutoTable?.finalY || y) + 22;

  // --- Detalle de horarios (fichaje del profesional, si hubo) ---
  const conHorario = tipo === 'profesional' ? diasConHorario(dias) : [];
  if (conHorario.length) {
    // Si algún día tiene la tarde aparte (doble turno), una columna por
    // turno ("08:00 a 12:00"); si no, entrada y salida como siempre.
    const dosTramos = conHorario.some(tieneSegundoTramo);
    autoTable(doc, {
      startY: y,
      head: [dosTramos ? ['Fecha', 'Mañana', 'Tarde', 'Cargada por'] : ['Fecha', 'Entrada', 'Salida', 'Cargada por']],
      body: conHorario.map(d => dosTramos
        ? [formatearFecha(d.iso), textoTurnoDia(d.entrada, d.salida, d.estado1), textoTurnoDia(d.entrada2, d.salida2, d.estado2), origenFichaje(d)]
        : [formatearFecha(d.iso), hhmm(d.entrada), hhmm(d.salida), origenFichaje(d)]),
      styles: { fontSize: 9.5, cellPadding: 5, lineColor: [225, 225, 225], lineWidth: 0.5 },
      headStyles: { fillColor: [23, 119, 179], textColor: 255, fontStyle: 'bold' },
      columnStyles: dosTramos
        ? { 0: { cellWidth: 90 }, 1: { cellWidth: 95, halign: 'center' }, 2: { cellWidth: 95, halign: 'center' }, 3: { cellWidth: 'auto' } }
        : { 0: { cellWidth: 90 }, 1: { cellWidth: 70, halign: 'center' }, 2: { cellWidth: 70, halign: 'center' }, 3: { cellWidth: 'auto' } },
      margin: { left: margin, right: margin },
    });
    y = (doc.lastAutoTable?.finalY || y) + 22;
  }

  // --- Detalle de ausencias (solo si hubo) ---
  const ausencias = dias.filter(d => d.estado && d.estado !== 'presente');
  if (ausencias.length) {
    autoTable(doc, {
      startY: y,
      head: [['Fecha', 'Situación', 'Observaciones']],
      body: ausencias.map(d => [
        formatearFecha(d.iso),
        ESTADOS_CALENDARIO[d.estado]?.etiqueta || d.estado,
        d.nota || '—',
      ]),
      styles: { fontSize: 9.5, cellPadding: 5, valign: 'top', lineColor: [225, 225, 225], lineWidth: 0.5 },
      headStyles: { fillColor: [23, 119, 179], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 120 }, 2: { cellWidth: 'auto' } },
      margin: { left: margin, right: margin },
    });
    y = (doc.lastAutoTable?.finalY || y) + 22;
  }

  // --- Firma y sello ---
  dibujarFirma(doc, { W, H, margin, y: y + 34, aclaracion: 'Aclaración y sello' });

  // --- Pie ---
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(150);
  doc.text(`Generado por el sistema de gestión ${CLINICA.nombre} · ${fechaLarga()}`, margin, H - 24);

  const slug = (persona.nombre_completo || tipo).replace(/[^\w]+/g, '_').replace(/^_|_$/g, '');
  const filename = `asistencia-${slug}-${anio}-${String(mes).padStart(2, '0')}.pdf`;
  doc.save(filename);
  const blob = doc.output('blob');
  return { blob, filename };
}
