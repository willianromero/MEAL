import { DEFAULT_PQRS_LEVELS, DEFAULT_ROLE_NAMES } from './defaults.js';

// Tenant 2: Clínica Maicao (Reforma Laboral Ley 2466/2025).
// Demuestra la unidad de análisis configurable: aquí es "organización", no "comunidad".
const TENANT_ID = 'ten-maicao';
const PROJ_ID = 'proj-maicao-002';

export const tenantMaicao = {
  tenant: {
    id: TENANT_ID,
    nombre: 'Implementación Reforma Laboral — Clínica Maicao',
    financiador: 'Clínica Maicao S.A.S.',
    entidad_ejecutora: 'Fundación Guajira Competitiva',
    unidad_analisis_default: 'organizacion',
    moneda: 'COP',
    vigencia_inicio: '2026-03-30',
    vigencia_fin: '2026-09-30',
    estado: 'activo',
    config: {
      roles_nombres: { ...DEFAULT_ROLE_NAMES, gestor: 'Consultor de Campo' },
      pqrs_niveles: DEFAULT_PQRS_LEVELS,
      idiomas: ['es'],
      consentimiento: {
        finalidad: 'Diagnóstico organizacional y evaluación de riesgo psicosocial del personal de la Clínica Maicao, conforme a la Ley 1581 de 2012.',
        medios: ['fisico', 'digital']
      }
    }
  },

  lines: [
    {
      id: 'line-maicao-general',
      codigo: 'LG',
      nombre: 'Línea General de Consultoría',
      tipo: 'estructurada',
      orden: 1,
      fases: [
        { orden: 1, nombre: 'Diagnóstico jurídico y organizacional' },
        { orden: 2, nombre: 'Adecuación e implementación' },
        { orden: 3, nombre: 'Apropiación y cierre' }
      ]
    }
  ],

  units: [
    {
      id: 'unit-maicao-clinica',
      nombre: 'Clínica Maicao — Sede Principal',
      municipio: 'maicao',
      estado_reconocimiento: 'legalizada',
      autoridad_tradicional: null,
      geopunto: { lat: 11.3778, lng: -72.2394 },
      poblacion_estimada: 150,
      atributos: { tipo_organizacion: 'IPS de alta complejidad' }
    }
  ],

  projects: [
    {
      id: PROJ_ID,
      name: 'Implementación Reforma Laboral - Clínica Maicao',
      description: 'Diseño, adecuación e implementación del modelo laboral organizacional de la Clínica Maicao en el marco de la Ley 2466 de 2025 (Reforma Laboral), mitigando riesgos jurídicos y optimizando mallas de turnos de salud de alta complejidad.',
      linea_id: 'line-maicao-general',
      unidad_ids: ['unit-maicao-clinica'],
      tipo: 'consultoria',
      presupuesto: null,
      start_date: '2026-03-30',
      end_date: '2026-09-30',
      status: 'active'
    }
  ],

  logframes: [
    {
      id: 'lf-maicao-impact',
      project_id: PROJ_ID,
      type: 'impact',
      code: 'OBJ-G',
      description: 'Garantizar la adecuada implementación de la Reforma Laboral (Ley 2466 de 2025) en la Clínica Maicao mediante un modelo de transformación organizacional 360° para mitigar riesgos legales y optimizar la continuidad del servicio de salud.',
      parent_id: null
    },
    {
      id: 'lf-maicao-out1',
      project_id: PROJ_ID,
      type: 'outcome',
      code: 'R-1',
      description: 'Adecuación normativa, prevención de riesgo jurídico y fortalecimiento del marco legal institucional.',
      parent_id: 'lf-maicao-impact'
    },
    {
      id: 'lf-maicao-out2',
      project_id: PROJ_ID,
      type: 'outcome',
      code: 'R-2',
      description: 'Optimización de la estructura de jornada laboral, turnos, mallas, liquidación de nómina y recargos.',
      parent_id: 'lf-maicao-impact'
    },
    {
      id: 'lf-maicao-out3',
      project_id: PROJ_ID,
      type: 'outcome',
      code: 'R-3',
      description: 'Fortalecimiento del clima laboral, prevención de conflictos y cumplimiento de obligaciones en riesgo psicosocial.',
      parent_id: 'lf-maicao-impact'
    },
    {
      id: 'lf-maicao-out4',
      project_id: PROJ_ID,
      type: 'outcome',
      code: 'R-4',
      description: 'Apropiación institucional y capacitación del talento humano sobre los cambios derivados de la reforma laboral.',
      parent_id: 'lf-maicao-impact'
    },
    {
      id: 'lf-maicao-otp1.1',
      project_id: PROJ_ID,
      type: 'output',
      code: 'P-1.1',
      description: 'Políticas de contratación y modelos contractuales adaptados y redactados.',
      parent_id: 'lf-maicao-out1'
    },
    {
      id: 'lf-maicao-otp2.1',
      project_id: PROJ_ID,
      type: 'output',
      code: 'P-2.1',
      description: 'Manual de jornada laboral adaptado a 42 horas y mallas de turnos de salud optimizadas.',
      parent_id: 'lf-maicao-out2'
    },
    {
      id: 'lf-maicao-otp3.1',
      project_id: PROJ_ID,
      type: 'output',
      code: 'P-3.1',
      description: 'Protocolo de prevención del acoso laboral y diagnóstico psicosocial.',
      parent_id: 'lf-maicao-out3'
    },
    {
      id: 'lf-maicao-otp4.1',
      project_id: PROJ_ID,
      type: 'output',
      code: 'P-4.1',
      description: 'Talleres presenciales de formación ejecutados y kit pedagógico institucional de reforma.',
      parent_id: 'lf-maicao-out4'
    },
    {
      id: 'lf-maicao-act1.1',
      project_id: PROJ_ID,
      type: 'activity',
      code: 'A-1.1',
      description: 'Elaboración del informe diagnóstico jurídico de la Clínica y matriz de riesgos inicial.',
      parent_id: 'lf-maicao-otp1.1'
    },
    {
      id: 'lf-maicao-act2.1',
      project_id: PROJ_ID,
      type: 'activity',
      code: 'A-2.1',
      description: 'Ejecución de simulaciones financieras sobre el impacto de recargos nocturnos y dominicales.',
      parent_id: 'lf-maicao-otp2.1'
    },
    {
      id: 'lf-maicao-act3.1',
      project_id: PROJ_ID,
      type: 'activity',
      code: 'A-3.1',
      description: 'Aplicación de encuestas de evaluación del riesgo psicosocial del personal médico y administrativo.',
      parent_id: 'lf-maicao-otp3.1'
    },
    {
      id: 'lf-maicao-act4.1',
      project_id: PROJ_ID,
      type: 'activity',
      code: 'A-4.1',
      description: 'Diseño e impartición de talleres de gestión del cambio para coordinadores y jefes de área.',
      parent_id: 'lf-maicao-otp4.1'
    }
  ],

  indicators: [
    {
      id: 'ind-maicao-101',
      project_id: PROJ_ID,
      logframe_id: 'lf-maicao-out1',
      linea_id: 'line-maicao-general',
      code: 'IND-1.1',
      name: 'Porcentaje de adecuación jurídica de contratos del personal',
      unit: '%',
      baseline: 0,
      target: 100,
      actual: 0,
      meta_tipo: 'porcentaje',
      frecuencia: 'mensual',
      medio_verificacion: 'Matriz de contratos revisados y adendas firmadas',
      formula: null,
      linea_base_valor: 0,
      linea_base_congelada: false,
      meta_ajustable: false,
      disaggregated_data: null
    },
    {
      id: 'ind-maicao-201',
      project_id: PROJ_ID,
      logframe_id: 'lf-maicao-out2',
      linea_id: 'line-maicao-general',
      code: 'IND-2.1',
      name: 'Simulaciones financieras de nómina y turnos completadas y aprobadas',
      unit: 'Simulaciones',
      baseline: 0,
      target: 3,
      actual: 0,
      meta_tipo: 'numero',
      frecuencia: 'trimestral',
      medio_verificacion: 'Informes de simulación aprobados por gerencia',
      formula: null,
      linea_base_valor: 0,
      linea_base_congelada: false,
      meta_ajustable: false,
      disaggregated_data: null
    },
    {
      id: 'ind-maicao-301',
      project_id: PROJ_ID,
      logframe_id: 'lf-maicao-out3',
      linea_id: 'line-maicao-general',
      code: 'IND-3.1',
      name: 'Protocolo contra el acoso laboral socializado y aprobado',
      unit: 'Protocolo',
      baseline: 0,
      target: 1,
      actual: 0,
      meta_tipo: 'numero',
      frecuencia: 'final',
      medio_verificacion: 'Acta de aprobación del comité de convivencia',
      formula: null,
      linea_base_valor: 0,
      linea_base_congelada: false,
      meta_ajustable: false,
      disaggregated_data: null
    },
    {
      id: 'ind-maicao-401',
      project_id: PROJ_ID,
      logframe_id: 'lf-maicao-out4',
      linea_id: 'line-maicao-general',
      code: 'IND-4.1',
      name: 'Colaboradores de la clínica capacitados en gestión del cambio',
      unit: 'Colaboradores',
      baseline: 0,
      target: 150,
      actual: 0,
      meta_tipo: 'numero',
      frecuencia: 'mensual',
      medio_verificacion: 'Listados de asistencia a talleres con firma',
      formula: null,
      linea_base_valor: 0,
      linea_base_congelada: false,
      meta_ajustable: false,
      disaggregated_data: null
    }
  ]
};
