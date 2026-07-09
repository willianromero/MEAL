import { DEFAULT_PQRS_LEVELS } from './defaults.js';

// Tenant 3: Convenio Asociación Guajira (Ecopetrol–Hocol) 2026.
// Configuración según el Anexo E del DRT v2.0: TODO lo específico del convenio
// vive aquí como datos, no como lógica de la plataforma.
const TENANT_ID = 'ten-hocol';

// 36 comunidades Wayuu en Riohacha y Manaure (Anexo E). Los nombres reales,
// autoridades tradicionales y coordenadas se cargan durante el onboarding del
// convenio; aquí se crean las 36 posiciones como configuración editable.
const units = Array.from({ length: 36 }, (_, i) => {
  const n = String(i + 1).padStart(2, '0');
  const municipio = i < 18 ? 'riohacha' : 'manaure';
  return {
    id: `unit-hocol-${n}`,
    nombre: `Comunidad Wayuu ${n} — ${municipio === 'riohacha' ? 'Riohacha' : 'Manaure'} (nombre por confirmar en onboarding)`,
    municipio,
    estado_reconocimiento: 'en_proceso',
    autoridad_tradicional: null,
    geopunto: null,
    poblacion_estimada: null,
    atributos: {}
  };
});

// Líneas programáticas del convenio (Anexo E): L1 estructurada con 6 fases,
// L2–L5 flexibles sujetas a priorización del financiador, + eje transversal MEAL.
const lines = [
  {
    id: 'line-hocol-l1',
    codigo: 'L1',
    nombre: 'L1 — Fortalecimiento comunitario',
    tipo: 'estructurada',
    orden: 1,
    fases: [
      { orden: 1, nombre: 'Diagnóstico' },
      { orden: 2, nombre: 'Caracterización' },
      { orden: 3, nombre: 'Plan de fortalecimiento' },
      { orden: 4, nombre: 'Formulación de proyectos' },
      { orden: 5, nombre: 'Implementación y planes de inversión' },
      { orden: 6, nombre: 'Sostenibilidad' }
    ]
  },
  { id: 'line-hocol-l2', codigo: 'L2', nombre: 'L2 — Atención de solicitudes', tipo: 'flexible', orden: 2, fases: [] },
  { id: 'line-hocol-l3', codigo: 'L3', nombre: 'L3 — Cultura y patrimonio', tipo: 'flexible', orden: 3, fases: [] },
  { id: 'line-hocol-l4', codigo: 'L4', nombre: 'L4 — Apoyos humanitarios y usos y costumbres', tipo: 'flexible', orden: 4, fases: [] },
  { id: 'line-hocol-l5', codigo: 'L5', nombre: 'L5 — Salud', tipo: 'flexible', orden: 5, fases: [] },
  { id: 'line-hocol-meal', codigo: 'MEAL', nombre: 'Eje transversal MEAL', tipo: 'transversal', orden: 6, fases: [] }
];

// Constructor compacto de indicadores del catálogo (DRT Sección 9.2, tablas 8.1–8.7).
// meta_valor null = meta abierta/ajustable "según priorización del financiador" (9.4).
let indSeq = 0;
function ind(code, name, lineaId, target, metaTipo, frecuencia, medioVerificacion, opts = {}) {
  indSeq += 1;
  return {
    id: `ind-hocol-${String(indSeq).padStart(3, '0')}`,
    project_id: null,
    logframe_id: null,
    linea_id: lineaId,
    code,
    name,
    unit: metaTipo === 'porcentaje' ? '%' : (opts.unit || 'Unidades'),
    baseline: null,
    target,
    actual: 0,
    meta_tipo: metaTipo,
    frecuencia,
    medio_verificacion: medioVerificacion,
    formula: opts.formula || null,
    linea_base_valor: null, // se congela al mes 3 (RF-IND-4)
    linea_base_congelada: false,
    meta_ajustable: opts.ajustable || target === null,
    disaggregated_data: null
  };
}

const indicators = [
  // --- Estratégicos del convenio (tabla 8.1) ---
  ind('IND-EST-01', 'Comunidades fortalecidas', null, 36, 'numero', 'final', 'Actas de cierre de fase por comunidad', { unit: 'Comunidades' }),
  ind('IND-EST-02', 'Proyectos comunitarios formulados', null, 36, 'numero', 'trimestral', 'Documentos de proyecto formulados', { unit: 'Proyectos' }),
  ind('IND-EST-03', 'Proyectos comunitarios implementados', null, 36, 'numero', 'trimestral', 'Actas de entrega e informes de implementación', { unit: 'Proyectos' }),
  ind('IND-EST-04', 'Cumplimiento físico del convenio', null, 95, 'porcentaje', 'mensual', 'Tablero de control — avance físico'),
  ind('IND-EST-05', 'Ejecución financiera del convenio', null, 95, 'porcentaje', 'mensual', 'Informe financiero mensual'),
  ind('IND-EST-06', 'Cumplimiento de cronograma', null, 95, 'porcentaje', 'mensual', 'Cronograma actualizado vs ejecutado'),
  ind('IND-EST-07', 'Trazabilidad documental', null, 100, 'porcentaje', 'continua', 'Repositorio documental con evidencias enlazadas'),
  ind('IND-EST-08', 'Satisfacción del financiador', null, 90, 'porcentaje', 'semestral', 'Encuesta de satisfacción Hocol'),

  // --- Línea 1: Fortalecimiento (tabla 8.2) ---
  ind('IND-L1-01', 'Diagnósticos comunitarios realizados', 'line-hocol-l1', 36, 'numero', 'mensual', 'Fichas de diagnóstico validadas', { unit: 'Diagnósticos' }),
  ind('IND-L1-02', 'Comunidades caracterizadas', 'line-hocol-l1', 36, 'numero', 'mensual', 'Fichas de caracterización validadas', { unit: 'Comunidades' }),
  ind('IND-L1-03', 'Planes de fortalecimiento elaborados', 'line-hocol-l1', 36, 'numero', 'trimestral', 'Planes de fortalecimiento aprobados', { unit: 'Planes' }),
  ind('IND-L1-04', 'Proyectos formulados (L1)', 'line-hocol-l1', 36, 'numero', 'trimestral', 'Documentos de formulación', { unit: 'Proyectos' }),
  ind('IND-L1-05', 'Proyectos implementados (L1)', 'line-hocol-l1', 36, 'numero', 'trimestral', 'Actas de implementación', { unit: 'Proyectos' }),
  ind('IND-L1-06', 'Planes de inversión ejecutados', 'line-hocol-l1', 36, 'numero', 'trimestral', 'Soportes de ejecución de inversión', { unit: 'Planes' }),
  ind('IND-L1-07', 'Culminación de procesos de formación', 'line-hocol-l1', 90, 'porcentaje', 'trimestral', 'Registros de asistencia y certificados'),
  ind('IND-L1-08', 'Estrategia de sostenibilidad formulada', 'line-hocol-l1', 1, 'numero', 'final', 'Documento de estrategia aprobado', { unit: 'Documento' }),

  // --- Línea 2: Solicitudes (tabla 8.3; metas según priorización de Hocol) ---
  ind('IND-L2-01', 'Solicitudes atendidas', 'line-hocol-l2', null, 'numero', 'mensual', 'Registros de solicitud con cierre técnico', { unit: 'Solicitudes', ajustable: true }),
  ind('IND-L2-02', 'Solicitudes con cierre técnico', 'line-hocol-l2', 100, 'porcentaje', 'mensual', 'Actas de cierre técnico'),
  ind('IND-L2-03', 'Solicitudes atendidas en tiempo', 'line-hocol-l2', 90, 'porcentaje', 'mensual', 'Comparativo fecha solicitud vs atención'),
  ind('IND-L2-04', 'Trazabilidad de solicitudes', 'line-hocol-l2', 100, 'porcentaje', 'continua', 'Expedientes con evidencias completas'),

  // --- Línea 3: Cultura (tabla 8.4) ---
  ind('IND-L3-01', 'Iniciativas culturales apoyadas', 'line-hocol-l3', null, 'numero', 'trimestral', 'Registros de apoyo cultural', { unit: 'Iniciativas', ajustable: true }),
  ind('IND-L3-02', 'Actividades de patrimonio realizadas', 'line-hocol-l3', null, 'numero', 'trimestral', 'Registros de actividad con evidencia', { unit: 'Actividades', ajustable: true }),
  ind('IND-L3-03', 'Participantes en actividades culturales', 'line-hocol-l3', null, 'numero', 'trimestral', 'Registros de asistencia', { unit: 'Personas', ajustable: true }),
  ind('IND-L3-04', 'Satisfacción con actividades culturales', 'line-hocol-l3', 90, 'porcentaje', 'semestral', 'Encuestas de satisfacción'),

  // --- Línea 4: Humanitarios y usos y costumbres (tabla 8.5) ---
  ind('IND-L4-01', 'Apoyos humanitarios ejecutados', 'line-hocol-l4', null, 'numero', 'mensual', 'Registros de apoyo con acta de entrega', { unit: 'Apoyos', ajustable: true }),
  ind('IND-L4-02', 'Atenciones de usos y costumbres', 'line-hocol-l4', null, 'numero', 'mensual', 'Registros de atención', { unit: 'Atenciones', ajustable: true }),
  ind('IND-L4-03', 'Trazabilidad de apoyos (L4)', 'line-hocol-l4', 100, 'porcentaje', 'continua', 'Expedientes con evidencias completas'),
  ind('IND-L4-04', 'Satisfacción con apoyos (L4)', 'line-hocol-l4', 90, 'porcentaje', 'semestral', 'Encuestas de satisfacción'),

  // --- Línea 5: Salud (tabla 8.6) ---
  ind('IND-L5-01', 'Jornadas y acciones de salud realizadas', 'line-hocol-l5', null, 'numero', 'mensual', 'Registros de atención en salud', { unit: 'Jornadas', ajustable: true }),
  ind('IND-L5-02', 'Personas beneficiadas en salud', 'line-hocol-l5', null, 'numero', 'mensual', 'Registros de atención individual', { unit: 'Personas', ajustable: true }),
  ind('IND-L5-03', 'Instituciones de salud articuladas', 'line-hocol-l5', null, 'numero', 'trimestral', 'Convenios/actas de articulación', { unit: 'Instituciones', ajustable: true }),
  ind('IND-L5-04', 'Satisfacción con jornadas de salud', 'line-hocol-l5', 90, 'porcentaje', 'semestral', 'Encuestas de satisfacción'),

  // --- Transversales MEAL (tabla 8.7) ---
  ind('IND-MEAL-01', 'Línea base consolidada', 'line-hocol-meal', 1, 'numero', 'final', 'Documento de línea base congelado', { unit: 'Documento' }),
  ind('IND-MEAL-02', 'Sistema MEAL en operación', 'line-hocol-meal', 1, 'numero', 'continua', 'Plataforma operativa con usuarios activos', { unit: 'Sistema' }),
  ind('IND-MEAL-03', 'Tablero de control actualizado mensualmente', 'line-hocol-meal', 100, 'porcentaje', 'mensual', 'Bitácora de actualización del tablero'),
  ind('IND-MEAL-04', 'Indicadores actualizados al día', 'line-hocol-meal', 100, 'porcentaje', 'mensual', 'Reporte de vigencia de indicadores'),
  ind('IND-MEAL-05', 'Informes técnicos mensuales entregados', 'line-hocol-meal', 12, 'numero', 'mensual', 'Informes técnicos radicados', { unit: 'Informes' }),
  ind('IND-MEAL-06', 'Informes financieros mensuales entregados', 'line-hocol-meal', 12, 'numero', 'mensual', 'Informes financieros radicados', { unit: 'Informes' }),
  ind('IND-MEAL-07', 'Informes de seguimiento entregados', 'line-hocol-meal', 12, 'numero', 'mensual', 'Informes de seguimiento radicados', { unit: 'Informes' }),
  ind('IND-MEAL-08', 'Evaluación final realizada', 'line-hocol-meal', 1, 'numero', 'final', 'Informe de evaluación final', { unit: 'Evaluación' }),
  ind('IND-MEAL-09', 'Evaluación de impacto realizada', 'line-hocol-meal', 1, 'numero', 'final', 'Informe de evaluación de impacto', { unit: 'Evaluación' }),
  ind('IND-MEAL-10', 'Documento de lecciones aprendidas', 'line-hocol-meal', 1, 'numero', 'final', 'Documento consolidado de lecciones', { unit: 'Documento' }),
  ind('IND-MEAL-11', 'Banco de evidencias consolidado', 'line-hocol-meal', 1, 'numero', 'continua', 'Repositorio documental completo', { unit: 'Repositorio' }),
  ind('IND-MEAL-12', 'Trazabilidad extremo a extremo', 'line-hocol-meal', 100, 'porcentaje', 'continua', 'Auditoría de reconstrucción de indicadores')
];

// Formularios base del convenio (RF-FRM-2, Anexo E). Tipos de campo del RF-FRM-1:
// texto, num, fecha, select, geo, foto, firma, bool, escala.
// Campos representativos; el Administrador de Tenant los amplía sin recompilar (HU-09).
function form(id, codigo, nombre, lineaId, campos) {
  return { id, codigo, nombre, linea_id: lineaId, version: 1, activo: true, campos };
}
const campoBase = (name, etiqueta, tipo, extra = {}) => ({
  name, etiqueta_es: etiqueta, etiqueta_way: null, tipo, obligatorio: true, reglas_validacion: null, ...extra
});

const forms = [
  form('frm-hocol-lineabase', 'F-LB', 'Encuesta de línea base comunitaria', 'line-hocol-l1', [
    campoBase('comunidad_confirma', 'Comunidad donde se aplica', 'texto'),
    campoBase('fecha_aplicacion', 'Fecha de aplicación', 'fecha'),
    campoBase('geopunto', 'Ubicación de la aplicación', 'geo'),
    campoBase('poblacion_total', 'Población total estimada de la comunidad', 'num'),
    campoBase('familias', 'Número de familias', 'num'),
    campoBase('acceso_agua', '¿La comunidad cuenta con acceso a agua?', 'bool'),
    campoBase('fuente_ingresos', 'Principal fuente de ingresos', 'select', { opciones: ['Pastoreo', 'Artesanías', 'Pesca', 'Comercio', 'Jornaleo', 'Otra'] }),
    campoBase('observaciones', 'Observaciones generales', 'texto', { obligatorio: false })
  ]),
  form('frm-hocol-caracterizacion', 'F-CAR', 'Ficha de caracterización comunitaria', 'line-hocol-l1', [
    campoBase('autoridad', 'Autoridad tradicional de la comunidad', 'texto'),
    campoBase('estado_reconocimiento', 'Estado de reconocimiento', 'select', { opciones: ['Legalizada', 'En proceso'] }),
    campoBase('geopunto', 'Coordenadas de la comunidad', 'geo'),
    campoBase('foto_panoramica', 'Foto panorámica de la comunidad', 'foto'),
    campoBase('organizaciones', 'Organizaciones presentes en la comunidad', 'texto', { obligatorio: false })
  ]),
  form('frm-hocol-asistencia', 'F-ASI', 'Registro de asistencia', 'line-hocol-l1', [
    campoBase('actividad', 'Nombre de la actividad', 'texto'),
    campoBase('fecha', 'Fecha de la actividad', 'fecha'),
    campoBase('num_asistentes', 'Número de asistentes', 'num'),
    campoBase('num_mujeres', 'Número de mujeres asistentes', 'num'),
    campoBase('foto_asistencia', 'Foto del listado de asistencia', 'foto'),
    campoBase('firma_responsable', 'Firma del responsable', 'firma')
  ]),
  form('frm-hocol-acta-entrega', 'F-ACT', 'Acta de entrega', 'line-hocol-l1', [
    campoBase('bien_entregado', 'Bien o servicio entregado', 'texto'),
    campoBase('receptor', 'Persona/organización que recibe', 'texto'),
    campoBase('fecha_entrega', 'Fecha de entrega', 'fecha'),
    campoBase('geopunto', 'Lugar de la entrega', 'geo'),
    campoBase('foto_entrega', 'Registro fotográfico de la entrega', 'foto'),
    campoBase('firma_receptor', 'Firma de quien recibe', 'firma')
  ]),
  form('frm-hocol-solicitud', 'F-SOL', 'Registro de solicitud (L2)', 'line-hocol-l2', [
    campoBase('descripcion', 'Descripción de la solicitud', 'texto'),
    campoBase('fecha_solicitud', 'Fecha de la solicitud', 'fecha'),
    campoBase('solicitante', 'Nombre del solicitante o autoridad', 'texto'),
    campoBase('priorizada', '¿Priorizada por el financiador?', 'bool'),
    campoBase('estado_atencion', 'Estado de atención', 'select', { opciones: ['Registrada', 'En gestión', 'Atendida', 'Cerrada'] })
  ]),
  form('frm-hocol-apoyo-cultural', 'F-CUL', 'Registro de apoyo cultural (L3)', 'line-hocol-l3', [
    campoBase('iniciativa', 'Iniciativa o actividad cultural apoyada', 'texto'),
    campoBase('fecha', 'Fecha de la actividad', 'fecha'),
    campoBase('participantes', 'Número de participantes', 'num'),
    campoBase('foto_actividad', 'Registro fotográfico', 'foto'),
    campoBase('satisfaccion', 'Satisfacción de los participantes (1 a 5)', 'escala')
  ]),
  form('frm-hocol-apoyo-humanitario', 'F-HUM', 'Registro de apoyo humanitario (L4)', 'line-hocol-l4', [
    campoBase('tipo_apoyo', 'Tipo de apoyo', 'select', { opciones: ['Humanitario', 'Usos y costumbres'] }),
    campoBase('descripcion', 'Descripción del apoyo entregado', 'texto'),
    campoBase('fecha_entrega', 'Fecha de entrega', 'fecha'),
    campoBase('geopunto', 'Lugar de entrega', 'geo'),
    campoBase('foto_entrega', 'Registro fotográfico', 'foto'),
    campoBase('firma_receptor', 'Firma de quien recibe', 'firma')
  ]),
  form('frm-hocol-atencion-salud', 'F-SAL', 'Registro de atención en salud (L5)', 'line-hocol-l5', [
    campoBase('tipo_jornada', 'Tipo de jornada o acción de salud', 'texto'),
    campoBase('fecha', 'Fecha de la jornada', 'fecha'),
    campoBase('personas_atendidas', 'Personas atendidas', 'num'),
    campoBase('institucion', 'Institución de salud articulada', 'texto', { obligatorio: false }),
    campoBase('foto_jornada', 'Registro fotográfico', 'foto')
  ]),
  form('frm-hocol-mentoria', 'F-MEN', 'Registro de mentoría / asistencia técnica', 'line-hocol-l1', [
    campoBase('tema', 'Tema de la mentoría o asistencia', 'texto'),
    campoBase('fecha', 'Fecha de la sesión', 'fecha'),
    campoBase('duracion_horas', 'Duración (horas)', 'num'),
    campoBase('participantes', 'Número de participantes', 'num'),
    campoBase('compromisos', 'Compromisos acordados', 'texto', { obligatorio: false })
  ])
];

export const tenantHocol = {
  tenant: {
    id: TENANT_ID,
    nombre: 'Convenio Asociación Guajira (Ecopetrol–Hocol) 2026',
    financiador: 'Hocol S.A.',
    entidad_ejecutora: 'Fundación Guajira Competitiva',
    unidad_analisis_default: 'comunidad',
    moneda: 'COP',
    vigencia_inicio: '2026-01-01',
    vigencia_fin: '2027-04-30', // 12 meses + hasta 4 de liquidación
    estado: 'activo',
    config: {
      roles_nombres: {
        gestor: 'Gestor Comunitario Wayuu',
        coordinador: 'Coordinador Territorial',
        director: 'Director del Proyecto',
        admin_fin: 'Profesional Administrativo y Financiero',
        admin_tenant: 'Administrador de Tenant',
        financiador: 'Hocol S.A. (consulta)',
        auditor: 'Auditor (consulta)'
      },
      pqrs_niveles: DEFAULT_PQRS_LEVELS,
      idiomas: ['es', 'way'],
      consentimiento: {
        finalidad: 'Registro y seguimiento de beneficiarios del convenio de inversión social Asociación Guajira (Ecopetrol–Hocol), con enfoque étnico y conforme a la Ley 1581 de 2012. Los datos se usan exclusivamente para los fines del convenio.',
        medios: ['fisico', 'digital', 'verbal_testificado']
      }
    }
  },
  lines,
  units,
  projects: [],
  logframes: [],
  indicators,
  forms
};
