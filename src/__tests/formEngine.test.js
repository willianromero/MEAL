import { describe, it, expect } from 'vitest';
import { validateField, validateForm, isFieldVisible, fieldLabel } from '../lib/formEngine';
import { shouldRemoteOverwriteLocal } from '../syncEngine';

describe('Motor de formularios (formEngine)', () => {
  it('Marca error si un campo obligatorio está vacío', () => {
    const campo = { name: 'nombre', etiqueta_es: 'Nombre', tipo: 'texto', obligatorio: true };
    expect(validateField(campo, '', {})).toMatch(/obligatorio/i);
    expect(validateField(campo, 'Ana', {})).toBeNull();
  });

  it('Valida rangos numéricos y escala 1-5', () => {
    const num = { name: 'edad', etiqueta_es: 'Edad', tipo: 'num', obligatorio: false, reglas_validacion: { min: 0, max: 120 } };
    expect(validateField(num, 200, {})).toMatch(/≤/);
    expect(validateField(num, 30, {})).toBeNull();
    const esc = { name: 'sat', etiqueta_es: 'Satisfacción', tipo: 'escala', obligatorio: false };
    expect(validateField(esc, 6, {})).toMatch(/entre 1 y 5/);
    expect(validateField(esc, 4, {})).toBeNull();
  });

  it('Un geopunto obligatorio sin lat cuenta como vacío', () => {
    const geo = { name: 'g', etiqueta_es: 'Ubicación', tipo: 'geo', obligatorio: true };
    expect(validateField(geo, null, {})).toMatch(/obligatorio/i);
    expect(validateField(geo, { lat: 11.5, lng: -72.9 }, {})).toBeNull();
  });

  it('Respeta la visibilidad condicional (mostrar_si) y no valida campos ocultos', () => {
    const campo = {
      name: 'motivo', etiqueta_es: 'Motivo', tipo: 'texto', obligatorio: true,
      mostrar_si: { field: 'datos.tiene_queja', operator: 'equals', value: 'si' }
    };
    expect(isFieldVisible(campo, { tiene_queja: 'no' })).toBe(false);
    // Oculto → no exige el obligatorio
    expect(validateField(campo, '', { tiene_queja: 'no' })).toBeNull();
    // Visible → exige el obligatorio
    expect(validateField(campo, '', { tiene_queja: 'si' })).toMatch(/obligatorio/i);
  });

  it('validateForm agrega los errores de todos los campos', () => {
    const form = { campos: [
      { name: 'a', etiqueta_es: 'A', tipo: 'texto', obligatorio: true },
      { name: 'b', etiqueta_es: 'B', tipo: 'num', obligatorio: false, reglas_validacion: { max: 5 } }
    ] };
    const res = validateForm(form, { a: '', b: 9 });
    expect(res.valido).toBe(false);
    expect(Object.keys(res.errores)).toEqual(['a', 'b']);
  });

  it('fieldLabel usa wayuunaiki cuando existe y se pide', () => {
    const campo = { name: 'x', etiqueta_es: 'Comunidad', etiqueta_way: 'Woumain' };
    expect(fieldLabel(campo, 'way')).toBe('Woumain');
    expect(fieldLabel(campo, 'es')).toBe('Comunidad');
  });
});

describe('Inmutabilidad de registros de campo en sync (DRT 8.4)', () => {
  it('No sobreescribe un registro de campo local aunque exista remoto', () => {
    const local = { id: 'r1', updated_at: '2026-06-01T00:00:00.000Z', sync_status: 'synced' };
    const remote = { id: 'r1', updated_at: '2026-06-05T00:00:00.000Z' };
    expect(shouldRemoteOverwriteLocal(local, remote, 'field_records')).toBe(false);
    expect(shouldRemoteOverwriteLocal(local, remote, 'evidences')).toBe(false);
  });

  it('Sí acepta el remoto cuando el registro de campo no existe localmente', () => {
    const remote = { id: 'r1', updated_at: '2026-06-05T00:00:00.000Z' };
    expect(shouldRemoteOverwriteLocal(null, remote, 'field_records')).toBe(true);
  });

  it('Catálogos siguen usando Last-Write-Wins normal', () => {
    const local = { id: 'c1', updated_at: '2026-06-01T00:00:00.000Z', sync_status: 'synced' };
    const remote = { id: 'c1', updated_at: '2026-06-05T00:00:00.000Z' };
    expect(shouldRemoteOverwriteLocal(local, remote, 'program_lines')).toBe(true);
  });
});
