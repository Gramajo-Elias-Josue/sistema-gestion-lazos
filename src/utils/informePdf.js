// =====================================================================
// UTILIDAD: Informe diario en PDF (plantilla reutilizable)
// ---------------------------------------------------------------------
// Genera el informe diario de UN profesional con jsPDF + autotable y lo
// descarga. La plantilla es la misma para cualquier profesional: cambia
// solo el contenido (encabezado institucional, datos del profesional,
// horario de entrada/salida, tabla paciente→evaluación y zona de firma y
// sello para imprimir y rubricar).
// =====================================================================

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fechaLarga, formatearFecha } from './fechas.js';
import { SECCIONES_INFORME } from './evaluacion.js';
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

// Datos:
//   profesional: { nombre_completo, profesion, especialidad, matricula }
//   fecha: 'yyyy-mm-dd'
//   evaluaciones: [{ paciente, contenido }]
//   fichaje: { hora_entrada, hora_salida } | null
export function generarInformeDiario({ profesional = {}, fecha, evaluaciones = [], fichaje = null }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = margin;

  // --- Encabezado institucional ---
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
  doc.text('Lazos', margin, y + 4);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(90);
  doc.text('Centro de Rehabilitación Integral · Aguilares, Tucumán', margin, y + 20);

  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(0);
  doc.text('Informe diario', W - margin, y + 2, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(90);
  doc.text(fechaLarga(fecha), W - margin, y + 20, { align: 'right' });

  y += 38;
  doc.setDrawColor(200); doc.line(margin, y, W - margin, y); y += 22;

  // --- Datos del profesional + fichaje ---
  doc.setTextColor(0); doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
  doc.text(profesional.nombre_completo || 'Profesional', margin, y);
  const sub = [profesional.profesion, profesional.especialidad, profesional.matricula ? 'Mat. ' + profesional.matricula : null]
    .filter(Boolean).join('  ·  ');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(70);
  if (sub) doc.text(sub, margin, y + 15);

  doc.setTextColor(0); doc.setFontSize(10);
  doc.text(`Entrada: ${hhmm(fichaje?.hora_entrada)}     Salida: ${hhmm(fichaje?.hora_salida)}`, W - margin, y, { align: 'right' });
  y += 32;

  // --- Tabla de evaluaciones ---
  autoTable(doc, {
    startY: y,
    head: [['Paciente', 'Evaluación del día']],
    body: evaluaciones.length
      ? evaluaciones.map(e => [e.paciente || '—', e.contenido || '—'])
      : [['—', 'Sin evaluaciones cargadas para esta fecha.']],
    styles: { fontSize: 10, cellPadding: 6, valign: 'top', lineColor: [225, 225, 225], lineWidth: 0.5 },
    headStyles: { fillColor: [23, 119, 179], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 150 }, 1: { cellWidth: 'auto' } },
    margin: { left: margin, right: margin },
  });

  // --- Firma y sello ---
  let yf = (doc.lastAutoTable?.finalY || y) + 70;
  if (yf > H - 90) { doc.addPage(); yf = 130; }
  const colW = (W - margin * 2 - 50) / 2;
  doc.setDrawColor(120);
  doc.line(margin, yf, margin + colW, yf);
  doc.line(margin + colW + 50, yf, W - margin, yf);
  doc.setFontSize(9); doc.setTextColor(90);
  doc.text('Firma', margin, yf + 14);
  doc.text('Aclaración y sello', margin + colW + 50, yf + 14);

  // --- Pie ---
  doc.setFontSize(8); doc.setTextColor(150);
  doc.text('Generado por el sistema de gestión Lazos', margin, H - 24);

  const slug = (profesional.nombre_completo || 'profesional').replace(/[^\w]+/g, '_').replace(/^_|_$/g, '');
  doc.save(`informe-${slug}-${fecha}.pdf`);
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
  // Banda decorativa: rectángulo partido de esquina a esquina por una
  // diagonal; el TRIÁNGULO SUPERIOR se pinta con un DEGRADÉ horizontal
  // naranja (izq) → celeste (der), y la diagonal lleva una línea navy.
  // Debajo de la diagonal queda blanco (réplica del membrete en papel).
  // jsPDF no tiene degradé nativo: se simula con franjas verticales finas,
  // cada una con un color interpolado y una altura recortada a la diagonal.
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
  // libre (entre el margen y el logo).
  // Título del membrete en Comic Sans MS (embebida); si falla, times.
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
  y = hbIzq + 16;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(60);
  doc.text(`DIREC: ${CLINICA.direccion}`, margin, y);
  doc.text(`CUIT: ${CLINICA.cuit}`, margin, y + 14);
  doc.text(`CEL: ${CLINICA.cel}`, margin + contentW * 0.55, y);
  doc.text(`RES: ${CLINICA.resolucion}`, margin + contentW * 0.55, y + 14);

  y += 30;
  doc.setDrawColor(180); doc.setLineWidth(1); doc.line(margin, y, W - margin, y); y += 26;

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
  let yf = y + 46;
  if (yf > H - 90) { doc.addPage(); yf = 130; }
  const colW = (W - margin * 2 - 50) / 2;
  doc.setDrawColor(120); doc.setLineWidth(0.5);
  doc.line(margin, yf, margin + colW, yf);
  doc.line(margin + colW + 50, yf, W - margin, yf);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90);
  doc.text('Firma', margin, yf + 14);
  const acl = [profesional.nombre_completo, profesional.matricula ? 'Mat. ' + profesional.matricula : null]
    .filter(Boolean).join(' · ');
  doc.text(acl || 'Aclaración y sello', margin + colW + 50, yf + 14);

  // --- Pie ---
  doc.setFontSize(8); doc.setTextColor(150);
  doc.text(`Generado por el sistema de gestión ${CLINICA.nombre} · ${fechaLarga(fecha)}`, margin, H - 24);

  const slug = (paciente.nombre_completo || 'paciente').replace(/[^\w]+/g, '_').replace(/^_|_$/g, '');
  const filename = `informe-${slug}-${fecha}.pdf`;
  doc.save(filename);              // descarga inmediata para el profesional
  const blob = doc.output('blob'); // mismo PDF, para adjuntar a la historia
  return { blob, filename };
}
