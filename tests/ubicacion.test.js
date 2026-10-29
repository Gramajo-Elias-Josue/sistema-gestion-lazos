// Tests del fichaje por ubicación: utilidades y vistas (lo que decide la
// base —distancia, hora— se prueba en la base; acá, lo que ve el usuario).
import { describe, it, expect, afterEach, vi } from 'vitest';
import { mensajeErrorUbicacion, proximoPaso, linkMapa, validarUbicacionCentro, obtenerUbicacion, conPrecision } from '../src/utils/ubicacion.js';
import { mensajeError } from '../src/utils/errores.js';
import { renderInicio, renderInicioProfesional, renderRecordatorioFichaje } from '../src/views/inicioView.js';
import { renderFichaje } from '../src/views/fichajeView.js';
import { botonesFichaje, pasoFichaje, puedeDeshacerSalida, tramosDe, horaFichada, estadoDeTramo } from '../src/utils/tramosFichaje.js';
import { filaHtml as filaPlanilla, renderFilas as filasPlanilla, renderPestanasTurnoAsistencia, trabajaEnTurno } from '../src/views/asistenciaProfView.js';
import { validarTramosFichaje } from '../src/utils/validacion.js';
import { renderCalendario, renderDetalleDia } from '../src/views/calendarioAsistenciaView.js';
import { armarCalendario, origenFichaje, diasConHorario, textoTurnoDia } from '../src/utils/calendario.js';
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

describe('Deshacer la salida', () => {
  it('solo si la salida la fichó el profesional con su ubicación', () => {
    expect(puedeDeshacerSalida({ hora_salida: '12:00:00', salida_por: 'ubicacion' })).toBe(true);
    expect(puedeDeshacerSalida({ hora_salida: '12:00:00', salida_por: 'secretaria' })).toBe(false);
    expect(puedeDeshacerSalida({ hora_entrada: '08:00:00' })).toBe(false);
    expect(puedeDeshacerSalida(null)).toBe(false);
  });
  it('el botón aparece en la tarjeta de salida solo en ese caso', () => {
    const propia = renderFichaje({ fila: { estado: 'presente', hora_entrada: '08:00:00', hora_salida: '12:00:00', salida_por: 'ubicacion' } });
    expect(propia).toContain('data-deshacer-salida');
    const deSecretaria = renderFichaje({ fila: { estado: 'presente', hora_entrada: '08:00:00', hora_salida: '12:00:00', salida_por: 'secretaria' } });
    expect(deSecretaria).not.toContain('data-deshacer-salida');
  });
  it('después de deshacer, vuelve a tocar la salida (y el Inicio la recuerda)', () => {
    const fila = { estado: 'presente', hora_entrada: '08:00:00', hora_salida: null };
    expect(proximoPaso(fila)).toBe('salida');
    expect(renderRecordatorioFichaje({ paso: proximoPaso(fila), fila })).toContain('fichar la salida');
  });
});

describe('Calendario de asistencia: sin horario en el día, detalle al tocarlo', () => {
  const registros = [
    { fecha: '2026-10-21', estado: 'presente', hora_entrada: '14:00:00', hora_salida: '18:00:00', entrada_por: 'secretaria', salida_por: 'secretaria' },
    { fecha: '2026-10-29', estado: 'presente', hora_entrada: '12:15:00', hora_salida: null, entrada_por: 'ubicacion', entrada_distancia_m: 12 },
  ];
  const cal = armarCalendario({ anio: 2026, mes: 10, registros, hoy: '2026-10-30' });

  it('los días no muestran el horario, y cada día se puede tocar', () => {
    const html = renderCalendario(cal);
    expect(html).not.toContain('14:00');
    expect(html).not.toContain('12:15');
    expect(html).toContain('data-dia="2026-10-21"');
    expect(html).toContain('data-cal-detalle');
  });
  it('el detalle del día tiene estado, horario y quién lo cargó', () => {
    const d = cal.dias.find(x => x.iso === '2026-10-29');
    const html = renderDetalleDia(d);
    expect(html).toContain('Presente');
    expect(html).toContain('12:15');
    expect(html).toContain('Ubicación, a 12 m del centro');
    expect(renderDetalleDia(cal.dias.find(x => x.iso === '2026-10-21'))).toContain('Secretaría');
  });
  it('sin tocar ninguno, invita a tocar; fin de semana y sin registro lo dicen', () => {
    expect(renderDetalleDia(null)).toContain('Tocá un día');
    expect(renderDetalleDia(cal.dias.find(x => x.iso === '2026-10-24'))).toContain('no abre');
    expect(renderDetalleDia(cal.dias.find(x => x.iso === '2026-10-22'))).toContain('Sin registro');
  });
  it('la planilla en PDF lista los días con horario y quién los cargó', () => {
    expect(diasConHorario(cal.dias).map(d => d.iso)).toEqual(['2026-10-21', '2026-10-29']);
    expect(origenFichaje(cal.dias.find(x => x.iso === '2026-10-21'))).toBe('Secretaría');
    expect(origenFichaje(cal.dias.find(x => x.iso === '2026-10-29'))).toBe('Ubicación');
    expect(origenFichaje({ entrada: '08:00', salida: '12:00', entradaPor: 'ubicacion', salidaPor: 'secretaria' }))
      .toBe('Entrada: Ubicación · Salida: Secretaría');
  });
});

describe('Doble turno: dos tramos (mañana y tarde) en el mismo día', () => {
  const doble = { id: 'p1', nombre_completo: 'Flores Ingrid', turnos_trabajo: ['manana', 'tarde'] };
  const tarde = { id: 'p2', nombre_completo: 'Soria Gabriela', turnos_trabajo: ['tarde'] };

  it('tramosDe: dos tramos para doble turno, uno (de su turno) para el resto', () => {
    expect(tramosDe(doble).map(t => t.turno.clave)).toEqual(['manana', 'tarde']);
    expect(tramosDe(tarde).map(t => t.turno.clave)).toEqual(['tarde']);
    expect(tramosDe({ turnos_trabajo: [] })).toEqual([{ n: 1, turno: null }]);
  });

  it('botones: se habilitan en orden (entrada, salida, entrada tarde, salida tarde)', () => {
    expect(botonesFichaje(null, true)).toEqual({ entrada: true, salida: false, entrada_2: true, salida_2: false });
    const conManana = { estado: 'presente', hora_entrada: '08:00' };
    expect(botonesFichaje(conManana, true)).toEqual({ entrada: false, salida: true, entrada_2: false, salida_2: false });
    const mananaCerrada = { ...conManana, hora_salida: '12:00' };
    expect(botonesFichaje(mananaCerrada, true)).toEqual({ entrada: false, salida: false, entrada_2: true, salida_2: false });
    const conTarde = { ...mananaCerrada, hora_entrada_2: '14:00' };
    expect(botonesFichaje(conTarde, true)).toEqual({ entrada: false, salida: false, entrada_2: false, salida_2: true });
    expect(botonesFichaje({ ...conTarde, hora_salida_2: '18:00' }, true))
      .toEqual({ entrada: false, salida: false, entrada_2: false, salida_2: false });
  });
  it('vino solo a la tarde: después de la entrada de la tarde, la mañana ya no se ficha', () => {
    expect(botonesFichaje({ estado: 'presente', hora_entrada_2: '14:00' }, true))
      .toEqual({ entrada: false, salida: false, entrada_2: false, salida_2: true });
  });
  it('un solo turno: nunca se habilita la tarde aparte', () => {
    expect(botonesFichaje({ estado: 'presente', hora_entrada: '14:00', hora_salida: '18:00' }, false))
      .toEqual({ entrada: false, salida: false, entrada_2: false, salida_2: false });
  });

  it('pasoFichaje: lo que falta, para el recordatorio del Inicio', () => {
    expect(pasoFichaje(null, true)).toBe('entrada');
    expect(pasoFichaje({ estado: 'presente', hora_entrada: '08:00' }, true)).toBe('salida');
    expect(pasoFichaje({ estado: 'presente', hora_entrada: '08:00', hora_salida: '12:00' }, true)).toBe('entrada_2');
    expect(pasoFichaje({ estado: 'presente', hora_entrada: '08:00', hora_salida: '12:00', hora_entrada_2: '14:00' }, true)).toBe('salida_2');
    expect(pasoFichaje({ estado: 'presente', hora_entrada: '08:00', hora_salida: '12:00', hora_entrada_2: '14:00', hora_salida_2: '18:00' }, true)).toBe('listo');
    expect(pasoFichaje({ estado: 'presente', hora_entrada: '14:00', hora_salida: '18:00' }, false)).toBe('listo');
  });
  it('recordatorio: nombra el turno', () => {
    expect(renderRecordatorioFichaje({ paso: 'salida', fila: { hora_entrada: '08:00' }, doble: true })).toContain('salida de la mañana');
    expect(renderRecordatorioFichaje({ paso: 'entrada_2', fila: { hora_salida: '12:00' }, doble: true })).toContain('entrada de la tarde');
    expect(renderRecordatorioFichaje({ paso: 'salida_2', fila: { hora_entrada_2: '14:00' }, doble: true })).toContain('salida de la tarde');
  });

  it('deshacer: la de la mañana no, si ya empezó la tarde', () => {
    const fila = { hora_salida: '12:00', salida_por: 'ubicacion', hora_entrada_2: '14:00', hora_salida_2: '18:00', salida_2_por: 'ubicacion' };
    expect(puedeDeshacerSalida(fila, 1)).toBe(false);
    expect(puedeDeshacerSalida(fila, 2)).toBe(true);
    expect(puedeDeshacerSalida({ hora_salida: '12:00', salida_por: 'ubicacion' }, 1)).toBe(true);
  });
  it('horaFichada: la hora que devolvió la base para lo que se fichó', () => {
    expect(horaFichada({ hora_entrada_2: '14:01:00' }, 'entrada_2')).toBe('14:01:00');
    expect(horaFichada({}, 'salida')).toBe(null);
  });

  it('Mi fichaje: dos secciones con su color, cada una con sus botones', () => {
    const html = renderFichaje({ fila: { estado: 'presente', hora_entrada: '08:00:00', hora_salida: '12:00:00' }, profesional: doble });
    expect(html).toContain('fich-t-manana');
    expect(html).toContain('fich-t-tarde');
    expect(html).toContain('data-fichar="salida_2"');
    expect(html).toMatch(/data-fichar="entrada_2"\s*>/); // habilitado
  });
  it('Mi fichaje: un solo turno muestra solo su sección', () => {
    const html = renderFichaje({ fila: null, profesional: tarde });
    expect(html).toContain('fich-t-tarde');
    expect(html).not.toContain('fich-t-manana');
    expect(html).not.toContain('entrada_2');
  });

  it('planilla de la secretaría: en cada pestaña, las horas de ese turno', () => {
    const fila = { estado: 'presente', hora_entrada: '08:00:00', hora_salida: '12:00:00', hora_entrada_2: '14:10:00' };
    const manana = filaPlanilla(doble, fila, { turno: 'manana' });
    expect(manana).toContain('data-tramo="1"');
    expect(manana).toContain('value="08:00"');
    expect(manana).not.toContain('14:10');
    const tardeHtml = filaPlanilla(doble, fila, { turno: 'tarde' });
    expect(tardeHtml).toContain('data-tramo="2"');
    expect(tardeHtml).toContain('value="14:10"');
    // El de un solo turno (tarde) carga su único tramo, el 1.
    expect(filaPlanilla(tarde, null, { turno: 'tarde' })).toContain('data-tramo="1"');
  });
  it('planilla de hoy a la mañana: la tarde todavía no empezó, no se sugiere hora', () => {
    const html = filaPlanilla(doble, null, { esHoy: true, ahora: '09:30', turno: 'tarde' });
    expect(html).toContain('class="apf-entrada" value=""');
  });
  it('pestañas: cada turno lista a los suyos (el de doble turno, en las dos)', () => {
    const sinTurno = { id: 'p3', nombre_completo: 'Paz Florencia', turnos_trabajo: [] };
    const lista = [doble, tarde, sinTurno];
    expect(trabajaEnTurno(tarde, 'manana')).toBe(false);
    expect(trabajaEnTurno(doble, 'manana')).toBe(true);
    expect(trabajaEnTurno(sinTurno, 'tarde')).toBe(true);
    const filasManana = filasPlanilla(lista, {}, { turno: 'manana' });
    expect(filasManana).toContain('Flores Ingrid');
    expect(filasManana).not.toContain('Soria Gabriela');
    expect(filasManana).toContain('Sin turno cargado');
    expect(filasPlanilla(lista, {}, { turno: 'tarde' })).toContain('Soria Gabriela');
    const tabs = renderPestanasTurnoAsistencia(lista, 'tarde');
    expect(tabs).toContain('Turno mañana');
    expect(tabs).toMatch(/apf-tab-tarde active/);
    expect(tabs).toContain('· 2'); // mañana: doble + sin turno
    expect(tabs).toContain('· 3'); // tarde: doble + tarde + sin turno
  });

  it('validación de la secretaría: la tarde no puede empezar antes de que termine la mañana', () => {
    const m = { estado: 'presente', hora_entrada: '08:00', hora_salida: '12:30' };
    expect(validarTramosFichaje(m, { estado: 'presente', hora_entrada: '12:00' }).ok).toBe(false);
    expect(validarTramosFichaje(m, { estado: 'presente', hora_entrada: '14:00', hora_salida: '18:00' }).ok).toBe(true);
    expect(validarTramosFichaje({ estado: 'presente', hora_entrada: '08:00' }, { estado: 'presente', hora_entrada: '14:00' }).ok).toBe(false);
    expect(validarTramosFichaje(m, { estado: 'presente', hora_entrada: '18:00', hora_salida: '14:00' }).mensaje).toContain('tarde');
  });

  it('calendario: el detalle del día muestra mañana y tarde; el PDF los pone en columnas', () => {
    const cal = armarCalendario({ anio: 2026, mes: 10, hoy: '2026-10-30', registros: [{
      fecha: '2026-10-28', estado: 'presente',
      hora_entrada: '08:00:00', hora_salida: '12:00:00', entrada_por: 'ubicacion', salida_por: 'ubicacion',
      hora_entrada_2: '14:05:00', hora_salida_2: '18:00:00', entrada_2_por: 'secretaria', salida_2_por: 'secretaria',
    }] });
    const d = cal.dias.find(x => x.iso === '2026-10-28');
    const html = renderDetalleDia(d);
    expect(html).toContain('Mañana');
    expect(html).toContain('Tarde');
    expect(html).toContain('14:05');
    expect(origenFichaje(d)).toBe('Ubicación y Secretaría');
    expect(diasConHorario(cal.dias)).toHaveLength(1);
  });
});

describe('Estado por turno (doble turno): faltó a la mañana, vino a la tarde', () => {
  const doble = { id: 'p1', nombre_completo: 'Flores Ingrid', turnos_trabajo: ['manana', 'tarde'] };
  const faltoManana = { estado: 'ausente', estado_1: 'ausente', estado_2: null };

  it('estadoDeTramo: cada turno con su estado; si no se marcó por turno, el del día', () => {
    expect(estadoDeTramo(faltoManana, 1, true)).toBe('ausente');
    expect(estadoDeTramo(faltoManana, 2, true)).toBe(null);
    expect(estadoDeTramo({ estado: 'licencia' }, 2, true)).toBe('licencia'); // licencia de todo el día
    expect(estadoDeTramo({ estado: 'ausente', estado_1: 'ausente' }, 1, false)).toBe('ausente');
  });
  it('ausente a la mañana: la mañana no se ficha, la tarde sí', () => {
    expect(botonesFichaje(faltoManana, true)).toEqual({ entrada: false, salida: false, entrada_2: true, salida_2: false });
    expect(pasoFichaje(faltoManana, true)).toBe('entrada_2');
  });
  it('ausente a la mañana y la tarde fichada: listo', () => {
    const fila = { ...faltoManana, estado: 'presente', estado_2: 'presente', hora_entrada_2: '14:00', hora_salida_2: '18:00' };
    expect(pasoFichaje(fila, true)).toBe('listo');
  });
  it('los dos turnos con licencia: bloqueado', () => {
    expect(pasoFichaje({ estado: 'licencia', estado_1: 'licencia', estado_2: 'licencia' }, true)).toBe('bloqueado');
  });
  it('Mi fichaje: la mañana muestra el aviso y la tarde sus botones', () => {
    const html = renderFichaje({ fila: faltoManana, profesional: doble });
    expect(html).toContain('En este turno figurás como <b>Ausente</b>');
    expect(html).toContain('data-fichar="entrada_2"');
    expect(html).not.toContain('data-fichar="entrada"');
  });
  it('planilla: cada pestaña edita el estado de su turno', () => {
    const manana = filaPlanilla(doble, faltoManana, { turno: 'manana' });
    expect(manana).toMatch(/<option value="ausente" selected>/);
    const tarde = filaPlanilla(doble, faltoManana, { turno: 'tarde' });
    expect(tarde).toMatch(/<option value="presente" selected>/);
    expect(tarde).toContain('gtick pend'); // la tarde todavía no se guardó
  });
  it('detalle del día y PDF: el turno al que faltó dice su estado', () => {
    const cal = armarCalendario({ anio: 2026, mes: 10, hoy: '2026-10-30', registros: [{
      fecha: '2026-10-28', estado: 'presente', estado_1: 'ausente', estado_2: 'presente',
      hora_entrada_2: '14:00:00', hora_salida_2: '18:00:00',
    }] });
    const d = cal.dias.find(x => x.iso === '2026-10-28');
    const html = renderDetalleDia(d);
    expect(html).toContain('Mañana');
    expect(html).toContain('Ausente');
    expect(html).toContain('14:00');
    expect(textoTurnoDia(d.entrada, d.salida, d.estado1)).toBe('Ausente');
    expect(textoTurnoDia(d.entrada2, d.salida2, d.estado2)).toBe('14:00 a 18:00');
  });
});

describe('Planilla de hoy: qué sugiere según la hora', () => {
  const doble = { id: 'p1', nombre_completo: 'Flores Ingrid', turnos_trabajo: ['manana', 'tarde'] };
  it('turno que ya terminó: su horario habitual; turno en curso: la hora actual', () => {
    const manana = filaPlanilla(doble, null, { esHoy: true, ahora: '14:50', turno: 'manana' });
    expect(manana).toContain('class="apf-entrada" value="08:00"');
    expect(manana).toContain('class="apf-salida" value="12:00"');
    const tarde = filaPlanilla(doble, null, { esHoy: true, ahora: '14:50', turno: 'tarde' });
    expect(tarde).toContain('class="apf-entrada" value="14:50"');
    expect(tarde).toContain('class="apf-salida" value=""');
  });
});
