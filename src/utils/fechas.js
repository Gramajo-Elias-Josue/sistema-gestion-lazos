// =====================================================================
// UTILIDADES: Fechas y vencimientos
// ---------------------------------------------------------------------
// Funciones puras y reutilizables. No tocan el DOM ni Supabase.
// Regla de vencimiento (estadoVencimiento): <0 días = vencido,
// <=30 = por vencer, resto = vigente.
// =====================================================================

// Convierte un Date a 'yyyy-mm-dd' en horario LOCAL. Se arma a mano para
// no pasar por toISOString(), que convierte a UTC y puede "saltar" de día.
function aISO(d) {
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

// Diferencia en días entre una fecha y hoy. Negativo = ya pasó.
// Devuelve null si no hay fecha.
export function diasHasta(fechaStr) {
  if (!fechaStr) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const objetivo = new Date(fechaStr);
  objetivo.setHours(0, 0, 0, 0);
  return Math.round((objetivo - hoy) / 86400000);
}

// Parsea una fecha 'yyyy-mm-dd' como fecha LOCAL (no UTC), para que no se
// corra un día por la zona horaria (Argentina es UTC-3). Si el string ya
// trae hora, se respeta tal cual.
function parseFechaLocal(fechaStr) {
  return /^\d{4}-\d{2}-\d{2}$/.test(fechaStr) ? new Date(fechaStr + 'T00:00:00') : new Date(fechaStr);
}

// Formatea una fecha a dd/mm/aaaa (formato argentino). '—' si está vacía.
export function formatearFecha(fechaStr) {
  if (!fechaStr) return '—';
  return parseFechaLocal(fechaStr).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

// Estado de vencimiento de un documento, devuelto como objeto:
//   { texto, clase, dias }
// donde 'clase' coincide con las clases CSS de los pills (ok/warn/bad).
export function estadoVencimiento(fechaStr) {
  if (!fechaStr) return { texto: 'Cargado', clase: 'ok', dias: null };
  const dias = diasHasta(fechaStr);
  if (dias < 0) return { texto: 'Vencido', clase: 'bad', dias };
  if (dias <= 30) return { texto: 'Por vencer', clase: 'warn', dias };
  return { texto: 'Vigente', clase: 'ok', dias };
}

// Edad en años cumplidos a partir de la fecha de nacimiento.
export function calcularEdad(fechaNac) {
  if (!fechaNac) return '—';
  const hoy = new Date();
  const nac = parseFechaLocal(fechaNac);
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad;
}

// Iniciales (máximo 2) de un nombre, en mayúsculas. Ej: "Tomás Gauna" -> "TG".
export function iniciales(nombre) {
  if (!nombre) return '';
  return nombre.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

// Fecha de hoy en formato ISO local (yyyy-mm-dd), apta para <input type="date">
// y para las consultas a Supabase.
export function hoyISO() {
  return aISO(new Date());
}

// Suma (o resta, con negativos) días a una fecha ISO y devuelve otra ISO.
// Se usa para navegar entre días en el registro de asistencia.
export function sumarDias(fechaStr, dias) {
  const d = new Date(fechaStr + 'T00:00:00');
  d.setDate(d.getDate() + dias);
  return aISO(d);
}

// Primer y último día del mes de una fecha dada, como { desde, hasta }.
// El "día 0" del mes siguiente equivale al último día del mes actual.
export function rangoMes(fechaStr) {
  const d = new Date(fechaStr + 'T00:00:00');
  return {
    desde: aISO(new Date(d.getFullYear(), d.getMonth(), 1)),
    hasta: aISO(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
  };
}

// Nombre del día de la semana de una fecha ISO. Ej: "Miércoles".
export function nombreDia(fechaStr) {
  const d = new Date(fechaStr + 'T00:00:00');
  const texto = d.toLocaleDateString('es-AR', { weekday: 'long' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// ¿La hora 'HH:MM' cae dentro del rango [desde, hasta]? Compara texto
// 'HH:MM' (su orden alfabético coincide con el cronológico). Si falta
// algún dato devuelve true (no restringe).
export function horaEnRango(hora, desde, hasta) {
  if (!hora || !desde || !hasta) return true;
  const h = String(hora).slice(0, 5);
  return h >= String(desde).slice(0, 5) && h <= String(hasta).slice(0, 5);
}

// Convierte 'HH:MM' (o 'HH:MM:SS') a minutos desde medianoche.
// Devuelve null si no hay hora. Sirve para comparar horas con tolerancia.
export function horaAMinutos(hora) {
  if (!hora) return null;
  const [h, m] = String(hora).slice(0, 5).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

// Hora actual local como 'HH:MM' (para validar contra el reloj).
export function ahoraHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Fecha larga y legible con la primera letra en mayúscula.
// Ej: "Miércoles 3 de junio de 2026". Sin argumento, usa hoy.
export function fechaLarga(fechaStr) {
  const d = fechaStr ? new Date(fechaStr + 'T00:00:00') : new Date();
  const texto = d.toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
