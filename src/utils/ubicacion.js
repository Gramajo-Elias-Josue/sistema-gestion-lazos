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

// Precisión (en metros) que ya alcanza para dejar de esperar, y cuánto se
// espera como máximo a que el GPS mejore.
export const PRECISION_BUSCADA_M = 25;
export const ESPERA_MAXIMA_MS = 10000;

// Pide la ubicación actual. Devuelve { lat, lng, precision } (precisión
// en metros, la que informa el GPS) o rechaza con el error del navegador.
//
// Adentro de un edificio, la PRIMERA lectura del GPS suele ser la peor
// (arranca con la ubicación aproximada por WiFi/antenas y después afina).
// Por eso se escuchan las lecturas durante unos segundos y se queda con la
// más precisa: termina antes si alguna ya llega a PRECISION_BUSCADA_M.
export function obtenerUbicacion({ precisionBuscada = PRECISION_BUSCADA_M, esperaMaxima = ESPERA_MAXIMA_MS } = {}) {
  return new Promise((resolve, reject) => {
    const geo = typeof navigator !== 'undefined' ? navigator.geolocation : null;
    if (!geo) {
      reject({ code: 'NO_SOPORTADO' });
      return;
    }
    let mejor = null;
    let terminado = false;
    let id = null;

    const terminar = (error) => {
      if (terminado) return;
      terminado = true;
      clearTimeout(reloj);
      if (id !== null) geo.clearWatch(id);
      if (mejor) resolve(mejor);
      else reject(error || { code: 3 }); // sin ninguna lectura: "tardó demasiado"
    };

    const reloj = setTimeout(() => terminar(), esperaMaxima);
    id = geo.watchPosition(
      (pos) => {
        const lectura = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          precision: Math.round(pos.coords.accuracy),
        };
        if (!mejor || lectura.precision < mejor.precision) mejor = lectura;
        if (mejor.precision <= precisionBuscada) terminar();
      },
      // Permiso denegado o GPS apagado: no tiene sentido seguir esperando.
      // (Si ya hubo una lectura buena, se usa esa.)
      (err) => terminar(err),
      // Alta precisión (GPS si hay) y sin reusar una ubicación vieja.
      { enableHighAccuracy: true, timeout: esperaMaxima, maximumAge: 0 }
    );
    // Si ya terminó durante la primera lectura (antes de tener el id), se
    // corta la escucha acá.
    if (terminado) geo.clearWatch(id);
  });
}

// Al mensaje "Estás a X m del centro" de la base le suma la precisión del
// GPS de esa lectura: así se entiende si quedó afuera por estar lejos o
// porque el GPS estaba impreciso (y conviene probar de nuevo).
export function conPrecision(mensaje, precision) {
  if (!Number.isFinite(precision) || !/^Estás a \d+ m del centro/.test(mensaje || '')) return mensaje;
  const consejo = precision > 50 ? ' Tu GPS estaba impreciso: probá de nuevo cerca de una ventana o afuera.' : '';
  return `${mensaje} (Precisión de tu ubicación: ±${precision} m.)${consejo}`;
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
