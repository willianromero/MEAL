import { evaluateRule } from './rulesEngine';

// ============================================================================
// Motor de cálculo de indicadores (DRT Sección 9.3, M7).
// Interpreta una fórmula JSON sobre los registros de campo VALIDADOS y produce
// un valor por período/unidad + semáforo contra la meta. Cero dependencias.
// ============================================================================

// Estructura de fórmula (jsonb del indicador):
// {
//   fuente: { formulario_id?, formulario_codigo? },  // de qué formulario sale
//   operacion: 'conteo' | 'suma' | 'promedio' | 'porcentaje',
//   campo?: 'num_asistentes',        // para suma/promedio y numerador de %
//   filtro?: <regla rulesEngine>,     // condición sobre { datos, answers }
//   denominador?: { filtro?, campo? } // para porcentaje
// }

// Filtra los registros validados que alimentan un indicador.
function baseRecords(indicator, records) {
  const f = indicator.formula || {};
  const src = f.fuente || {};
  return records.filter(r =>
    r.estado_validacion === 'validado' &&
    (!src.formulario_id || r.formulario_id === src.formulario_id)
  );
}

function matchesFilter(record, rule) {
  if (!rule) return true;
  return evaluateRule(rule, { datos: record.datos || {}, answers: record.datos || {} });
}

function numericField(record, campo) {
  const v = (record.datos || {})[campo];
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

// Calcula el valor bruto del indicador a partir de su fórmula y registros.
// Si el indicador no tiene fórmula, cae en su campo `actual` (compatibilidad).
export function computeIndicatorValue(indicator, records) {
  const f = indicator.formula;
  if (!f || !f.operacion) {
    return typeof indicator.actual === 'number' ? indicator.actual : 0;
  }
  const rows = baseRecords(indicator, records).filter(r => matchesFilter(r, f.filtro));

  switch (f.operacion) {
    case 'conteo':
      return rows.length;
    case 'suma':
      return rows.reduce((a, r) => a + numericField(r, f.campo), 0);
    case 'promedio':
      return rows.length ? rows.reduce((a, r) => a + numericField(r, f.campo), 0) / rows.length : 0;
    case 'porcentaje': {
      const den = f.denominador || {};
      const denomRows = baseRecords(indicator, records).filter(r => matchesFilter(r, den.filtro));
      const numerador = f.campo ? rows.reduce((a, r) => a + numericField(r, f.campo), 0) : rows.length;
      const denominador = den.campo ? denomRows.reduce((a, r) => a + numericField(r, den.campo), 0) : denomRows.length;
      return denominador > 0 ? Math.round((numerador / denominador) * 100) : 0;
    }
    default:
      return 0;
  }
}

// Semáforo contra la meta (DRT 9.3): verde ≥ meta, amarillo en tolerancia, rojo abajo.
// tolerancia por defecto: 95% de la meta = amarillo (umbral RF-DASH-3).
export function semaforo(valor, meta, tolerancia = 0.95) {
  if (meta == null || meta === 0) return 'verde';
  const ratio = valor / meta;
  if (ratio >= 1) return 'verde';
  if (ratio >= tolerancia) return 'amarillo';
  return 'rojo';
}

// Progreso porcentual (capado a 100 para barras).
export function progresoPct(valor, meta) {
  if (!meta || meta === 0) return 0;
  return Math.min(100, Math.round((valor / meta) * 100));
}

// Recalcula todos los indicadores del tenant y devuelve filas indicator_values.
// periodo: 'YYYY-MM-01' (mes de corte). Solo cuenta registros validados.
export function recalcIndicators({ indicators, records, periodo }) {
  return indicators.map(ind => {
    const valor = computeIndicatorValue(ind, records);
    return {
      indicador_id: ind.id,
      tenant_id: ind.tenant_id,
      periodo,
      valor,
      semaforo: semaforo(valor, ind.target),
      meta: ind.target,
      linea_base: ind.linea_base_valor
    };
  });
}

// Detección de duplicados por regla de negocio (RF-CAL-2): mismo formulario +
// misma unidad + mismo día de captura. Devuelve un Set de ids sospechosos.
export function detectDuplicates(records) {
  const seen = new Map();
  const dup = new Set();
  for (const r of records) {
    const dia = (r.capturado_at || '').slice(0, 10);
    const key = `${r.formulario_id}|${r.unidad_id}|${dia}`;
    if (seen.has(key)) { dup.add(r.id); dup.add(seen.get(key)); }
    else seen.set(key, r.id);
  }
  return dup;
}
