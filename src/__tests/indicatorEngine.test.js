import { describe, it, expect } from 'vitest';
import { computeIndicatorValue, semaforo, progresoPct, detectDuplicates } from '../lib/indicatorEngine';

const rec = (o) => ({ estado_validacion: 'validado', formulario_id: 'f1', datos: {}, ...o });

describe('Motor de indicadores (indicatorEngine)', () => {
  it('conteo cuenta solo registros validados de la fuente', () => {
    const ind = { formula: { fuente: { formulario_id: 'f1' }, operacion: 'conteo' } };
    const records = [
      rec({ id: '1' }),
      rec({ id: '2' }),
      rec({ id: '3', estado_validacion: 'pendiente' }), // no cuenta
      rec({ id: '4', formulario_id: 'otro' })           // otra fuente
    ];
    expect(computeIndicatorValue(ind, records)).toBe(2);
  });

  it('suma agrega un campo numérico', () => {
    const ind = { formula: { fuente: { formulario_id: 'f1' }, operacion: 'suma', campo: 'n' } };
    const records = [rec({ id: '1', datos: { n: 10 } }), rec({ id: '2', datos: { n: 5 } })];
    expect(computeIndicatorValue(ind, records)).toBe(15);
  });

  it('promedio calcula la media del campo', () => {
    const ind = { formula: { fuente: { formulario_id: 'f1' }, operacion: 'promedio', campo: 'n' } };
    const records = [rec({ datos: { n: 4 } }), rec({ datos: { n: 6 } })];
    expect(computeIndicatorValue(ind, records)).toBe(5);
  });

  it('porcentaje aplica filtro sobre denominador', () => {
    const ind = { formula: {
      fuente: { formulario_id: 'f1' }, operacion: 'porcentaje',
      filtro: { field: 'datos.ok', operator: 'equals', value: 'si' }
    } };
    const records = [
      rec({ datos: { ok: 'si' } }), rec({ datos: { ok: 'si' } }),
      rec({ datos: { ok: 'no' } }), rec({ datos: { ok: 'no' } })
    ];
    expect(computeIndicatorValue(ind, records)).toBe(50); // 2 de 4
  });

  it('sin fórmula cae en el campo actual (compatibilidad)', () => {
    expect(computeIndicatorValue({ actual: 42 }, [])).toBe(42);
  });

  it('semaforo: verde ≥ meta, amarillo en tolerancia, rojo abajo', () => {
    expect(semaforo(100, 100)).toBe('verde');
    expect(semaforo(97, 100)).toBe('amarillo'); // 97% ≥ 95% tolerancia
    expect(semaforo(80, 100)).toBe('rojo');
  });

  it('progresoPct se capa en 100', () => {
    expect(progresoPct(150, 100)).toBe(100);
    expect(progresoPct(25, 100)).toBe(25);
  });

  it('detectDuplicates marca mismo formulario+unidad+día', () => {
    const records = [
      { id: 'a', formulario_id: 'f1', unidad_id: 'u1', capturado_at: '2026-07-02T08:00:00Z' },
      { id: 'b', formulario_id: 'f1', unidad_id: 'u1', capturado_at: '2026-07-02T15:00:00Z' }, // dup de a
      { id: 'c', formulario_id: 'f1', unidad_id: 'u2', capturado_at: '2026-07-02T09:00:00Z' }  // distinta unidad
    ];
    const dup = detectDuplicates(records);
    expect(dup.has('a')).toBe(true);
    expect(dup.has('b')).toBe(true);
    expect(dup.has('c')).toBe(false);
  });
});
