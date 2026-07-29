// =====================================================================
// UTILIDAD: Avatar del usuario
// ---------------------------------------------------------------------
// Funciones PURAS (sin DOM ni base) para manejar el avatar del perfil.
//
// El avatar se guarda en `perfiles.avatar` como un texto con prefijo:
//   null            -> iniciales del nombre (por defecto)
//   'preset:sonrisa'-> uno de los avatares predefinidos (AVATARES)
//   'foto:ruta'     -> foto propia, en el bucket "avatares" de Storage
// =====================================================================

// Avatares predefinidos: MONOGRAMAS. Cada uno es un color sobrio sobre el
// que se muestran las iniciales de la persona (el estilo de las
// herramientas de trabajo: Slack, Google Workspace, Notion).
//
// Se eligió monograma y no ilustraciones/emojis por tres razones:
//   - es el registro adecuado para un ámbito profesional de salud;
//   - los emojis se dibujan distinto en cada sistema operativo;
//   - las iniciales identifican a la persona, no a un dibujo genérico.
// `texto` es el color de la letra, elegido para que contraste con el fondo.
export const AVATARES = [
  { clave: 'navy',      nombre: 'Azul marino',  color: '#1b3865', texto: '#ffffff' },
  { clave: 'celeste',   nombre: 'Celeste',      color: '#1488c2', texto: '#ffffff' },
  { clave: 'petroleo',  nombre: 'Petróleo',     color: '#0f6470', texto: '#ffffff' },
  { clave: 'verde',     nombre: 'Verde',        color: '#2f6f4e', texto: '#ffffff' },
  { clave: 'oliva',     nombre: 'Oliva',        color: '#5f6b3a', texto: '#ffffff' },
  { clave: 'pizarra',   nombre: 'Pizarra',      color: '#475569', texto: '#ffffff' },
  { clave: 'grafito',   nombre: 'Grafito',      color: '#2f3640', texto: '#ffffff' },
  { clave: 'ciruela',   nombre: 'Ciruela',      color: '#5b4b8a', texto: '#ffffff' },
  { clave: 'bordo',     nombre: 'Bordó',        color: '#7b2d3b', texto: '#ffffff' },
  { clave: 'terracota', nombre: 'Terracota',    color: '#9a4b34', texto: '#ffffff' },
  { clave: 'ambar',     nombre: 'Ámbar',        color: '#b06a06', texto: '#ffffff' },
  { clave: 'arena',     nombre: 'Arena',        color: '#d8cbb4', texto: '#2b2115' },
];

// Iniciales que se muestran en el monograma. Con nombre y apellido toma la
// primera letra de cada uno ("Ana Gómez" -> "AG"); si es una sola palabra o
// un email, las dos primeras letras ("admin@lazos.test" -> "AD"). Se usa en
// el encabezado y en el panel para que siempre coincidan.
export function inicialesDe(nombreOEmail) {
  const texto = String(nombreOEmail || '').trim();
  if (!texto) return 'US';
  const palabras = texto.split(/\s+/).filter(Boolean);
  if (palabras.length >= 2) {
    return (palabras[0][0] + palabras[1][0]).toUpperCase();
  }
  return texto.slice(0, 2).toUpperCase();
}

// Interpreta el valor guardado. Devuelve siempre un objeto con `tipo`:
//   { tipo:'preset', preset:{…} } | { tipo:'foto', ruta } | { tipo:'iniciales' }
export function parseAvatar(valor) {
  if (typeof valor === 'string') {
    if (valor.startsWith('preset:')) {
      const clave = valor.slice(7);
      const preset = AVATARES.find(a => a.clave === clave);
      if (preset) return { tipo: 'preset', preset };
    }
    if (valor.startsWith('foto:')) {
      const ruta = valor.slice(5);
      if (ruta) return { tipo: 'foto', ruta };
    }
  }
  return { tipo: 'iniciales' };
}

// Valor a guardar para un avatar predefinido / una foto.
export function valorPreset(clave) {
  return `preset:${clave}`;
}
export function valorFoto(ruta) {
  return `foto:${ruta}`;
}

// Ruta donde se guarda la foto de un usuario. La PRIMERA carpeta es su id:
// las políticas del bucket usan eso para que nadie pise la foto de otro.
export function rutaFoto(usuarioId, nombreArchivo = 'foto') {
  const limpio = String(nombreArchivo).replace(/[^\w.\-]/g, '_');
  return `${usuarioId}/${Date.now()}-${limpio}`;
}
