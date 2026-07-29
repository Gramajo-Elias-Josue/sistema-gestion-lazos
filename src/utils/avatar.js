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

// Avatares predefinidos: un emoji sobre un color de la paleta de Lazos.
// Alcanzan para que cada persona se distinga de un vistazo sin subir nada.
export const AVATARES = [
  { clave: 'sonrisa',   emoji: '🙂', color: '#7bcbf0' },
  { clave: 'estrella',  emoji: '⭐', color: '#f6a065' },
  { clave: 'corazon',   emoji: '💙', color: '#9bd6f2' },
  { clave: 'flor',      emoji: '🌻', color: '#fbe9c8' },
  { clave: 'sol',       emoji: '☀️', color: '#fde4d2' },
  { clave: 'luna',      emoji: '🌙', color: '#dcf0fb' },
  { clave: 'gato',      emoji: '🐱', color: '#f6d4d1' },
  { clave: 'perro',     emoji: '🐶', color: '#fdf4ec' },
  { clave: 'planta',    emoji: '🪴', color: '#d6f0dd' },
  { clave: 'libro',     emoji: '📚', color: '#e6e1d7' },
  { clave: 'musica',    emoji: '🎵', color: '#e2dcf5' },
  { clave: 'arcoiris',  emoji: '🌈', color: '#ffe4f0' },
];

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
