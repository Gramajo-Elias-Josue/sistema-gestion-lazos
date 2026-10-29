// Tests del fichaje por ubicación: utilidades y vistas (lo que decide la
// base —distancia, hora— se prueba en la base; acá, lo que ve el usuario).
import { describe, it, expect, afterEach, vi } from 'vitest';
import { mensajeErrorUbicacion, proximoPaso, linkMapa, validarUbicacionCentro, obtenerUbicacion, conPrecision } from '../src/utils/ubicacion.js';
import { mensajeError } from '../src/utils/errores.js';
import { renderInicio, renderInicioProfesional, renderRecordatorioFichaje } from '../src/views/inicioView.js';
import { renderFichaje } from '../src/views/fichajeView.js';
import { renderGrilla } from '../src/views/grillaAtencionView.js';
import { puedeVer, seccionesEfectivas } from '../src/permisos.js';
import { renderUbicacionCentro } from '../src/views/administracionView.js';
import { filaHtml } from '../src/views/asistenciaProfView.js';

describe('proximoPaso (qué le toca fichar hoy)', () => {
  it('sin fila -> entrada', () => {
    expect(proximoPaso(null)).toBe('entrada');
  });
  it('la secretaría lo marcó presente sin hora -> entrada', () => {
    expect(proximoPaso({ estado: 'presente', hora_entrada: null })).toBe('entrada');
  });
  it('con entrada y sin salida -> salida', () => {
    expect(proximoPaso({ estado: 'presente', hora_entrada: '08:00:00' })).toBe('salida');
  });
  it('con las dos -> listo', () => {
    expect(proximoPaso({ estado: 'presente', hora_entrada: '08:00:00', hora_salida: '12:00:00' })).toBe('listo');
  });
  it('ausente o licencia -> bloqueado', () => {
    expect(proximoPaso({ estado: 'licencia' })).toBe('bloqueado');
    expect(proximoPaso({ estado: 'ausente' })).toBe('bloqueado');
  });
});

describe('mensajeErrorUbicacion', () => {
  it('explica cada error del navegador', () => {
    expect(mensajeErrorUbicacion({ code: 1 })).toContain('permiso');
    expect(mensajeErrorUbicacion({ code: 2 })).toContain('GPS');
    expect(mensajeErrorUbicacion({ code: 3 })).toContain('Tardó');
    expect(mensajeErrorUbicacion({ code: 'NO_SOPORTADO' })).toContain('navegador');
    expect(mensajeErrorUbicacion({})).toContain('Probá de nuevo');
  });
});

describe('mensajeError con mensajes de la base (P0001)', () => {
  it('muestra el mensaje que escribió la función fichar()', () => {
    const err = { code: 'P0001', message: 'Estás a 850 m del centro (se permite hasta 100 m).' };
    expect(mensajeError(err, 'respaldo')).toBe(err.message);
  });
});

describe('validarUbicacionCentro', () => {
  it('acepta coordenadas válidas, también con coma decimal', () => {
    const v = validarUbicacionCentro({ latitud: '-27,4321', longitud: '-65.6123', radio: 100 });
    expect(v.ok).toBe(true);
    expect(v.datos).toEqual({ latitud: -27.4321, longitud: -65.6123, radio_m: 100 });
  });
  it('rechaza latitud vacía o fuera de rango', () => {
    expect(validarUbicacionCentro({ latitud: '', longitud: '-65', radio: 100 }).ok).toBe(false);
    expect(validarUbicacionCentro({ latitud: '95', longitud: '-65', radio: 100 }).ok).toBe(false);
  });
  it('rechaza longitud inválida', () => {
    expect(validarUbicacionCentro({ latitud: '-27', longitud: 'abc', radio: 100 }).ok).toBe(false);
  });
  it('rechaza radios muy chicos, muy grandes o con decimales', () => {
    expect(validarUbicacionCentro({ latitud: '-27', longitud: '-65', radio: 5 }).ok).toBe(false);
    expect(validarUbicacionCentro({ latitud: '-27', longitud: '-65', radio: 5000 }).ok).toBe(false);
    expect(validarUbicacionCentro({ latitud: '-27', longitud: '-65', radio: 100.5 }).ok).toBe(false);
  });
});

describe('linkMapa', () => {
  it('arma el link de Google Maps', () => {
    expect(linkMapa(-27.4, -65.6)).toBe('https://www.google.com/maps?q=-27.4,-65.6');
  });
});

describe('fichajeView: dos botones, entrada y salida', () => {
  const botones = (html) => {
    const m = [...html.matchAll(/<button[^>]*data-fichar="(entrada|salida)"[^>]*>/g)];
    return Object.fromEntries(m.map(([tag, que]) => [que, !tag.includes('disabled')]));
  };

  it('sin fichar: entrada habilitada, salida deshabilitada', () => {
    const html = renderFichaje({ fila: null });
    expect(botones(html)).toEqual({ entrada: true, salida: false });
    expect(html).toContain('Se habilita después de fichar la entrada');
    expect(html).not.toContain('type="time"'); // la hora no se elige
  });
  it('con entrada: entrada apagada con su hora, salida habilitada', () => {
    const html = renderFichaje({ fila: { estado: 'presente', hora_entrada: '08:02:00', entrada_por: 'ubicacion' } });
    expect(botones(html)).toEqual({ entrada: false, salida: true });
    expect(html).toContain('08:02');
    expect(html).toContain('Entrada fichada');
  });
  it('completo: los dos apagados', () => {
    const html = renderFichaje({ fila: { estado: 'presente', hora_entrada: '08:02:00', hora_salida: '12:01:00' } });
    expect(botones(html)).toEqual({ entrada: false, salida: false });
    expect(html).toContain('12:01');
    expect(html).toContain('Ya fichaste la entrada y la salida');
  });
  it('la secretaría lo marcó presente sin hora: puede fichar la entrada', () => {
    expect(botones(renderFichaje({ fila: { estado: 'presente' } }))).toEqual({ entrada: true, salida: false });
  });
  it('licencia: avisa y no muestra botones', () => {
    const html = renderFichaje({ fila: { estado: 'licencia' } });
    expect(html).toContain('Licencia');
    expect(html).not.toContain('data-fichar');
  });
  it('si la hora la cargó la secretaría, lo aclara', () => {
    const html = renderFichaje({ fila: { estado: 'presente', hora_entrada: '08:00:00', entrada_por: 'secretaria' } });
    expect(html).toContain('secretaría');
  });
});

describe('Inicio del profesional', () => {
  it('muestra su grilla y el lugar del recordatorio, nada de la dirección', () => {
    const html = renderInicioProfesional();
    expect(html).toContain('inicio-grilla');
    expect(html).toContain('inicio-recordatorio');
    expect(html).not.toContain('inicio-kpis');
    expect(html).not.toContain('inicio-alertas');
    expect(html).not.toContain('inicio-entregas');
  });
  it('el Inicio de la dirección no tiene fichaje', () => {
    expect(renderInicio()).not.toContain('fich');
  });
  it('recordatorio: avisa la entrada o la salida pendiente y lleva a Mi fichaje', () => {
    const entrada = renderRecordatorioFichaje({ paso: 'entrada', fila: null });
    expect(entrada).toContain('entrada');
    expect(entrada).toContain('href="#fichaje"');
    const salida = renderRecordatorioFichaje({ paso: 'salida', fila: { hora_entrada: '08:02:00' } });
    expect(salida).toContain('salida');
    expect(salida).toContain('08:02');
  });
  it('recordatorio: nada si ya fichó todo o está de licencia', () => {
    expect(renderRecordatorioFichaje({ paso: 'listo' })).toBe('');
    expect(renderRecordatorioFichaje({ paso: 'bloqueado' })).toBe('');
  });
});

describe('Grilla propia del profesional', () => {
  const sectores = [{ clave: 'psicologia', etiqueta: 'Psicología' }];
  const yo = { id: 'x1', nombre_completo: 'Flores Ingrid', sector: 'psicologia', turnos_trabajo: ['manana'] };
  it('sin buscador y con avisos escritos para él', () => {
    const html = renderGrilla({ profesionales: [yo], sectores, celdas: {}, editable: false, turno: 'tarde', propia: true });
    expect(html).not.toContain('ga-buscar');
    expect(html).toContain('No trabajás en el turno tarde');
  });
  it('sin turno cargado: le dice que avise a la secretaría', () => {
    const html = renderGrilla({ profesionales: [{ ...yo, turnos_trabajo: [] }], sectores, celdas: {}, propia: true });
    expect(html).toContain('Todavía no tenés turno cargado');
  });
});

describe('Permisos: Mi fichaje es solo del profesional', () => {
  it('el profesional la ve siempre, aunque tenga secciones propias', () => {
    expect(puedeVer({ rol: 'profesional' }, 'fichaje')).toBe(true);
    expect(puedeVer({ rol: 'profesional', secciones: ['pacientes'] }, 'fichaje')).toBe(true);
  });
  it('director, secretaría y CM no', () => {
    expect(puedeVer({ rol: 'director' }, 'fichaje')).toBe(false);
    expect(puedeVer({ rol: 'secretaria' }, 'fichaje')).toBe(false);
    expect(puedeVer({ rol: 'cm' }, 'fichaje')).toBe(false);
  });
  it('no aparece para tildar en Administración (no está entre las secciones del director)', () => {
    expect(seccionesEfectivas({ rol: 'director' })).not.toContain('fichaje');
  });
});

describe('administracionView: Ubicación del centro', () => {
  it('sin cargar: avisa que nadie puede fichar todavía y no muestra el mapa', () => {
    const html = renderUbicacionCentro({ latitud: null, longitud: null, radio_m: 100 });
    expect(html).toContain('Todavía no está cargada');
    expect(html).not.toContain('lnk-ubi-mapa');
    expect(html).toContain('Usar mi ubicación actual');
  });
  it('cargada: muestra los valores y el link al mapa', () => {
    const html = renderUbicacionCentro({ latitud: -27.43, longitud: -65.61, radio_m: 150 });
    expect(html).toContain('value="-27.43"');
    expect(html).toContain('value="150"');
    expect(html).toContain('google.com/maps?q=-27.43,-65.61');
  });
});

describe('asistenciaProfView: marca 📍 en la planilla de la secretaría', () => {
  const prof = { id: 'p1', nombre_completo: 'Flores Ingrid' };
  it('aparece cuando la hora la fichó el profesional con su ubicación', () => {
    const html = filaHtml(prof, { estado: 'presente', hora_entrada: '08:00:00', entrada_por: 'ubicacion', entrada_distancia_m: 35 });
    expect(html).toContain('apf-ubi');
    expect(html).toContain('35 m');
  });
  it('no aparece si la cargó la secretaría', () => {
    const html = filaHtml(prof, { estado: 'presente', hora_entrada: '08:00:00', entrada_por: 'secretaria' });
    expect(html).not.toContain('apf-ubi');
  });
});

// GPS de mentira: va entregando lecturas (precisión en metros) cada 100 ms.
function gpsSimulado(precisiones, { error } = {}) {
  const watch = { cortado: false };
  vi.stubGlobal('navigator', {
    geolocation: {
      watchPosition(ok, fallo) {
        precisiones.forEach((acc, i) => setTimeout(() => {
          if (!watch.cortado) ok({ coords: { latitude: -27.43 + i, longitude: -65.62, accuracy: acc } });
        }, 100 * (i + 1)));
        if (error) setTimeout(() => { if (!watch.cortado) fallo(error); }, 50);
        return 7;
      },
      clearWatch() { watch.cortado = true; },
    },
  });
  return watch;
}

describe('obtenerUbicacion: se queda con la lectura más precisa', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it('termina apenas una lectura llega a la precisión buscada', async () => {
    vi.useFakeTimers();
    const watch = gpsSimulado([120, 60, 15, 5]);
    const p = obtenerUbicacion({ precisionBuscada: 25, esperaMaxima: 10000 });
    await vi.advanceTimersByTimeAsync(400);
    const r = await p;
    expect(r.precision).toBe(15);
    expect(watch.cortado).toBe(true);
  });

  it('si ninguna llega, al terminar la espera usa la mejor que hubo', async () => {
    vi.useFakeTimers();
    gpsSimulado([150, 70, 90]);
    const p = obtenerUbicacion({ precisionBuscada: 25, esperaMaxima: 1000 });
    await vi.advanceTimersByTimeAsync(1000);
    expect((await p).precision).toBe(70);
  });

  it('permiso denegado: rechaza con ese error', async () => {
    vi.useFakeTimers();
    gpsSimulado([], { error: { code: 1 } });
    const p = obtenerUbicacion({ esperaMaxima: 1000 });
    const resultado = expect(p).rejects.toEqual({ code: 1 });
    await vi.advanceTimersByTimeAsync(100);
    await resultado;
  });

  it('navegador sin ubicación: NO_SOPORTADO', async () => {
    vi.stubGlobal('navigator', {});
    await expect(obtenerUbicacion()).rejects.toEqual({ code: 'NO_SOPORTADO' });
  });
});

describe('conPrecision: el "Estás a X m" dice qué tan preciso estaba el GPS', () => {
  const msg = 'Estás a 127 m del centro (se permite hasta 100 m). Para fichar tenés que estar en el centro.';
  it('suma la precisión', () => {
    expect(conPrecision(msg, 12)).toContain('±12 m');
    expect(conPrecision(msg, 12)).not.toContain('impreciso');
  });
  it('con GPS flojo, aconseja probar de nuevo', () => {
    expect(conPrecision(msg, 140)).toContain('impreciso');
  });
  it('otros mensajes no se tocan', () => {
    expect(conPrecision('Ya fichaste la entrada a las 08:00.', 12)).toBe('Ya fichaste la entrada a las 08:00.');
  });
});
