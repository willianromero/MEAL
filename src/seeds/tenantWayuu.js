import { DEFAULT_PQRS_LEVELS, DEFAULT_ROLE_NAMES } from './defaults.js';

// Tenant 1: Guardianes del Mar Wayuu (proyecto de consultoría existente,
// convertido en tenant real de la plataforma según el plan aprobado del DRT v2.0).
const TENANT_ID = 'ten-wayuu';
const PROJ_ID = 'proj-wayuu-001';

// Formularios del motor moderno (tipos: texto, num, fecha, select, geo, foto,
// documento, firma, bool, escala, checklist). Ampliación pedida por revisión
// experta MEAL (2026): srv-wayuu-101/102 se editan en el motor legado (ya
// tienen respuestas reales); estos 5 son formularios nuevos, capaces de
// alimentar indicadores automáticamente vía indicator.formula.
function form(id, codigo, nombre, lineaId, campos) {
  return { id, codigo, nombre, linea_id: lineaId, version: 1, activo: true, campos };
}
const campoBase = (name, etiqueta, tipo, extra = {}) => ({
  name, etiqueta_es: etiqueta, etiqueta_way: null, tipo, obligatorio: true, reglas_validacion: null, ...extra
});

export const tenantWayuu = {
  tenant: {
    id: TENANT_ID,
    nombre: 'Guardianes del Mar Wayuu',
    financiador: 'Cooperación / Fondos propios',
    entidad_ejecutora: 'Fundación Guajira Competitiva',
    unidad_analisis_default: 'comunidad',
    moneda: 'COP',
    vigencia_inicio: '2026-06-01',
    vigencia_fin: '2027-04-01',
    estado: 'activo',
    config: {
      roles_nombres: { ...DEFAULT_ROLE_NAMES, gestor: 'Gestor Comunitario' },
      pqrs_niveles: DEFAULT_PQRS_LEVELS,
      idiomas: ['es', 'way'],
      consentimiento: {
        finalidad: 'Caracterización socioeconómica y seguimiento del proyecto Guardianes del Mar Wayuu, conforme a la Ley 1581 de 2012.',
        medios: ['fisico', 'digital', 'verbal_testificado']
      }
    }
  },

  lines: [
    {
      id: 'line-wayuu-general',
      codigo: 'LG',
      nombre: 'Línea General de Ejecución',
      tipo: 'estructurada',
      orden: 1,
      fases: [
        { orden: 1, nombre: 'Diagnóstico y caracterización' },
        { orden: 2, nombre: 'Dotación y fortalecimiento' },
        { orden: 3, nombre: 'Validación comercial y sostenibilidad' }
      ]
    }
  ],

  units: [
    {
      id: 'unit-wayuu-mayapo',
      nombre: 'Mayapo',
      municipio: 'manaure',
      estado_reconocimiento: 'legalizada',
      autoridad_tradicional: null,
      geopunto: { lat: 11.6919, lng: -72.7592 },
      poblacion_estimada: null,
      atributos: {}
    },
    {
      id: 'unit-wayuu-elpajaro',
      nombre: 'El Pájaro',
      municipio: 'manaure',
      estado_reconocimiento: 'legalizada',
      autoridad_tradicional: null,
      geopunto: { lat: 11.7318, lng: -72.6412 },
      poblacion_estimada: null,
      atributos: {}
    }
  ],

  projects: [
    {
      id: PROJ_ID,
      name: 'Guardianes del Mar Wayuu',
      description: 'Fortalecimiento pesquero artesanal y desarrollo de experiencias turísticas comunitarias sostenibles en Mayapo y El Pájaro, Manaure, La Guajira.',
      linea_id: 'line-wayuu-general',
      unidad_ids: ['unit-wayuu-mayapo', 'unit-wayuu-elpajaro'],
      tipo: 'comunitario',
      presupuesto: null,
      start_date: '2026-06-01',
      end_date: '2027-04-01',
      status: 'active'
    }
  ],

  logframes: [
    {
      id: 'lf-wayuu-impact',
      project_id: PROJ_ID,
      type: 'impact',
      code: 'OBJ-G',
      description: 'Mejorar de forma sostenible las condiciones socioeconómicas, la gobernanza comunitaria y la resiliencia climática de las comunidades pesqueras artesanales Wayuu en La Guajira.',
      parent_id: null
    },
    {
      id: 'lf-wayuu-out1',
      project_id: PROJ_ID,
      type: 'outcome',
      code: 'R-1',
      description: 'Fortalecimiento de la gobernanza asociativa y las capacidades organizacionales para la auto-gestión del territorio costero.',
      parent_id: 'lf-wayuu-impact'
    },
    {
      id: 'lf-wayuu-out2',
      project_id: PROJ_ID,
      type: 'outcome',
      code: 'R-2',
      description: 'Mejoramiento de las capacidades productivas, cadena de frío y seguridad marítima de las tripulaciones.',
      parent_id: 'lf-wayuu-impact'
    },
    {
      id: 'lf-wayuu-out3',
      project_id: PROJ_ID,
      type: 'outcome',
      code: 'R-3',
      description: 'Estructuración y validación del portafolio comunitario de pescaturismo y patrimonio cultural.',
      parent_id: 'lf-wayuu-impact'
    },
    {
      id: 'lf-wayuu-out4',
      project_id: PROJ_ID,
      type: 'outcome',
      code: 'R-4',
      description: 'Establecimiento de acuerdos comerciales estables y mecanismos de financiamiento para la sostenibilidad.',
      parent_id: 'lf-wayuu-impact'
    },
    {
      id: 'lf-wayuu-outp1.1',
      project_id: PROJ_ID,
      type: 'output',
      code: 'P-1.1',
      description: 'Diagnóstico base completado y talleres de gobernanza impartidos a líderes tradicionales.',
      parent_id: 'lf-wayuu-out1'
    },
    {
      id: 'lf-wayuu-outp2.1',
      project_id: PROJ_ID,
      type: 'output',
      code: 'P-2.1',
      description: 'Activos estratégicos (cavas de frío, chalecos de seguridad, GPS náuticos) entregados a cooperativas.',
      parent_id: 'lf-wayuu-out2'
    },
    {
      id: 'lf-wayuu-act1.1',
      project_id: PROJ_ID,
      type: 'activity',
      code: 'A-1.1',
      description: 'Socialización y concertación territorial del censo en Wayuunaiki con autoridades tradicionales.',
      parent_id: 'lf-wayuu-outp1.1'
    },
    {
      id: 'lf-wayuu-act1.2',
      project_id: PROJ_ID,
      type: 'activity',
      code: 'A-1.2',
      description: 'Campaña de caracterización socioeconómica individual de pescadores artesanales en campo.',
      parent_id: 'lf-wayuu-outp1.1'
    },
    {
      id: 'lf-wayuu-act2.1',
      project_id: PROJ_ID,
      type: 'activity',
      code: 'A-2.1',
      description: 'Entrega técnica de activos de conservación y cavas isotérmicas.',
      parent_id: 'lf-wayuu-outp2.1'
    },
    {
      id: 'lf-wayuu-act2.2',
      project_id: PROJ_ID,
      type: 'activity',
      code: 'A-2.2',
      description: 'Talleres de capacitación en cartografía náutica y primeros auxilios marítimos.',
      parent_id: 'lf-wayuu-outp2.1'
    }
  ],

  indicators: [
    {
      id: 'ind-wayuu-101',
      project_id: PROJ_ID,
      logframe_id: 'lf-wayuu-out1',
      linea_id: 'line-wayuu-general',
      code: 'IND-1.1',
      name: 'Personas que culminan los ciclos de formación en turismo, inocuidad y pesca',
      unit: 'Participantes',
      baseline: 0,
      target: 100,
      actual: 15,
      meta_tipo: 'numero',
      frecuencia: 'mensual',
      medio_verificacion: 'Registros de asistencia y certificados de formación',
      formula: { fuente: { formulario_id: 'frm-wayuu-104' }, operacion: 'suma', campo: 'numero_asistentes' },
      linea_base_valor: 0,
      linea_base_congelada: false,
      meta_ajustable: false,
      disaggregated_data: {
        gender: { male: 10, female: 5, other: 0 },
        age: { children: 0, youth: 3, adult: 10, elder: 2 },
        ethnicity: { indigenous: 12, afrodescendant: 0, local: 3 },
        location: { Mayapo: 10, ElPajaro: 5 }
      }
    },
    {
      id: 'ind-wayuu-102',
      project_id: PROJ_ID,
      logframe_id: 'lf-wayuu-out1',
      linea_id: 'line-wayuu-general',
      code: 'IND-1.2',
      name: 'Asociaciones de pescadores fortalecidas en gobernanza comunitaria y administración',
      unit: 'Asociaciones',
      baseline: 0,
      target: 5,
      actual: 2,
      meta_tipo: 'numero',
      frecuencia: 'trimestral',
      medio_verificacion: 'Actas de talleres y planes de fortalecimiento firmados',
      formula: null,
      linea_base_valor: 0,
      linea_base_congelada: false,
      meta_ajustable: false,
      disaggregated_data: {
        gender: { male: 0, female: 0, other: 0 },
        age: { children: 0, youth: 0, adult: 0, elder: 0 },
        ethnicity: { indigenous: 2, afrodescendant: 0, local: 0 },
        location: { Mayapo: 1, ElPajaro: 1 }
      }
    },
    {
      id: 'ind-wayuu-201',
      project_id: PROJ_ID,
      logframe_id: 'lf-wayuu-out2',
      linea_id: 'line-wayuu-general',
      code: 'IND-2.1',
      name: 'Asociaciones pesqueras dotadas de activos productivos de conservación y seguridad marítima',
      unit: 'Asociaciones',
      baseline: 0,
      target: 2,
      actual: 0,
      meta_tipo: 'numero',
      frecuencia: 'semestral',
      medio_verificacion: 'Actas de entrega de activos con registro fotográfico',
      formula: { fuente: { formulario_id: 'frm-wayuu-105' }, operacion: 'conteo' },
      linea_base_valor: 0,
      linea_base_congelada: false,
      meta_ajustable: false,
      disaggregated_data: {
        gender: { male: 0, female: 0, other: 0 },
        age: { children: 0, youth: 0, adult: 0, elder: 0 },
        ethnicity: { indigenous: 0, afrodescendant: 0, local: 0 },
        location: { Mayapo: 0, ElPajaro: 0 }
      }
    },
    {
      id: 'ind-wayuu-301',
      project_id: PROJ_ID,
      logframe_id: 'lf-wayuu-out3',
      linea_id: 'line-wayuu-general',
      code: 'IND-3.1',
      name: 'Propuestas de experiencias turísticas comunitarias estructuradas y costeadas',
      unit: 'Propuestas',
      baseline: 0,
      target: 5,
      actual: 1,
      meta_tipo: 'numero',
      frecuencia: 'trimestral',
      medio_verificacion: 'Documentos de propuesta con costeo validado',
      formula: null,
      linea_base_valor: 0,
      linea_base_congelada: false,
      meta_ajustable: false,
      disaggregated_data: {
        gender: { male: 0, female: 0, other: 0 },
        age: { children: 0, youth: 0, adult: 0, elder: 0 },
        ethnicity: { indigenous: 1, afrodescendant: 0, local: 0 },
        location: { Mayapo: 1, ElPajaro: 0 }
      }
    }
  ],

  surveys: [
    {
      id: 'srv-wayuu-101',
      title: 'Ficha de Caracterización y Diagnóstico Socioeconómico (Mes 1)',
      description: 'Formulario de caracterización socioeconómica para el censo de pescadores en Mayapo y El Pájaro.',
      indicator_id: 'ind-wayuu-101',
      schema: {
        fields: [
          { name: 'full_name', label: 'Nombre Completo del Pescador', type: 'text', required: true },
          { name: 'genero', label: 'Género', type: 'select', options: ['Masculino', 'Femenino', 'Otro'], required: true },
          { name: 'edad', label: 'Edad', type: 'number', required: true },
          { name: 'clan', label: 'Clan Wayuu de pertenencia (ej. Pushaina, Uriana, Epinayu)', type: 'text', required: true },
          { name: 'location', label: 'Corregimiento / Comunidad de Residencia', type: 'select', options: ['Mayapo', 'El Pájaro', 'Ranchería Aledaña Mayapo', 'Ranchería Aledaña El Pájaro'], required: true },
          { name: 'association', label: 'Asociación de Pescadores a la que pertenece', type: 'select', options: ['Asociación de Mayapo A', 'Asociación de Mayapo B', 'Asociación de El Pájaro A', 'Independiente / No asociado'], required: true },
          { name: 'family_count', label: 'Miembros dependientes en el núcleo familiar', type: 'number', required: true },
          { name: 'fishing_only', label: '¿Es la pesca artesanal su única fuente de ingresos?', type: 'select', options: ['Sí, dependemos 100% de la pesca', 'No, alternamos con pastoreo/artesanías', 'No, alternamos con mototaxismo o comercio'], required: true },
          { name: 'boat_motor', label: '¿Cuenta con embarcación y motor propio en buen estado?', type: 'select', options: ['Embarcación y motor propios operativos', 'Embarcación propia pero sin motor', 'No tiene activos propios (pesca de orilla)', 'Usa activos alquilados/prestados'], required: true },
          { name: 'experiencia_turismo', label: '¿Ha prestado servicios turísticos antes?', type: 'select', options: ['Sí, recurrentemente', 'Sí, ocasionalmente', 'No, nunca'], required: true },
          { name: 'equipos_seguridad_actuales', label: 'Equipos de seguridad marítima con los que cuenta actualmente', type: 'checklist', options: ['Chalecos salvavidas', 'Radio de comunicación', 'GPS náutico', 'Botiquín', 'Ninguno'], required: true },
          { name: 'comments', label: 'Observaciones generales del diagnóstico', type: 'textarea', required: false }
        ]
      },
      created_by: 'coordinacion@guajiracompetitiva.org'
    },
    {
      id: 'srv-wayuu-102',
      title: 'Evaluación del FAM TRIP y Satisfacción Comercial (Metas 9.6)',
      description: 'Encuesta técnica para evaluar la viabilidad de las experiencias piloto de pescaturismo.',
      indicator_id: 'ind-wayuu-301',
      schema: {
        fields: [
          { name: 'agency_name', label: 'Agencia de Viajes / Operadora Turística evaluadora', type: 'text', required: true },
          { name: 'route_evaluated', label: 'Experiencia Turística Evaluada', type: 'select', options: ['Pesca Ancestral Wayuu en Mayapo', 'Ruta de la Tortuga y Gastronomía en El Pájaro'], required: true },
          { name: 'cultural_respect_checklist', label: 'Elementos de pertinencia cultural evidenciados', type: 'checklist', options: ['Uso del idioma Wayuunaiki en la guianza', 'Interacción directa con autoridades tradicionales', 'Inclusión de relatos y saberes ancestrales', 'Consumo de gastronomía tradicional'], required: true },
          { name: 'safety_equipment', label: '¿Se constató el uso riguroso de equipos de seguridad?', type: 'select', options: ['Sí, se cumplieron todos los protocolos DIMAR', 'Parcialmente (faltaban elementos)', 'No contaban con seguridad adecuada'], required: true },
          { name: 'commercial_potential', label: 'Potencial de inserción comercial (Modelo B2B)', type: 'select', options: ['Alto potencial', 'Medio potencial', 'Bajo potencial'], required: true },
          { name: 'intencion_compra', label: '¿Estaría dispuesto a incluir esta ruta en el portafolio formal de su agencia?', type: 'select', options: ['Sí, de manera inmediata', 'Sí, si realizan ajustes técnicos/tarifarios', 'No por el momento'], required: true },
          { name: 'improvement_points', label: 'Recomendaciones de mejora identificadas', type: 'textarea', required: false }
        ]
      },
      created_by: 'coordinacion@guajiracompetitiva.org'
    }
  ],

  // Formularios del motor moderno (RF-FRM), ampliación pedida por la 3ª
  // revisión experta MEAL. Cada uno queda listo para vincularse a un
  // indicador vía indicator.formula (ver docs/GUIA_FORMULARIOS_WAYUU_AMPLIADOS.md).
  forms: [
    // Uso exclusivo del Comité Evaluador — puntajes por criterio, suman 100%
    // (30+20+20+15+15). Sin motor de suma ponderada (decisión explícita): el
    // total se calcula manualmente por ahora, este formulario solo captura
    // los 5 puntajes por separado.
    form('frm-wayuu-103', 'FRM-103', 'Evaluación de Pitch Vivencial (Uso exclusivo Comité)', 'line-wayuu-general', [
      campoBase('asociacion_evaluada', 'Asociación que presenta el Pitch', 'select', {
        opciones: ['Asociación de Mayapo A', 'Asociación de Mayapo B', 'Asociación de El Pájaro A', 'Otra']
      }),
      campoBase('puntaje_asistencia', 'Puntaje Asistencia a Formación (Máx 30%)', 'num', { reglas_validacion: { min: 0, max: 30 } }),
      campoBase('puntaje_viabilidad', 'Puntaje Viabilidad Técnica y Financiera (Máx 20%)', 'num', { reglas_validacion: { min: 0, max: 20 } }),
      campoBase('puntaje_pitch', 'Puntaje Sustentación y Apropiación (Máx 20%)', 'num', { reglas_validacion: { min: 0, max: 20 } }),
      campoBase('puntaje_innovacion_cultural', 'Puntaje Innovación y Enfoque Étnico (Máx 15%)', 'num', { reglas_validacion: { min: 0, max: 15 } }),
      campoBase('puntaje_inclusion_diferencial', 'Puntaje Inclusión Social - Mujeres/Jóvenes (Máx 15%)', 'num', { reglas_validacion: { min: 0, max: 15 } }),
      campoBase('comentarios_jurado', 'Justificación del Comité Evaluador', 'texto')
    ]),
    // Alimenta IND-1.1 (suma de numero_asistentes sobre registros validados).
    form('frm-wayuu-104', 'FRM-104', 'Registro de Asistencia a Ciclos de Formación', 'line-wayuu-general', [
      campoBase('fecha_capacitacion', 'Fecha de la sesión', 'fecha'),
      campoBase('modulo_dictado', 'Módulo Temático', 'select', {
        opciones: ['Turismo Comunitario', 'Atención al Cliente', 'Manipulación de Alimentos', 'Seguridad Marítima DIMAR', 'Gobernanza y Sostenibilidad']
      }),
      campoBase('entidad_formadora', 'Entidad Formadora', 'select', {
        opciones: ['SENA', 'Cámara de Comercio de La Guajira', 'Fundación Guajira Competitiva']
      }),
      campoBase('numero_asistentes', 'Número total de asistentes en la sesión', 'num', { reglas_validacion: { min: 0 } }),
      campoBase('evidencia_fotografica', 'Registro fotográfico / Planilla firmada', 'documento')
    ]),
    // Alimenta IND-2.1 (conteo de actas validadas).
    form('frm-wayuu-105', 'FRM-105', 'Acta de Entrega de Activos Productivos y HSE', 'line-wayuu-general', [
      campoBase('fecha_entrega', 'Fecha de entrega', 'fecha'),
      campoBase('asociacion_receptora', 'Asociación Beneficiaria', 'select', {
        opciones: ['Asociación Ganadora Mayapo', 'Asociación Ganadora El Pájaro']
      }),
      campoBase('tipo_activo', 'Categoría de los activos entregados', 'checklist', {
        opciones: ['Cavas isotérmicas (Cadena de frío)', 'Chalecos salvavidas', 'Equipos GPS/Radio', 'Herramientas de manejo postcaptura']
      }),
      campoBase('estado_entrega', 'Estado de los equipos', 'select', {
        opciones: ['Nuevos y funcionales', 'Requieren instalación técnica', 'Con novedades (Describir abajo)']
      }),
      campoBase('nombre_representante', 'Nombre del representante legal que recibe', 'texto'),
      campoBase('firma_representante', 'Firma digital del representante que recibe', 'firma'),
      campoBase('acta_adjunta', 'Acta firmada (PDF)', 'documento')
    ]),
    // Alimenta IND-4.2 (conteo de acuerdos de gobernanza validados).
    form('frm-wayuu-106', 'FRM-106', 'Adopción de Mecanismos de Gobernanza y Sostenibilidad', 'line-wayuu-general', [
      campoBase('asociacion', 'Organización Comunitaria', 'select', { opciones: ['Asociación Mayapo', 'Asociación El Pájaro'] }),
      campoBase('tipo_mecanismo', 'Tipo de mecanismo adoptado', 'select', {
        opciones: ['Fondo comunitario de ahorro', 'Reglamento interno de administración de activos', 'Plan de sostenibilidad financiera', 'Acuerdo de distribución de responsabilidades']
      }),
      campoBase('porcentaje_ahorro', 'Porcentaje de ingresos destinado a reinversión (si aplica)', 'num', { obligatorio: false, reglas_validacion: { min: 0, max: 100 } }),
      campoBase('descripcion_acuerdo', 'Resumen del acuerdo alcanzado', 'texto'),
      campoBase('documento_soporte', 'Reglamento o acta de asamblea comunitaria (PDF)', 'documento')
    ]),
    // Alimenta IND-4.1 (conteo de alianzas comerciales validadas).
    form('frm-wayuu-107', 'FRM-107', 'Registro de Alianzas Comerciales B2B', 'line-wayuu-general', [
      campoBase('fecha_firma', 'Fecha de formalización del acuerdo', 'fecha'),
      campoBase('nombre_operador_aliado', 'Nombre de la Agencia / Operador Turístico Aliado', 'texto'),
      campoBase('ruta_comercializada', 'Experiencia vinculada', 'select', {
        opciones: ['Experiencia Mayapo', 'Experiencia El Pájaro', 'Ambas rutas']
      }),
      campoBase('tipo_acuerdo', 'Naturaleza del acuerdo comercial', 'select', {
        opciones: ['Acuerdo de tarifas netas fijas', 'Inclusión en portafolio promocional', 'Contrato de exclusividad operativa', 'Carta de intención de compra']
      }),
      campoBase('responsabilidades_aliado', 'Compromisos principales del aliado', 'texto'),
      campoBase('documento_soporte', 'Acuerdo o carta de intención (PDF)', 'documento')
    ])
  ],

  feedbacks: [
    {
      id: 'fb-wayuu-101',
      project_id: PROJ_ID,
      unidad_id: 'unit-wayuu-mayapo',
      category: 'complaint',
      canal: 'presencial',
      nivel: 'amarillo',
      estado: 'recibida',
      details: 'Pescadores de la zona norte de Mayapo reportan que la marea alta ha socavado los postes de amarre y solicitan priorizar el estudio de geolocalización de puntos de embarque.',
      contact_info: 'Líder Gelasio Uriana, Cel: 312-445588',
      status: 'pending',
      severity: 'medium',
      is_confidential: false,
      response_text: null,
      created_at: '2026-06-25T10:00:00.000Z'
    },
    {
      id: 'fb-wayuu-102',
      project_id: PROJ_ID,
      unidad_id: 'unit-wayuu-elpajaro',
      category: 'complaint',
      canal: 'anonimo',
      nivel: 'naranja',
      estado: 'clasificada',
      details: 'Reporte confidencial: Se detectaron sospechas de favoritismo familiar en la pre-asignación del kit de cavas de frío en la ranchería de El Pájaro.',
      contact_info: 'Pescador anónimo de El Pájaro',
      status: 'under_review',
      severity: 'high',
      is_confidential: true,
      response_text: null,
      created_at: '2026-06-26T09:00:00.000Z'
    }
  ],

  lessons: [
    {
      id: 'll-wayuu-101',
      project_id: PROJ_ID,
      title: 'Estandarización de tarifas netas para el canal B2B',
      description: 'Durante la operación piloto de la Ruta Ancestral Jemeilli, se evidenció que las agencias mayoristas exigen tarifas netas fijas anualizadas con comisiones del 20% y seguros de accidentes.',
      challenges: 'Las asociaciones comunitarias cambiaban los costos de los almuerzos semanalmente según el precio de mercado, rompiendo reservas de agencias.',
      recommendations: 'Establecer acuerdos de costos fijos estacionales por semestre con las asociaciones y contratar pólizas colectivas anuales.',
      action_plan: {
        description: 'Redactar acuerdo firmado de tarifas fijas para almuerzos con la cooperativa de Mayapo.',
        responsible: 'Coordinador Territorial MEAL',
        deadline: '2026-07-15',
        status: 'pending'
      }
    }
  ]
};
