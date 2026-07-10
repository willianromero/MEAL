// Traduce el estado del editor de fórmula (Indicators.jsx, sección "Cálculo
// automático") a un `indicator.formula` que indicatorEngine.js sabe interpretar.
// Separado en su propio módulo para poder probarlo sin renderizar React.
export function buildFormula(def) {
  if (!def.formularioId) return null; // indicador manual: sin fuente, sin fórmula
  const formula = { fuente: { formulario_id: def.formularioId }, operacion: def.operacion };
  if (def.operacion !== 'conteo' && def.campo) formula.campo = def.campo;
  if (def.operacion === 'porcentaje' && def.filtroCampo && def.filtroValor !== '') {
    formula.filtro = { field: `datos.${def.filtroCampo}`, operator: 'equals', value: def.filtroValor };
  }
  return formula;
}

// Inversa: reconstruye el estado del editor a partir de un indicator.formula
// existente (para precargar el formulario al abrir "Editar definición").
export function formulaToDefState(formula) {
  const f = formula || {};
  return {
    formularioId: f.fuente?.formulario_id || '',
    operacion: f.operacion || 'conteo',
    campo: f.campo || '',
    filtroCampo: f.filtro?.field?.replace(/^datos\./, '') || '',
    filtroValor: f.filtro?.value ?? ''
  };
}
