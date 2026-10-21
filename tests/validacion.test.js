// Tests de las validaciones de formularios (utils/validacion.js). Son puras:
// reciben los datos y devuelven { ok } o { ok:false, mensaje }.
import { describe, it, expect } from 'vitest';
import {
  normalizarDni, validarPaciente, validarDocumento, validarTurno, conflictoDniCasual,
  validarFichajeProfesional, validarProfesional, validarGasto,
} from '../src/utils/validacion.js';
import { hoyISO, sumarDias } from '../src/utils/fechas.js';

describe('normalizarDni', () => {
  it('deja solo dígitos', () => {
    expect(normalizarDni('12.345.678')).toBe('12345678');
    expect(normalizarDni('DNI 30-111')).toBe('30111');
  });
});

describe('validarPaciente', () => {
  const base = { nombre_completo: 'Ana Test', dni: '12345678' };
  it('acepta un paciente válido', () => {
    expect(validarPaciente(base).ok).toBe(true);
  });
  it('exige nombre y DNI', () => {
    expect(validarPaciente({ ...base, nombre_completo: '' }).ok).toBe(false);
    expect(validarPaciente({ ...base, dni: '' }).ok).toBe(false);
  });
  it('rechaza DNI con letras o longitud inválida', () => {
    expect(validarPaciente({ ...base, dni: 'abc' }).ok).toBe(false);
    expect(validarPaciente({ ...base, dni: '123' }).ok).toBe(false);   // muy corto
    expect(validarPaciente({ ...base, dni: '1234567890' }).ok).toBe(false); // muy largo
  });
  it('rechaza fechas futuras (nacimiento / ingreso)', () => {
    const manana = sumarDias(hoyISO(), 1);
    expect(validarPaciente({ ...base, fecha_nacimiento: manana }).ok).toBe(false);
    expect(validarPaciente({ ...base, fecha_ingreso: manana }).ok).toBe(false);
  });

  it('al CREAR (esNuevo) exige la fecha de ingreso', () => {
    expect(validarPaciente(base, { esNuevo: true }).ok).toBe(false);
    expect(validarPaciente({ ...base, fecha_ingreso: hoyISO() }, { esNuevo: true }).ok).toBe(true);
  });

  it('al EDITAR (esNuevo=false) no la exige retroactivamente', () => {
    expect(validarPaciente(base, { esNuevo: false }).ok).toBe(true);
    expect(validarPaciente(base).ok).toBe(true); // esNuevo por defecto es false
  });
});

describe('validarDocumento', () => {
  it('exige tipo', () => {
    expect(validarDocumento({}).ok).toBe(false);
  });
  it('el vencimiento no puede ser anterior a la emisión', () => {
    expect(validarDocumento({ tipo: 'cud', fecha_emision: '2026-05-10', fecha_vencimiento: '2026-05-01' }).ok).toBe(false);
    expect(validarDocumento({ tipo: 'cud', fecha_emision: '2026-05-01', fecha_vencimiento: '2026-05-10' }).ok).toBe(true);
  });
});

describe('validarTurno (paciente casual, sin legajo)', () => {
  const completo = { paciente_nombre: 'Juan Pérez', profesional_id: 'p', fecha: '2026-07-14', hora: '15:00' };
  const ctx = { hoy: '2026-07-14', ahora: '09:00' };

  it('acepta un turno completo', () => {
    expect(validarTurno(completo, ctx).ok).toBe(true);
  });

  it('exige nombre, profesional, fecha y hora (la hora para controlar la grilla)', () => {
    for (const campo of ['paciente_nombre', 'profesional_id', 'fecha', 'hora']) {
      expect(validarTurno({ ...completo, [campo]: '' }, ctx).ok, `falló al faltar "${campo}"`).toBe(false);
    }
    expect(validarTurno({ ...completo, paciente_nombre: '   ' }, ctx).ok).toBe(false);
  });

  it('teléfono y DNI son opcionales, pero el DNI se valida si viene', () => {
    expect(validarTurno({ ...completo, paciente_dni: '30.111.222' }, ctx).ok).toBe(true);
    expect(validarTurno({ ...completo, paciente_dni: 'abc' }, ctx).ok).toBe(false);
  });

  it('[clave] no se da un turno de HOY a una hora que ya pasó (16:50 → no a las 14:30)', () => {
    const tarde = { hoy: '2026-07-14', ahora: '16:50' };
    const r = validarTurno({ ...completo, hora: '14:30' }, tarde);
    expect(r.ok).toBe(false);
    expect(r.mensaje).toContain('16:50');
    expect(validarTurno({ ...completo, hora: '17:30' }, tarde).ok).toBe(true);
    // Otro día, a la misma hora, sí.
    expect(validarTurno({ ...completo, fecha: '2026-07-15', hora: '14:30' }, tarde).ok).toBe(true);
  });

  it('no se da un turno en una fecha que ya pasó', () => {
    expect(validarTurno({ ...completo, fecha: '2026-07-13' }, ctx).ok).toBe(false);
  });
});

describe('conflictoDniCasual (que no se repita el DNI)', () => {
  const base = { nombre: 'Juan Pérez', fecha: '2026-07-20' };

  it('sin coincidencias, está todo bien', () => {
    expect(conflictoDniCasual(base)).toBe(null);
  });

  it('[clave] el DNI de un paciente del centro no se puede usar como casual', () => {
    const r = conflictoDniCasual({ ...base, paciente: { nombre_completo: 'Ana Gómez' } });
    expect(r).toContain('Ana Gómez');
    expect(r).toContain('Grilla de atención');
  });

  it('[clave] el DNI ya usado por OTRA persona casual se rechaza', () => {
    const turnosDni = [{ paciente_nombre: 'Carlos Vega', fecha: '2026-07-01', estado: 'atendido' }];
    expect(conflictoDniCasual({ ...base, turnosDni })).toContain('Carlos Vega');
  });

  it('el mismo casual puede volver otro día (segunda consulta)', () => {
    const turnosDni = [{ paciente_nombre: 'juan perez', fecha: '2026-07-01', estado: 'atendido' }];
    expect(conflictoDniCasual({ ...base, turnosDni })).toBe(null); // mismo nombre sin tildes ni mayúsculas
  });

  it('pero no dos turnos el mismo día (salvo que el otro esté cancelado)', () => {
    const mismoDia = [{ paciente_nombre: 'Juan Pérez', fecha: '2026-07-20', hora: '10:00:00', estado: 'programado' }];
    expect(conflictoDniCasual({ ...base, turnosDni: mismoDia })).toContain('10:00');
    const cancelado = [{ ...mismoDia[0], estado: 'cancelado' }];
    expect(conflictoDniCasual({ ...base, turnosDni: cancelado })).toBe(null);
  });
});

describe('validarFichajeProfesional', () => {
  it('no permite salida sin entrada', () => {
    expect(validarFichajeProfesional({ hora_salida: '17:00' }).ok).toBe(false);
  });
  it('la salida no puede ser anterior a la entrada', () => {
    expect(validarFichajeProfesional({ hora_entrada: '10:00', hora_salida: '09:00' }).ok).toBe(false);
    expect(validarFichajeProfesional({ hora_entrada: '08:00', hora_salida: '16:00' }).ok).toBe(true);
  });
});

describe('validarProfesional', () => {
  // Lo mínimo de una edición: nombre y turno (el formulario siempre
  // manda los turnos tildados).
  const edicion = { nombre_completo: 'Lic. X', turnos_trabajo: ['manana'] };

  it('exige nombre siempre; el resto (salvo el turno) no se exige si no es alta (esNuevo=false)', () => {
    expect(validarProfesional({ ...edicion, nombre_completo: '' }).ok).toBe(false);
    expect(validarProfesional(edicion).ok).toBe(true); // edición, sin más datos
  });

  it('email y DNI se validan si vienen, sea alta o edición', () => {
    expect(validarProfesional({ ...edicion, email: 'no-es-mail' }).ok).toBe(false);
    expect(validarProfesional({ ...edicion, email: 'x@y.com' }).ok).toBe(true);
    expect(validarProfesional({ ...edicion, dni: 'abc' }).ok).toBe(false);
  });

  it('rechaza fecha de nacimiento futura', () => {
    const manana = sumarDias(hoyISO(), 1);
    expect(validarProfesional({ nombre_completo: 'Lic. X', fecha_nacimiento: manana }).ok).toBe(false);
  });

  const profesionalCompleto = {
    nombre_completo: 'Lic. X', dni: '30111222', fecha_nacimiento: '1990-01-01',
    profesion: 'Psicología', sector: 'psicologia', especialidad: 'Infantil',
    telefono: '3865111222', email: 'x@y.com', direccion: 'Calle 123',
    turnos_trabajo: ['manana'], dias_trabajo: ['Lunes'],
  };

  it('[regresión] al CREAR (esNuevo) exige todos los datos', () => {
    expect(validarProfesional(profesionalCompleto, { esNuevo: true }).ok).toBe(true);
    for (const campo of ['dni', 'fecha_nacimiento', 'profesion', 'sector', 'especialidad', 'telefono', 'email', 'direccion']) {
      const incompleto = { ...profesionalCompleto, [campo]: null };
      expect(validarProfesional(incompleto, { esNuevo: true }).ok, `falló al faltar "${campo}"`).toBe(false);
    }
    expect(validarProfesional({ ...profesionalCompleto, dias_trabajo: [] }, { esNuevo: true }).ok).toBe(false);
  });

  it('exige al menos un turno, al crear Y al editar (sin turno no aparece en la grilla)', () => {
    expect(validarProfesional({ ...profesionalCompleto, turnos_trabajo: [] }, { esNuevo: true }).ok).toBe(false);
    expect(validarProfesional({ nombre_completo: 'Lic. X', turnos_trabajo: [] }, { esNuevo: false }).ok).toBe(false);
    expect(validarProfesional({ ...profesionalCompleto, turnos_trabajo: ['manana', 'tarde'] }, { esNuevo: true }).ok).toBe(true);
  });

  it('matrícula y teléfono 2 quedan opcionales incluso al crear', () => {
    expect(validarProfesional({ ...profesionalCompleto, matricula: null, telefono2: null }, { esNuevo: true }).ok).toBe(true);
  });

  it('al EDITAR no exige retroactivamente lo que falte (salvo el turno)', () => {
    expect(validarProfesional({ nombre_completo: 'Lic. X', turnos_trabajo: ['tarde'] }, { esNuevo: false }).ok).toBe(true);
  });
});

describe('validarGasto', () => {
  const base = { fecha: '2026-08-09', concepto: 'Resma de hojas A4', socio: 'Josué', monto: '3500' };

  it('acepta un gasto válido', () => {
    expect(validarGasto(base).ok).toBe(true);
  });

  it('exige fecha, concepto y socio', () => {
    expect(validarGasto({ ...base, fecha: '' }).ok).toBe(false);
    expect(validarGasto({ ...base, concepto: '  ' }).ok).toBe(false);
    expect(validarGasto({ ...base, socio: '' }).ok).toBe(false);
  });

  it('el monto tiene que ser un número mayor a cero', () => {
    expect(validarGasto({ ...base, monto: '0' }).ok).toBe(false);
    expect(validarGasto({ ...base, monto: '-5' }).ok).toBe(false);
    expect(validarGasto({ ...base, monto: '' }).ok).toBe(false);
    expect(validarGasto({ ...base, monto: 'abc' }).ok).toBe(false);
  });
});
