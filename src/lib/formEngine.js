import { evaluateRule } from './rulesEngine';

// ============================================================================
// Motor de formularios configurables (DRT RF-FRM-1..4).
// Define los 9 tipos de campo, valida por campo y resuelve dependencias
// condicionales reutilizando el rulesEngine JSON existente.
// ============================================================================

// Tipos de campo soportados (RF-FRM-1)
export const FIELD_TYPES = {
  texto: { label: 'Texto', input: 'text' },
  num: { label: 'Número', input: 'number' },
  fecha: { label: 'Fecha', input: 'date' },
  select: { label: 'Selección', input: 'select' },
  geo: { label: 'Geopunto (GPS)', input: 'geo' },
  foto: { label: 'Fotografía', input: 'foto' },
  firma: { label: 'Firma', input: 'firma' },
  bool: { label: 'Sí / No', input: 'bool' },
  escala: { label: 'Escala 1-5', input: 'escala' },
  checklist: { label: 'Lista de chequeo (varias opciones)', input: 'checklist' }
};

// ¿Debe mostrarse el campo dado el estado actual del formulario?
// Un campo con `mostrar_si` (regla JSON del rulesEngine) es condicional.
export function isFieldVisible(campo, datos) {
  if (!campo.mostrar_si) return true;
  return evaluateRule(campo.mostrar_si, { datos, answers: datos });
}

// Valida un campo individual. Devuelve un string de error o null si es válido.
export function validateField(campo, valor, datos) {
  if (!isFieldVisible(campo, datos)) return null; // los ocultos no se validan

  const vacio = valor === undefined || valor === null || valor === '' ||
    (campo.tipo === 'geo' && (!valor || valor.lat == null)) ||
    (campo.tipo === 'checklist' && (!Array.isArray(valor) || valor.length === 0));

  if (campo.obligatorio && vacio) {
    return `El campo "${campo.etiqueta_es}" es obligatorio.`;
  }
  if (vacio) return null; // opcional sin dato: válido

  const reglas = campo.reglas_validacion || {};
  if (campo.tipo === 'num' || campo.tipo === 'escala') {
    const n = Number(valor);
    if (Number.isNaN(n)) return `"${campo.etiqueta_es}" debe ser un número.`;
    if (reglas.min != null && n < reglas.min) return `"${campo.etiqueta_es}" debe ser ≥ ${reglas.min}.`;
    if (reglas.max != null && n > reglas.max) return `"${campo.etiqueta_es}" debe ser ≤ ${reglas.max}.`;
    if (campo.tipo === 'escala' && (n < 1 || n > 5)) return `"${campo.etiqueta_es}" debe estar entre 1 y 5.`;
  }
  if (campo.tipo === 'texto' && reglas.patron) {
    try {
      if (!new RegExp(reglas.patron).test(String(valor))) {
        return reglas.mensaje || `"${campo.etiqueta_es}" tiene un formato inválido.`;
      }
    } catch { /* patrón inválido en config: se ignora */ }
  }
  if (campo.tipo === 'select' && Array.isArray(campo.opciones) && !campo.opciones.includes(valor)) {
    return `"${campo.etiqueta_es}": opción no válida.`;
  }
  if (campo.tipo === 'checklist' && Array.isArray(campo.opciones) && campo.opciones.length > 0) {
    const invalida = valor.find(v => !campo.opciones.includes(v));
    if (invalida) return `"${campo.etiqueta_es}": opción "${invalida}" no válida.`;
  }
  return null;
}

// Valida un formulario completo. Devuelve { valido, errores: {campo: msg} }.
export function validateForm(form, datos) {
  const errores = {};
  for (const campo of (form.campos || [])) {
    const err = validateField(campo, datos[campo.name], datos);
    if (err) errores[campo.name] = err;
  }
  return { valido: Object.keys(errores).length === 0, errores };
}

// Etiqueta bilingüe según idioma preferido (RF-FRM-5), con fallback a español.
export function fieldLabel(campo, idioma = 'es') {
  if (idioma === 'way' && campo.etiqueta_way) return campo.etiqueta_way;
  return campo.etiqueta_es || campo.name;
}
