import { DEFAULT_PQRS_LEVELS, DEFAULT_ROLE_NAMES } from './defaults.js';

// Tenant 1: Guardianes del Mar Wayuu (proyecto de consultoría existente,
// convertido en tenant real de la plataforma según el plan aprobado del DRT v2.0).
const TENANT_ID = 'ten-wayuu';
const PROJ_ID = 'proj-wayuu-001';

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
      formula: null,
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
      formula: null,
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
          { name: 'clan', label: 'Clan Wayuu de pertenencia (ej. Pushaina, Uriana, Epinayu)', type: 'text', required: true },
          { name: 'location', label: 'Corregimiento / Comunidad de Residencia', type: 'select', options: ['Mayapo', 'El Pájaro', 'Ranchería Aledaña Mayapo', 'Ranchería Aledaña El Pájaro'], required: true },
          { name: 'association', label: 'Asociación de Pescadores a la que pertenece', type: 'select', options: ['Asociación de Mayapo A', 'Asociación de Mayapo B', 'Asociación de El Pájaro A', 'Independiente / No asociado'], required: true },
          { name: 'family_count', label: 'Miembros dependientes en el núcleo familiar', type: 'number', required: true },
          { name: 'fishing_only', label: '¿Es la pesca artesanal su única fuente de ingresos?', type: 'select', options: ['Sí, dependemos 100% de la pesca', 'No, alternamos con pastoreo/artesanías', 'No, alternamos con mototaxismo o comercio'], required: true },
          { name: 'boat_motor', label: '¿Cuenta con embarcación y motor propio en buen estado?', type: 'select', options: ['Embarcación y motor propios operativos', 'Embarcación propia pero sin motor', 'No tiene activos propios (pesca de orilla)', 'Usa activos alquilados/prestados'], required: true },
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
          { name: 'agency_name', label: 'Agencia de Viajes / Operadora Turística', type: 'text', required: true },
          { name: 'route_evaluated', label: 'Experiencia Turística Evaluada', type: 'select', options: ['Pesca Ancestral Wayuu en Mayapo', 'Ruta de la Tortuga y Gastronomía en El Pájaro'], required: true },
          { name: 'cultural_respect', label: 'Nivel de respeto cultural Wayuu (1 al 5)', type: 'number', required: true },
          { name: 'safety_equipment', label: '¿Se constató el uso de chalecos salvavidas?', type: 'select', options: ['Sí, todo el equipamiento', 'Parcialmente (faltaban chalecos)', 'No contaban con seguridad'], required: true },
          { name: 'commercial_potential', label: 'Potencial de inserción comercial B2B', type: 'select', options: ['Alto potencial', 'Medio potencial', 'Bajo potencial'], required: true },
          { name: 'improvement_points', label: 'Recomendaciones identificadas', type: 'textarea', required: false }
        ]
      },
      created_by: 'coordinacion@guajiracompetitiva.org'
    }
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
