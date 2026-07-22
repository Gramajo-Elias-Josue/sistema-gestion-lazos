// Tests de las validaciones de formularios (utils/validacion.js). Son puras:
// reciben los datos y devuelven { ok } o { ok:false, mensaje }.
import { describe, it, expect } from 'vitest';
import {
  normalizarDni, validarPaciente, validarDocumento, validarTurno,
  validarFichajeProfesional, validarProfesional,
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

describe('validarTurno', () => {
  it('exige paciente, profesional y fecha', () => {
    expect(validarTurno({ profesional_id: 'p', fecha: '2026-07-14' }).ok).toBe(false);
    expect(validarTurno({ paciente_id: 'a', fecha: '2026-07-14' }).ok).toBe(false);
    expect(validarTurno({ paciente_id: 'a', profesional_id: 'p' }).ok).toBe(false);
    expect(validarTurno({ paciente_id: 'a', profesional_id: 'p', fecha: '2026-07-14' }).ok).toBe(true);
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
  it('exige nombre y valida el email', () => {
    expect(validarProfesional({ nombre_completo: '' }).ok).toBe(false);
    expect(validarProfesional({ nombre_completo: 'Lic. X', email: 'no-es-mail' }).ok).toBe(false);
    expect(validarProfesional({ nombre_completo: 'Lic. X', email: 'x@y.com' }).ok).toBe(true);
  });
});
