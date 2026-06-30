/**
 * Motor de Reglas Determinista para Evaluación de Indicadores en Tiempo Real (Offline-First)
 * Cero dependencias externas.
 */

/**
 * Evalúa una regla lógica o matemática sobre un conjunto de datos (payload).
 * @param {Object} rule - Definición de la regla en formato JSON.
 * @param {Object} data - Datos a evaluar (ej: respuestas de una encuesta).
 * @returns {boolean} - Resultado de la evaluación.
 */
export function evaluateRule(rule, data) {
  if (!rule || typeof rule !== 'object') return false;

  // 1. Operadores Lógicos (and, or, not)
  if (rule.operator === 'and') {
    if (!Array.isArray(rule.rules) || rule.rules.length === 0) return false;
    return rule.rules.every(r => evaluateRule(r, data));
  }

  if (rule.operator === 'or') {
    if (!Array.isArray(rule.rules) || rule.rules.length === 0) return false;
    return rule.rules.some(r => evaluateRule(r, data));
  }

  if (rule.operator === 'not') {
    return !evaluateRule(rule.rule, data);
  }

  // 2. Operadores de Comparación Hojas (field, operator, value)
  const { field, operator, value } = rule;
  if (!field) return false;

  // Soporte para leer campos anidados (ej: "metadata.age" o "answers.family_count")
  const fieldValue = getValueByPath(data, field);

  switch (operator) {
    case 'equals':
      return String(fieldValue) === String(value);
    
    case 'not_equals':
      return String(fieldValue) !== String(value);
    
    case 'gt':
      return Number(fieldValue) > Number(value);
    
    case 'gte':
      return Number(fieldValue) >= Number(value);
    
    case 'lt':
      return Number(fieldValue) < Number(value);
    
    case 'lte':
      return Number(fieldValue) <= Number(value);
    
    case 'contains':
      if (typeof fieldValue === 'string') {
        return fieldValue.toLowerCase().includes(String(value).toLowerCase());
      }
      if (Array.isArray(fieldValue)) {
        return fieldValue.includes(value);
      }
      return false;
      
    case 'in':
      if (Array.isArray(value)) {
        return value.map(String).includes(String(fieldValue));
      }
      return false;
      
    case 'exists':
      return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';

    default:
      console.warn(`[Rules Engine] Operador desconocido: ${operator}`);
      return false;
  }
}

/**
 * Utilidad recursiva para extraer valores de objetos usando rutas con puntos (ej: "parent.child.grandchild")
 */
function getValueByPath(obj, path) {
  if (!obj || !path) return undefined;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Calcula un indicador ponderado o puntaje basado en un conjunto de reglas.
 * Útil para evaluar índices complejos (ej. Carencias del Pescador).
 * @param {Array} criteriaList - Lista de criterios [{ rule, score }]
 * @param {Object} data - Datos de entrada.
 * @returns {number} - Puntaje final consolidado.
 */
export function calculateWeightedScore(criteriaList, data) {
  if (!Array.isArray(criteriaList)) return 0;
  return criteriaList.reduce((acc, criterion) => {
    const matched = evaluateRule(criterion.rule, data);
    return acc + (matched ? (criterion.score || 0) : 0);
  }, 0);
}
