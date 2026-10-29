// Tests del fichaje por ubicación: utilidades y vistas (lo que decide la
// base —distancia, hora— se prueba en la base; acá, lo que ve el usuario).
import { describe, it, expect } from 'vitest';
import { mensajeErrorUbicacion, proximoPaso, linkMapa, validarUbicacionCentro } from '../src/utils/ubicacion.js';
import { mensajeError } from '../src/utils/errores.js';
import { renderMiFichaje, renderInicio } from '../src/views/inicioView.js';
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

describe('inicioView: Mi fichaje', () => {
  it('el panel aparece solo para el profesional', () => {
    expect(renderInicio({ conFichaje: true })).toContain('inicio-fichaje');
    expect(renderInicio()).not.toContain('inicio-fichaje');
  });
  it('sin fichar: botón de entrada, sin campo para elegir la hora', () => {
    const html = renderMiFichaje({ paso: 'entrada', fila: null });
    expect(html).toContain('Fichar entrada');
    expect(html).not.toContain('type="time"');
  });
  it('con entrada: muestra la hora y ofrece la salida', () => {
    const html = renderMiFichaje({ paso: 'salida', fila: { estado: 'presente', hora_entrada: '08:02:00', entrada_por: 'ubicacion' } });
    expect(html).toContain('08:02');
    expect(html).toContain('Fichar salida');
  });
  it('completo: sin botón', () => {
    const html = renderMiFichaje({ paso: 'listo', fila: { estado: 'presente', hora_entrada: '08:02:00', hora_salida: '12:01:00' } });
    expect(html).not.toContain('btn-fichar');
    expect(html).toContain('12:01');
  });
  it('licencia: avisa y no deja fichar', () => {
    const html = renderMiFichaje({ paso: 'bloqueado', fila: { estado: 'licencia' } });
    expect(html).toContain('Licencia');
    expect(html).not.toContain('btn-fichar');
  });
  it('si la hora la cargó la secretaría, lo aclara', () => {
    const html = renderMiFichaje({ paso: 'salida', fila: { estado: 'presente', hora_entrada: '08:00:00', entrada_por: 'secretaria' } });
    expect(html).toContain('secretaría');
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
