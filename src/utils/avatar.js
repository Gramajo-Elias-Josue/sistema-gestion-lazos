// =====================================================================
// UTILIDAD: Avatar del usuario
// ---------------------------------------------------------------------
// Funciones PURAS (sin DOM ni base) para manejar el avatar del perfil.
//
// El avatar se guarda en `perfiles.avatar` como un texto con prefijo:
//   null            -> iniciales del nombre (por defecto)
//   'preset:medico' -> uno de los avatares de src/assets/avatares/
//   'foto:ruta'     -> foto propia, en el bucket "avatares" de Storage
//
// LOS AVATARES PREDEFINIDOS SON ARCHIVOS: se detectan solos desde
// `src/assets/avatares/`. Para agregar o sacar uno, se agrega o se borra
// el archivo; no hay que tocar el código.
//   - Formatos: .svg (ideal), .png o .webp
//   - El NOMBRE del archivo es la clave que se guarda en la base, así que
//     conviene que sea corto, en minúsculas y sin acentos ni espacios:
//     medico.svg, secretaria.svg, directora.svg, kinesiologo.svg…
// =====================================================================

// Vite lee la carpeta en tiempo de compilación y devuelve la URL final de
// cada archivo (ya optimizada y con control de caché).
const ARCHIVOS = import.meta.glob('../assets/avatares/*.{svg,png,webp,jpg,jpeg}', {
  eager: true,
  query: '?url',
  import: 'default',
});

// Etiquetas legibles para las claves más habituales (van en el aria-label,
// para lectores de pantalla; NO se muestran como tooltip al pasar el mouse
// a propósito). Si un archivo no está acá, se arma un nombre a partir del
// propio nombre del archivo.
const ETIQUETAS = {
  medico: 'Médico', medica: 'Médica',
  enfermero: 'Enfermero', enfermera: 'Enfermera',
  secretario: 'Secretario', secretaria: 'Secretaria',
  director: 'Director', directora: 'Directora',
  psicologo: 'Psicólogo', psicologa: 'Psicóloga',
  fonoaudiologo: 'Fonoaudiólogo', fonoaudiologa: 'Fonoaudióloga',
  kinesiologo: 'Kinesiólogo', kinesiologa: 'Kinesióloga',
  terapista: 'Terapista', docente: 'Docente',
  psicopedagogo: 'Psicopedagogo', psicopedagoga: 'Psicopedagoga',
  administrativo: 'Administrativo', administrativa: 'Administrativa',

  // Avatares predefinidos (src/assets/avatares/): el nombre del archivo
  // empieza con una letra de grupo (a/b/c/d) que agrupa por ESTILO
  // visual (ilustración grande, ícono chico, circular, silueta lisa), así
  // se ven ordenados por parecido en vez de mezclados. Acá se traduce
  // cada clave a una etiqueta legible, sin el prefijo de grupo.
  'a-medico': 'Médico', 'a-administrativa': 'Administrativa',
  'a-secretaria': 'Secretaria', 'a-secretaria-2': 'Secretaria',
  'a-directora': 'Directora', 'a-nina': 'Niña', 'a-nino': 'Niño',
  'b-medica': 'Médica', 'b-mujer': 'Mujer', 'b-mujer-2': 'Mujer',
  'b-mujer-3': 'Mujer', 'b-mujer-4': 'Mujer', 'b-mujer-5': 'Mujer',
  'b-mujer-negocios': 'Mujer', 'b-hombre': 'Hombre', 'b-hombre-2': 'Hombre',
  'b-hombre-joven': 'Hombre joven',
  'c-hombre': 'Hombre', 'c-hombre-2': 'Hombre',
  'c-perfil-hombre': 'Perfil', 'c-perfil-mujer': 'Perfil',
  'd-hombre': 'Usuario', 'd-usuario': 'Usuario', 'd-usuario-2': 'Usuario',
};

// Normaliza el nombre del archivo para usarlo como clave en la base:
// minúsculas, sin acentos y sin espacios ni símbolos.
//   "Secretaria2.png"     -> "secretaria2"
//   "empresario (1).png"  -> "empresario-1"
// Así el archivo se puede llamar como venga del banco de iconos y la clave
// guardada sigue siendo limpia y estable.
export function claveDeArchivo(nombreArchivo) {
  return String(nombreArchivo)
    .replace(/\.[^.]+$/, '')                            // saca la extensión
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // saca los acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')                        // todo lo demás -> guion
    .replace(/^-+|-+$/g, '');                           // sin guiones al borde
}

// "medico-general" -> "Medico general" (respaldo si no está en ETIQUETAS).
function etiquetaDe(clave) {
  if (ETIQUETAS[clave]) return ETIQUETAS[clave];
  const texto = clave.replace(/[-_]+/g, ' ').trim();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Catálogo de avatares disponibles, ordenado por CLAVE (no por nombre
// legible): el nombre del archivo agrupa por estilo visual (ver
// ETIQUETAS más arriba), así que ordenar por clave agrupa en la grilla
// los que se parecen entre sí en vez de mezclarlos alfabéticamente por
// etiqueta. Cada uno: { clave (del nombre del archivo), nombre (legible),
// url }. Si dos archivos dieran la misma clave, se conserva el primero
// para que una elección guardada no cambie de dibujo por sorpresa.
const vistas = new Set();
export const AVATARES = Object.entries(ARCHIVOS)
  .map(([ruta, url]) => {
    const clave = claveDeArchivo(ruta.split('/').pop());
    return { clave, nombre: etiquetaDe(clave), url };
  })
  .filter(a => a.clave && !vistas.has(a.clave) && vistas.add(a.clave))
  .sort((a, b) => a.clave.localeCompare(b.clave, 'es'));

// Iniciales que se muestran cuando no hay avatar elegido. Con nombre y
// apellido toma la primera letra de cada uno ("Ana Gómez" -> "AG"); si es
// una sola palabra o un email, las dos primeras ("admin@lazos.test" ->
// "AD"). Se usa en el encabezado y en el panel para que siempre coincidan.
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
// Si el avatar guardado ya no existe (se borró el archivo), cae en
// iniciales en vez de romper.
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
