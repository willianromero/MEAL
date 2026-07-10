import { describe, it, expect } from 'vitest';
import { buildFormula, formulaToDefState } from '../lib/indicatorFormulaBuilder';
import { computeIndicatorValue } from '../lib/indicatorEngine';

describe('buildFormula — editor de fórmula de indicador (Indicators.jsx)', () => {
  it('sin formulario fuente, el indicador es manual (formula: null)', () => {
    expect(buildFormula({ formularioId: '', operacion: 'conteo', campo: '', filtroCampo: '', filtroValor: '' })).toBeNull();
  });

  it('conteo no incluye "campo" (no aplica)', () => {
    const f = buildFormula({ formularioId: 'frm-1', operacion: 'conteo', campo: '', filtroCampo: '', filtroValor: '' });
    expect(f).toEqual({ fuente: { formulario_id: 'frm-1' }, operacion: 'conteo' });
  });

  it('suma/promedio incluyen el campo numérico elegido', () => {
    const f = buildFormula({ formularioId: 'frm-1', operacion: 'suma', campo: 'num_asistentes', filtroCampo: '', filtroValor: '' });
    expect(f).toEqual({ fuente: { formulario_id: 'frm-1' }, operacion: 'suma', campo: 'num_asistentes' });
  });

  it('porcentaje con filtro genera la regla datos.<campo> equals <valor> (compatible con rulesEngine)', () => {
    const f = buildFormula({ formularioId: 'frm-1', operacion: 'porcentaje', campo: '', filtroCampo: 'aprobado', filtroValor: 'si' });
    expect(f.filtro).toEqual({ field: 'datos.aprobado', operator: 'equals', value: 'si' });
  });

  it('porcentaje sin filtro no agrega la clave filtro', () => {
    const f = buildFormula({ formularioId: 'frm-1', operacion: 'porcentaje', campo: '', filtroCampo: '', filtroValor: '' });
    expect(f.filtro).toBeUndefined();
  });

  it('formulaToDefState reconstruye el estado del editor a partir de una fórmula guardada (round-trip)', () => {
    const original = { fuente: { formulario_id: 'frm-9' }, operacion: 'porcentaje', filtro: { field: 'datos.ok', operator: 'equals', value: 'si' } };
    const state = formulaToDefState(original);
    expect(state).toEqual({ formularioId: 'frm-9', operacion: 'porcentaje', campo: '', filtroCampo: 'ok', filtroValor: 'si' });
    // Round-trip: reconstruir desde ese estado debe devolver la misma fórmula.
    expect(buildFormula(state)).toEqual(original);
  });

  it('formulaToDefState de un indicador manual (formula: null) da el estado vacío por defecto', () => {
    expect(formulaToDefState(null)).toEqual({ formularioId: '', operacion: 'conteo', campo: '', filtroCampo: '', filtroValor: '' });
  });
});

describe('Integración: editor → indicatorEngine (extremo a extremo del caso de uso real)', () => {
  // Simula exactamente el flujo del experto MEAL: "Registro de Asistencia a
  // Formación" (srv-wayuu-104) debe alimentar IND-1.1 (conteo de asistentes)
  // sin digitación manual, una vez configurada la fórmula en la app.
  const registros = [
    { id: 'r1', formulario_id: 'frm-asistencia', estado_validacion: 'validado', datos: { asistio: 'si' } },
    { id: 'r2', formulario_id: 'frm-asistencia', estado_validacion: 'validado', datos: { asistio: 'si' } },
    { id: 'r3', formulario_id: 'frm-asistencia', estado_validacion: 'pendiente', datos: { asistio: 'si' } }, // aún no cuenta
    { id: 'r4', formulario_id: 'otro-formulario', estado_validacion: 'validado', datos: { asistio: 'si' } }  // otra fuente
  ];

  it('un indicador configurado desde el editor calcula solo, sobre registros validados de SU formulario', () => {
    const defDesdeElEditor = { formularioId: 'frm-asistencia', operacion: 'conteo', campo: '', filtroCampo: '', filtroValor: '' };
    const indicator = { id: 'ind-1', formula: buildFormula(defDesdeElEditor), target: 10 };

    expect(computeIndicatorValue(indicator, registros)).toBe(2); // r1 y r2: validados, del formulario correcto
  });

  it('un indicador manual (sin fuente) sigue dependiendo de "Registrar Avance" (usa .actual)', () => {
    const indicator = { id: 'ind-2', formula: buildFormula({ formularioId: '', operacion: 'conteo', campo: '', filtroCampo: '', filtroValor: '' }), actual: 42 };
    expect(computeIndicatorValue(indicator, registros)).toBe(42);
  });
});
