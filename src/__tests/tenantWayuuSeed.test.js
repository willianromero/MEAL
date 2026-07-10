import { describe, it, expect } from 'vitest';
import { tenantWayuu } from '../seeds/tenantWayuu';
import { FIELD_TYPES } from '../lib/formEngine';

// Sanity de la 4ª revisión experta MEAL (2026): 5 formularios nuevos en el
// motor moderno + campos ampliados en las encuestas legadas 101/102.
// Objetivo: atrapar errores de transcripción (tipo de campo inexistente,
// fórmula apuntando a un formulario/campo que no existe) antes de que
// lleguen a producción vía supabase/seed.sql.
describe('Seed Wayuu — formularios ampliados (103-107) y encuestas 101/102', () => {
  const idsEsperados = ['frm-wayuu-103', 'frm-wayuu-104', 'frm-wayuu-105', 'frm-wayuu-106', 'frm-wayuu-107'];

  it('existen exactamente los 5 formularios nuevos (108/PQRS queda excluido a propósito)', () => {
    const ids = tenantWayuu.forms.map(f => f.id);
    expect(ids).toEqual(idsEsperados);
    expect(ids).not.toContain('frm-wayuu-108');
  });

  it('todos los campos de los 5 formularios usan tipos válidos de FIELD_TYPES', () => {
    for (const form of tenantWayuu.forms) {
      for (const campo of form.campos) {
        expect(FIELD_TYPES[campo.tipo], `${form.id}.${campo.name} tiene tipo "${campo.tipo}" inválido`).toBeDefined();
      }
    }
  });

  it('los campos "select" y "checklist" declaran opciones no vacías', () => {
    for (const form of tenantWayuu.forms) {
      for (const campo of form.campos) {
        if (campo.tipo === 'select' || campo.tipo === 'checklist') {
          expect(Array.isArray(campo.opciones) && campo.opciones.length > 0, `${form.id}.${campo.name}`).toBe(true);
        }
      }
    }
  });

  it('IND-1.1 e IND-2.1 tienen formula apuntando a un formulario y campo que existen de verdad', () => {
    const porCodigo = Object.fromEntries(tenantWayuu.indicators.map(i => [i.code, i]));
    const porId = Object.fromEntries(tenantWayuu.forms.map(f => [f.id, f]));

    const ind11 = porCodigo['IND-1.1'];
    expect(ind11.formula.operacion).toBe('suma');
    const form104 = porId[ind11.formula.fuente.formulario_id];
    expect(form104).toBeDefined();
    expect(form104.campos.some(c => c.name === ind11.formula.campo && c.tipo === 'num')).toBe(true);

    const ind21 = porCodigo['IND-2.1'];
    expect(ind21.formula.operacion).toBe('conteo');
    expect(porId[ind21.formula.fuente.formulario_id]).toBeDefined();
  });

  it('las encuestas legadas 101/102 solo usan tipos soportados por el motor legado (Surveys.jsx)', () => {
    const tiposLegado = new Set(['text', 'number', 'select', 'checklist', 'textarea']);
    for (const survey of tenantWayuu.surveys) {
      for (const campo of survey.schema.fields) {
        expect(tiposLegado.has(campo.type), `${survey.id}.${campo.name} usa tipo "${campo.type}" no soportado por el motor legado`).toBe(true);
      }
    }
  });

  it('srv-wayuu-101 incluye género, edad, experiencia de turismo y checklist de equipos de seguridad', () => {
    const s101 = tenantWayuu.surveys.find(s => s.id === 'srv-wayuu-101');
    const nombres = s101.schema.fields.map(f => f.name);
    expect(nombres).toEqual(expect.arrayContaining(['genero', 'edad', 'experiencia_turismo', 'equipos_seguridad_actuales']));
  });

  it('srv-wayuu-102 reemplaza el número de respeto cultural por un checklist de observables + intención de compra', () => {
    const s102 = tenantWayuu.surveys.find(s => s.id === 'srv-wayuu-102');
    const nombres = s102.schema.fields.map(f => f.name);
    expect(nombres).toContain('cultural_respect_checklist');
    expect(nombres).toContain('intencion_compra');
    expect(nombres).not.toContain('cultural_respect');
  });
});
