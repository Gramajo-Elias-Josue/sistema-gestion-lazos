// =====================================================================
// CONFIG: Datos institucionales de la clínica
// ---------------------------------------------------------------------
// Datos fijos que aparecen en el membrete de los informes PDF (y donde
// haga falta el logo). Centralizados acá para no repetirlos: si cambian
// (dirección, teléfono, resolución), se editan en un solo lugar.
//
// LOGO: guardar el archivo en `public/logo-lazos.png` (Vite sirve la
// carpeta `public/` en la raíz, así que la ruta pública es `/logo-lazos.png`).
// Si el archivo no está, los informes se generan igual pero sin el logo.
// =====================================================================

export const CLINICA = {
  nombre: 'Lazos',
  subtitulo: 'Centro de Rehabilitación Integral',
  direccion: 'Pringles 654, Aguilares - Tucumán',
  cuit: '30718325303',
  cel: '3865-418482',
  resolucion: '2014/SPS/2025',
  logo: '/logo-lazos.png',
};
