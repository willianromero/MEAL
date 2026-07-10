// ============================================================================
// Generación automática de códigos (marco lógico e indicadores).
//
// Elimina la captura manual de códigos, fuente de errores del usuario (ej.
// duplicar un código o transcribirlo distinto al de un informe externo).
// Las reglas replican el patrón que ya usan los datos sembrados del sistema:
//   Impacto:    OBJ-G           (OBJ-G2, OBJ-G3... si hay más de uno)
//   Resultado:  R-{n}            n = posición entre los resultados del proyecto
//   Producto:   P-{r}.{n}        r = número del resultado padre, n = posición
//   Actividad:  A-{r}.{n}        r = número del producto padre, n = posición
//   Indicador:  IND-{r}.{n}      r = número del resultado ancestro, n = posición
// ============================================================================

// Extrae el primer número de un código (ej. "R-3" -> "3", "P-3.1" -> "3").
function extractNumber(code) {
  const m = /(\d+)/.exec(code || '');
  return m ? m[1] : '1';
}

// Genera el código de un nodo del marco lógico dado su tipo, el nodo padre
// (o null si es impacto) y la lista de nodos hermanos ya existentes (mismo
// tipo y mismo parent_id).
export function generateNodeCode(type, parentNode, siblings = []) {
  const n = siblings.length + 1;
  switch (type) {
    case 'impact':
      return n === 1 ? 'OBJ-G' : `OBJ-G${n}`;
    case 'outcome':
      return `R-${n}`;
    case 'output':
      return `P-${extractNumber(parentNode?.code)}.${n}`;
    case 'activity':
      return `A-${extractNumber(parentNode?.code)}.${n}`;
    default:
      return `N-${n}`;
  }
}

// Sube por la cadena de parent_id hasta encontrar el ancestro tipo 'outcome'
// (o el propio nodo si ya es outcome). Si no encuentra ninguno, usa el nodo
// tal cual (fallback razonable para indicadores estratégicos/transversales).
function findOutcomeAncestor(node, allNodes) {
  let current = node;
  const byId = new Map(allNodes.map(n => [n.id, n]));
  let guard = 0;
  while (current && current.type !== 'outcome' && guard < 10) {
    if (!current.parent_id) break;
    current = byId.get(current.parent_id);
    guard += 1;
  }
  return current || node;
}

// Genera el código de un indicador nuevo a partir del componente de marco
// lógico seleccionado. `existingIndicators` son los indicadores ya creados
// en el mismo proyecto (para calcular la posición `n`).
export function generateIndicatorCode(selectedLogframeNode, allLogframeNodes, existingIndicators = []) {
  if (!selectedLogframeNode) return '';
  const outcomeNode = findOutcomeAncestor(selectedLogframeNode, allLogframeNodes);
  const r = extractNumber(outcomeNode?.code || selectedLogframeNode.code);
  const prefix = `IND-${r}.`;
  const n = existingIndicators.filter(i => (i.code || '').startsWith(prefix)).length + 1;
  return `${prefix}${n}`;
}
