import { describe, it, expect } from 'vitest';
import { generateNodeCode, generateIndicatorCode } from '../lib/codeGenerator';

describe('generateNodeCode — reproduce el patrón de los datos sembrados', () => {
  it('el primer impacto es OBJ-G; el segundo, OBJ-G2', () => {
    expect(generateNodeCode('impact', null, [])).toBe('OBJ-G');
    expect(generateNodeCode('impact', null, [{ code: 'OBJ-G' }])).toBe('OBJ-G2');
  });

  it('los resultados se numeran secuencialmente bajo el mismo impacto (R-1..R-4)', () => {
    const impact = { code: 'OBJ-G' };
    expect(generateNodeCode('outcome', impact, [])).toBe('R-1');
    expect(generateNodeCode('outcome', impact, [{ code: 'R-1' }])).toBe('R-2');
    expect(generateNodeCode('outcome', impact, [{ code: 'R-1' }, { code: 'R-2' }, { code: 'R-3' }])).toBe('R-4');
  });

  it('los productos heredan el número del resultado padre (P-3.1 bajo R-3)', () => {
    const outcomeR3 = { code: 'R-3' };
    expect(generateNodeCode('output', outcomeR3, [])).toBe('P-3.1');
    expect(generateNodeCode('output', outcomeR3, [{ code: 'P-3.1' }])).toBe('P-3.2');
  });

  it('las actividades heredan el número del producto padre (A-2.1, A-2.2 bajo P-2.1)', () => {
    const outputP2 = { code: 'P-2.1' };
    expect(generateNodeCode('activity', outputP2, [])).toBe('A-2.1');
    expect(generateNodeCode('activity', outputP2, [{ code: 'A-2.1' }])).toBe('A-2.2');
  });
});

describe('generateIndicatorCode — reproduce IND-{resultado}.{n}', () => {
  const impact = { id: 'imp', type: 'impact', code: 'OBJ-G', parent_id: null };
  const r1 = { id: 'r1', type: 'outcome', code: 'R-1', parent_id: 'imp' };
  const r2 = { id: 'r2', type: 'outcome', code: 'R-2', parent_id: 'imp' };
  const p11 = { id: 'p11', type: 'output', code: 'P-1.1', parent_id: 'r1' };
  const allNodes = [impact, r1, r2, p11];

  it('primer indicador de un resultado sin indicadores previos -> IND-1.1', () => {
    expect(generateIndicatorCode(r1, allNodes, [])).toBe('IND-1.1');
  });

  it('segundo indicador del mismo resultado -> IND-1.2 (coincide con el seed real de Wayuu)', () => {
    const existentes = [{ code: 'IND-1.1' }];
    expect(generateIndicatorCode(r1, allNodes, existentes)).toBe('IND-1.2');
  });

  it('un indicador de otro resultado no interfiere con el conteo (IND-2.1)', () => {
    const existentes = [{ code: 'IND-1.1' }, { code: 'IND-1.2' }];
    expect(generateIndicatorCode(r2, allNodes, existentes)).toBe('IND-2.1');
  });

  it('si se selecciona un producto (nivel más profundo), sube al resultado ancestro (P-1.1 -> R-1 -> IND-1.x)', () => {
    expect(generateIndicatorCode(p11, allNodes, [])).toBe('IND-1.1');
  });

  it('sin nodo seleccionado, devuelve cadena vacía (aún no hay nada que mostrar)', () => {
    expect(generateIndicatorCode(null, allNodes, [])).toBe('');
  });
});
