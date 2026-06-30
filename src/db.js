import Dexie from 'dexie';

export const db = new Dexie('MealOfflineDB');

db.version(1).stores({
  profiles: 'id, email, role, updated_at, sync_status',
  projects: 'id, name, status, start_date, end_date, updated_at',
  logframes: 'id, project_id, type, code, parent_id, updated_at',
  indicators: 'id, project_id, logframe_id, code, name, updated_at',
  surveys: 'id, title, created_by, updated_at',
  survey_responses: 'id, survey_id, submitted_by, submitted_at, updated_at, sync_status',
  feedbacks: 'id, project_id, category, status, updated_at, sync_status',
  lessons_learned: 'id, project_id, title, updated_at, sync_status',
  sync_meta: 'key, value'
});

// Función para inicializar datos semilla de Guardianes del Mar Wayuu
export async function seedLocalData() {
  const projectCount = await db.projects.count();
  const hasWayuu = await db.projects.get('proj-wayuu-001');
  
  if (projectCount > 0 && hasWayuu) {
    console.log('El proyecto Guardianes del Mar Wayuu ya está sembrado localmente.');
    return;
  }

  console.log('Sembrando datos del proyecto "Guardianes del Mar Wayuu" en Dexie...');
  
  // Limpiar para asegurar reinicio limpio en pruebas funcionales
  await db.projects.clear();
  await db.logframes.clear();
  await db.indicators.clear();
  await db.surveys.clear();
  await db.survey_responses.clear();
  await db.feedbacks.clear();
  await db.lessons_learned.clear();
  await db.sync_meta.clear();

  const now = new Date().toISOString();
  // Simular fecha de hace 40 días para gatillar alertas de estancamiento en indicadores (Pilar 1 - Monitoreo)
  const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
  const projId = 'proj-wayuu-001';

  // 1. Proyecto Principal
  await db.projects.add({
    id: projId,
    name: 'Guardianes del Mar Wayuu',
    description: 'Fortalecimiento pesquero artesanal y desarrollo de experiencias turísticas comunitarias sostenibles en Mayapo y El Pájaro, Manaure, La Guajira.',
    start_date: '2026-06-01',
    end_date: '2027-04-01',
    status: 'active',
    updated_at: now
  });

  // 2. Marcos Lógicos Jerárquicos de 4 niveles (Impacto -> Resultados -> Productos -> Actividades) (Pilar 2 - Evaluación)
  const lf_impact = 'lf-wayuu-impact';
  const lf_out1 = 'lf-wayuu-out1'; // Gobernanza
  const lf_out2 = 'lf-wayuu-out2'; // Productivo
  const lf_out3 = 'lf-wayuu-out3'; // Turismo
  const lf_out4 = 'lf-wayuu-out4'; // Comercial
  
  const lf_outp1_1 = 'lf-wayuu-outp1.1'; // Producto Gobernanza
  const lf_outp2_1 = 'lf-wayuu-outp2.1'; // Producto Productivo

  await db.logframes.bulkAdd([
    // Nivel 1: IMPACTO (Goal)
    {
      id: lf_impact,
      project_id: projId,
      type: 'impact',
      code: 'OBJ-G',
      description: 'Mejorar de forma sostenible las condiciones socioeconómicas, la gobernanza comunitaria y la resiliencia climática de las comunidades pesqueras artesanales Wayuu en La Guajira.',
      parent_id: null,
      updated_at: now
    },

    // Nivel 2: RESULTADOS (Outcomes)
    {
      id: lf_out1,
      project_id: projId,
      type: 'outcome',
      code: 'R-1',
      description: 'Fortalecimiento de la gobernanza asociativa y las capacidades organizacionales para la auto-gestión del territorio costero.',
      parent_id: lf_impact,
      updated_at: now
    },
    {
      id: lf_out2,
      project_id: projId,
      type: 'outcome',
      code: 'R-2',
      description: 'Mejoramiento de las capacidades productivas, cadena de frío y seguridad marítima de las tripulaciones.',
      parent_id: lf_impact,
      updated_at: now
    },
    {
      id: lf_out3,
      project_id: projId,
      type: 'outcome',
      code: 'R-3',
      description: 'Estructuración y validación del portafolio comunitario de pescaturismo y patrimonio cultural.',
      parent_id: lf_impact,
      updated_at: now
    },
    {
      id: lf_out4,
      project_id: projId,
      type: 'outcome',
      code: 'R-4',
      description: 'Establecimiento de acuerdos comerciales estables y mecanismos de financiamiento para la sostenibilidad.',
      parent_id: lf_impact,
      updated_at: now
    },

    // Nivel 3: PRODUCTOS (Outputs)
    {
      id: lf_outp1_1,
      project_id: projId,
      type: 'output',
      code: 'P-1.1',
      description: 'Diagnóstico base completado y talleres de gobernanza impartidos a líderes tradicionales.',
      parent_id: lf_out1,
      updated_at: now
    },
    {
      id: lf_outp2_1,
      project_id: projId,
      type: 'output',
      code: 'P-2.1',
      description: 'Activos estratégicos (cavas de frío, chalecos de seguridad, GPS náuticos) entregados a cooperativas.',
      parent_id: lf_out2,
      updated_at: now
    },

    // Nivel 4: ACTIVIDADES (Activities)
    {
      id: 'lf-wayuu-act1.1',
      project_id: projId,
      type: 'activity',
      code: 'A-1.1',
      description: 'Socialización y concertación territorial del censo en Wayuunaiki con autoridades tradicionales.',
      parent_id: lf_outp1_1,
      updated_at: now
    },
    {
      id: 'lf-wayuu-act1.2',
      project_id: projId,
      type: 'activity',
      code: 'A-1.2',
      description: 'Campaña de caracterización socioeconómica individual de pescadores artesanales en campo.',
      parent_id: lf_outp1_1,
      updated_at: now
    },
    {
      id: 'lf-wayuu-act2.1',
      project_id: projId,
      type: 'activity',
      code: 'A-2.1',
      description: 'Entrega técnica de activos de conservación y cavas isotérmicas.',
      parent_id: lf_outp2_1,
      updated_at: now
    },
    {
      id: 'lf-wayuu-act2.2',
      project_id: projId,
      type: 'activity',
      code: 'A-2.2',
      description: 'Talleres de capacitación en cartografía náutica y primeros auxilios marítimos.',
      parent_id: lf_outp2_1,
      updated_at: now
    }
  ]);

  // 3. Indicadores de Monitoreo con soporte de Datos Desagregados (Pilar 1 - Monitoreo)
  await db.indicators.bulkAdd([
    {
      id: 'ind-wayuu-101',
      project_id: projId,
      logframe_id: lf_out1, // Vinculado a R-1
      code: 'IND-1.1',
      name: 'Personas que culminan los ciclos de formación en turismo, inocuidad y pesca',
      unit: 'Participantes',
      baseline: 0,
      target: 100,
      actual: 15,
      // Datos desagregados cargados por defecto (Pilar 1)
      disaggregated_data: {
        gender: { male: 10, female: 5, other: 0 },
        age: { children: 0, youth: 3, adult: 10, elder: 2 },
        ethnicity: { indigenous: 12, afrodescendant: 0, local: 3 },
        location: { Mayapo: 10, ElPajaro: 5 }
      },
      updated_at: now
    },
    {
      id: 'ind-wayuu-102',
      project_id: projId,
      logframe_id: lf_out1, // Vinculado a R-1
      code: 'IND-1.2',
      name: 'Asociaciones de pescadores fortalecidas en gobernanza comunitaria y administración',
      unit: 'Asociaciones',
      baseline: 0,
      target: 5,
      actual: 2,
      disaggregated_data: {
        gender: { male: 0, female: 0, other: 0 },
        age: { children: 0, youth: 0, adult: 0, elder: 0 },
        ethnicity: { indigenous: 2, afrodescendant: 0, local: 0 },
        location: { Mayapo: 1, ElPajaro: 1 }
      },
      updated_at: now
    },
    {
      id: 'ind-wayuu-201',
      project_id: projId,
      logframe_id: lf_out2, // Vinculado a R-2
      code: 'IND-2.1',
      name: 'Asociaciones pesqueras dotadas de activos productivos de conservación y seguridad marítima',
      unit: 'Asociaciones',
      baseline: 0,
      target: 2,
      actual: 0,
      disaggregated_data: {
        gender: { male: 0, female: 0, other: 0 },
        age: { children: 0, youth: 0, adult: 0, elder: 0 },
        ethnicity: { indigenous: 0, afrodescendant: 0, local: 0 },
        location: { Mayapo: 0, ElPajaro: 0 }
      },
      // HACE 40 DÍAS: Esto disparará el banner de alerta "ESTANCADO" (Pilar 1)
      updated_at: fortyDaysAgo
    },
    {
      id: 'ind-wayuu-301',
      project_id: projId,
      logframe_id: lf_out3, // Vinculado a R-3
      code: 'IND-3.1',
      name: 'Propuestas de experiencias turísticas comunitarias estructuradas y costeadas',
      unit: 'Propuestas',
      baseline: 0,
      target: 5,
      actual: 1,
      disaggregated_data: {
        gender: { male: 0, female: 0, other: 0 },
        age: { children: 0, youth: 0, adult: 0, elder: 0 },
        ethnicity: { indigenous: 1, afrodescendant: 0, local: 0 },
        location: { Mayapo: 1, ElPajaro: 0 }
      },
      updated_at: now
    }
  ]);

  // 4. Plantillas de Encuestas iniciales ancladas a indicadores (Pilar 2 - Evaluación)
  await db.surveys.bulkAdd([
    {
      id: 'srv-wayuu-101',
      title: 'Ficha de Caracterización y Diagnóstico Socioeconómico (Mes 1)',
      description: 'Formulario de caracterización socioeconómica para el censo de pescadores en Mayapo y El Pájaro.',
      indicator_id: 'ind-wayuu-101', // Anclada a IND-1.1 para evitar encuestas huérfanas
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
      created_by: 'coordinacion@guajiracompetitiva.org',
      updated_at: now
    },
    {
      id: 'srv-wayuu-102',
      title: 'Evaluación del FAM TRIP y Satisfacción Comercial (Metas 9.6)',
      description: 'Encuesta técnica para evaluar la viabilidad de las experiencias piloto de pescaturismo.',
      indicator_id: 'ind-wayuu-301', // Anclada a IND-3.1
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
      created_by: 'coordinacion@guajiracompetitiva.org',
      updated_at: now
    }
  ]);

  // 5. Quejas y Sugerencias bajo el estándar FCRM (Pilar 3 - Rendición de Cuentas)
  await db.feedbacks.bulkAdd([
    {
      id: 'fb-wayuu-101',
      project_id: projId,
      category: 'complaint',
      details: 'Pescadores de la zona norte de Mayapo reportan que la marea alta ha socavado los postes de amarre y solicitan priorizar el estudio de geolocalización de puntos de embarque.',
      contact_info: 'Líder Gelasio Uriana, Cel: 312-445588',
      status: 'pending',
      severity: 'medium', // Severidad (Pilar 3)
      is_confidential: false, // No confidencial
      response_text: null, // Sin respuesta oficial aún
      updated_at: now,
      created_at: now,
      sync_status: 'synced'
    },
    {
      id: 'fb-wayuu-102',
      project_id: projId,
      category: 'complaint',
      details: 'Reporte confidencial: Se detectaron sospechas de favoritismo familiar en la pre-asignación del kit de cavas de frío en la ranchería de El Pájaro.',
      contact_info: 'Pescador anónimo de El Pájaro',
      status: 'under_review',
      severity: 'high', // Severidad Alta (Fraude/Protección) -> SLA: 5 días
      is_confidential: true, // Confidencial (Pilar 3)
      response_text: null,
      // Hace 4 días para simular SLA en cuenta regresiva (queda 1 día)
      created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: now,
      sync_status: 'synced'
    }
  ]);

  // 6. Lecciones Aprendidas vinculadas a Planes de Acción (Pilar 4 - Aprendizaje)
  await db.lessons_learned.bulkAdd([
    {
      id: 'll-wayuu-101',
      project_id: projId,
      title: 'Estandarización de tarifas netas para el canal B2B',
      description: 'Durante la operación piloto de la Ruta Ancestral Jemeilli, se evidenció que las agencias mayoristas exigen tarifas netas fijas anualizadas con comisiones del 20% y seguros de accidentes.',
      challenges: 'Las asociaciones comunitarias cambiaban los costos de los almuerzos semanalmente según el precio de mercado, rompiendo reservas de agencias.',
      recommendations: 'Establecer acuerdos de costos fijos estacionales por semestre con las asociaciones y contratar pólizas colectivas anuales.',
      // Plan de Acción vinculado (Pilar 4)
      action_plan: {
        description: 'Redactar acuerdo firmado de tarifas fijas para almuerzos con la cooperativa de Mayapo.',
        responsible: 'Coordinador Territorial MEAL',
        deadline: '2026-07-15',
        status: 'pending' // Estado de la acción
      },
      updated_at: now,
      sync_status: 'synced'
    }
  ]);

  // 7. Sincronización Meta Inicial
  await db.sync_meta.bulkAdd([
    { key: 'last_synced_at', value: '1970-01-01T00:00:00.000Z' },
    { key: 'network_mode', value: 'online' }
  ]);

  console.log('Sembrado de datos del proyecto "Guardianes del Mar Wayuu" completado con éxito.');
}
