// Segundo tenant SOLO PARA PRUEBAS: el gate de aislamiento (DRT 13.2-2) exige
// al menos dos proyectos con datos para demostrar cero fugas entre ellos. No
// se siembra en la app ni en la base de producción.
export const tenantPrueba = {
  tenant: {
    id: 'ten-prueba',
    nombre: 'Proyecto de prueba (aislamiento)',
    financiador: 'N/A',
    entidad_ejecutora: 'N/A',
    unidad_analisis_default: 'comunidad',
    moneda: 'COP',
    estado: 'activo',
    config: {}
  },
  lines: [{ id: 'line-prueba-1', codigo: 'LP', nombre: 'Línea de prueba', tipo: 'flexible', orden: 1, fases: [] }],
  units: [
    { id: 'unit-prueba-1', nombre: 'Unidad de prueba 1', municipio: 'riohacha', atributos: {} },
    { id: 'unit-prueba-2', nombre: 'Unidad de prueba 2', municipio: 'manaure', atributos: {} }
  ],
  projects: [{ id: 'proj-prueba-1', name: 'Proyecto de prueba', linea_id: 'line-prueba-1', unidad_ids: ['unit-prueba-1'], status: 'active' }],
  logframes: [{ id: 'lf-prueba-impact', project_id: 'proj-prueba-1', type: 'impact', code: 'OBJ-G', description: 'Objetivo de prueba', parent_id: null }],
  indicators: [{ id: 'ind-prueba-1', project_id: 'proj-prueba-1', logframe_id: 'lf-prueba-impact', linea_id: 'line-prueba-1', code: 'IND-1.1', name: 'Indicador de prueba', unit: 'Unidades', target: 10, actual: 0, meta_tipo: 'numero', frecuencia: 'mensual' }],
  forms: [{ id: 'frm-prueba-1', codigo: 'F-P1', nombre: 'Formulario de prueba', version: 1, linea_id: 'line-prueba-1', activo: true, campos: [] }]
};
