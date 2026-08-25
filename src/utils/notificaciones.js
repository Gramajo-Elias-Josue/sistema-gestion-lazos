// =====================================================================
// UTILIDADES: Notificaciones globales (campana del encabezado)
// ---------------------------------------------------------------------
// Funciones PURAS (sin DOM ni Supabase). Combina lo que sí requiere
// atención (informes/fotos pendientes del mes, via utils/periodos.js)
// con lo que es solo un aviso menor (cumpleaños próximos). Se calcula de
// nuevo en cada login (no se guarda ni se marca como "visto").
// =====================================================================

import { hoyISO } from './fechas.js';

// Ventana por defecto: avisa desde 7 días antes hasta el mismo día.
export const DIAS_AVISO_CUMPLEANOS = 7;

// Informes/fotos pendientes: recién molestan en la campana durante los
// últimos 5 días del mes (antes, todavía hay tiempo de sobra y solo
// generan ruido). El detalle completo sigue disponible todo el mes en el
// panel "Entregas del mes" de Inicio; esto es solo el aviso rápido.
export const DIAS_AVISO_ENTREGAS = 5;

// Días que faltan para el próximo cumpleaños de una fecha de nacimiento
// ('yyyy-mm-dd'), contando desde `hoy`. 0 = es hoy. Si ya pasó este año,
// cuenta hasta el del año que viene. Devuelve también la edad que cumple.
// null si no hay fecha cargada.
export function proximoCumpleanos(fechaNacimiento, hoy = hoyISO()) {
  if (!fechaNacimiento) return null;

  const [anioNac, mesNac, diaNac] = String(fechaNacimiento).split('-').map(Number);
  const [anioHoy, mesHoy, diaHoy] = String(hoy).split('-').map(Number);
  if (!anioNac || !mesNac || !diaNac) return null;

  const fechaHoy = new Date(anioHoy, mesHoy - 1, diaHoy);
  let candidata = new Date(anioHoy, mesNac - 1, diaNac);
  if (candidata < fechaHoy) candidata = new Date(anioHoy + 1, mesNac - 1, diaNac);

  const faltan = Math.round((candidata - fechaHoy) / 86400000);
  const edad = candidata.getFullYear() - anioNac;
  return { faltan, edad };
}

// Cumpleaños de una lista de personas dentro de los próximos `dias`
// (incluye hoy). `campo` es el nombre del campo con la fecha de
// nacimiento (pacientes y profesionales usan el mismo: fecha_nacimiento).
// Devuelve la lista ordenada por cercanía (hoy primero).
export function cumpleañosProximos(personas = [], { campo = 'fecha_nacimiento', hoy = hoyISO(), dias = DIAS_AVISO_CUMPLEANOS } = {}) {
  return personas
    .map(persona => {
      const prox = proximoCumpleanos(persona[campo], hoy);
      return prox && { persona, faltan: prox.faltan, edad: prox.edad };
    })
    .filter(item => item && item.faltan <= dias)
    .sort((a, b) => a.faltan - b.faltan);
}

// Arma los cumpleaños próximos de pacientes y profesionales juntos, ya
// filtrados según lo que el perfil puede ver (un profesional que no
// entra a la sección Profesionales no tiene por qué recibir avisos de
// cumpleaños del equipo, por ejemplo).
export function notificacionesCumpleanos({ pacientes = [], profesionales = [], verPacientes = true, verProfesionales = true, hoy = hoyISO(), dias = DIAS_AVISO_CUMPLEANOS } = {}) {
  const dePacientes = verPacientes
    ? cumpleañosProximos(pacientes, { hoy, dias }).map(item => ({ ...item, tipo: 'paciente' }))
    : [];
  const deProfesionales = verProfesionales
    ? cumpleañosProximos(profesionales, { hoy, dias }).map(item => ({ ...item, tipo: 'profesional' }))
    : [];

  return [...dePacientes, ...deProfesionales].sort((a, b) => a.faltan - b.faltan);
}

// Texto de "cuándo" para un cumpleaños, según los días que faltan.
function etiquetaCuando(faltan) {
  if (faltan === 0) return 'Hoy';
  if (faltan === 1) return 'Mañana';
  return `En ${faltan} días`;
}

// Une informes/fotos pendientes (lo que SÍ requiere atención: alguien del
// equipo está atrasado) y cumpleaños próximos (aviso menor) en una sola
// lista, ya lista para pintar en la campana. Los pendientes van primero
// porque son más urgentes que un cumpleaños.
//   cumpleanos     -> lo que devuelve notificacionesCumpleanos()
//   pendientes     -> lo que devuelve pendientesDelMes() (utils/periodos.js):
//                     { informes: [profesional…], fotos: [profesional…] }
//   avisarEntregas -> false = todavía no está cerca de fin de mes: no
//                     molesta con los pendientes (ver DIAS_AVISO_ENTREGAS)
export function notificacionesGlobales({ cumpleanos = [], pendientes = { informes: [], fotos: [] }, avisarEntregas = true } = {}) {
  const deInformes = avisarEntregas ? pendientes.informes.map(p => ({
    tipo: 'informe', icono: '📄', color: 'red',
    titulo: p.nombre_completo, detalle: 'Debe el informe del mes',
  })) : [];
  const deFotos = avisarEntregas ? pendientes.fotos.map(p => ({
    tipo: 'foto', icono: '📷', color: 'amber',
    titulo: p.nombre_completo, detalle: 'No subió su foto del mes',
  })) : [];
  const deCumpleanos = cumpleanos.map(c => ({
    tipo: 'cumpleanos', icono: '🎂', color: 'teal',
    titulo: c.persona.nombre_completo,
    detalle: `Cumple ${c.edad} años · ${etiquetaCuando(c.faltan)}`,
  }));

  return [...deInformes, ...deFotos, ...deCumpleanos];
}
