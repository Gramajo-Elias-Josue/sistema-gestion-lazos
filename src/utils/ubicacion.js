// =====================================================================
// UTILIDADES: Ubicación (fichaje del profesional)
// ---------------------------------------------------------------------
// Pide la ubicación al navegador y traduce sus errores a mensajes
// claros. La decisión de si el profesional está en el centro NO se toma
// acá: la toma la base (función fichar(), script 16), que calcula la
// distancia y pone la hora. Acá solo se arma lo que ve el usuario.
//
// El navegador da la ubicación solo en páginas seguras (https o
// localhost) y después de que el usuario acepta el permiso.
// =====================================================================

// Pide la ubicación actual. Devuelve { lat, lng, precision } (precisión
// en metros, la que informa el GPS) o rechaza con el error del navegador.
export function obtenerUbicacion() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject({ code: 'NO_SOPORTADO' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        precision: Math.round(pos.coords.accuracy),
      }),
      reject,
      // Alta precisión (GPS si hay) y sin reusar una ubicación vieja.
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  });
}

// Mensaje para el usuario según el error del navegador. Los códigos son
// los del estándar: 1 permiso denegado, 2 no disponible, 3 tardó mucho.
export function mensajeErrorUbicacion(err) {
  switch (err?.code) {
    case 1:
      return 'No diste permiso para usar tu ubicación. Activalo en el candado de la barra de direcciones (o en los ajustes del navegador) y probá de nuevo.';
    case 2:
      return 'No se pudo saber tu ubicación. Revisá que el GPS / la ubicación del celular esté activada.';
    case 3:
      return 'Tardó demasiado en encontrar tu ubicación. Probá de nuevo, mejor cerca de una ventana.';
    case 'NO_SOPORTADO':
      return 'Este navegador no puede dar la ubicación. Probá con Chrome o Safari en el celular.';
    default:
      return 'No se pudo obtener tu ubicación. Probá de nuevo.';
  }
}

// Qué le toca hacer hoy al profesional según su fila del día:
//   'entrada'  -> todavía no fichó (o la secretaría lo marcó presente sin hora)
//   'salida'   -> fichó la entrada, falta la salida
//   'listo'    -> ya fichó las dos
//   'bloqueado'-> la planilla lo tiene como ausente / licencia
// Es la misma regla que aplica fichar() en la base.
export function proximoPaso(fila) {
  if (!fila) return 'entrada';
  if (fila.estado && fila.estado !== 'presente') return 'bloqueado';
  if (!fila.hora_entrada) return 'entrada';
  if (!fila.hora_salida) return 'salida';
  return 'listo';
}

// Link a Google Maps para ver un punto (para que el director confirme
// que la ubicación guardada es la del centro).
export function linkMapa(lat, lng) {
  return `https://www.google.com/maps?q=${Number(lat)},${Number(lng)}`;
}

// Valida lo que carga el director. Devuelve { ok, mensaje, datos }.
export function validarUbicacionCentro({ latitud, longitud, radio }) {
  const lat = Number(String(latitud ?? '').replace(',', '.'));
  const lng = Number(String(longitud ?? '').replace(',', '.'));
  const r = Number(radio);
  if (String(latitud ?? '').trim() === '' || !Number.isFinite(lat) || lat < -90 || lat > 90) {
    return { ok: false, mensaje: 'La latitud tiene que ser un número entre -90 y 90.' };
  }
  if (String(longitud ?? '').trim() === '' || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    return { ok: false, mensaje: 'La longitud tiene que ser un número entre -180 y 180.' };
  }
  if (!Number.isInteger(r) || r < 20 || r > 2000) {
    return { ok: false, mensaje: 'El radio tiene que ser un número entero entre 20 y 2000 metros.' };
  }
  return { ok: true, datos: { latitud: lat, longitud: lng, radio_m: r } };
}
