import Dexie from 'dexie';

export const db = new Dexie('MealOfflineDB');

db.version(1).stores({
  profiles: 'id, email, role, updated_at',
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
  // Primero limpiamos los datos semilla anteriores para evitar confusiones en las pruebas reales
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
  const projId = 'proj-wayuu-001';

  // 1. Proyecto Principal
  await db.projects.add({
    id: projId,
    name: 'Guardianes del Mar Wayuu',
    description: 'Fortalecimiento pesquero artesanal y desarrollo de experiencias turísticas comunitarias sostenibles en Mayapo y El Pájaro, Manaure, La Guajira.',
    start_date: '2026-06-01',
    end_date: '2027-04-01', // 10 meses
    status: 'active',
    updated_at: now
  });

  // 2. Marcos Lógicos (LogFrames basados en los objetivos específicos)
  const lf_out1 = 'lf-wayuu-out1'; // Gobernanza
  const lf_out2 = 'lf-wayuu-out2'; // Productivo/Seguridad
  const lf_out3 = 'lf-wayuu-out3'; // Turismo
  const lf_out4 = 'lf-wayuu-out4'; // Comercial/Sostenibilidad

  await db.logframes.bulkAdd([
    // Resultado 1: Gobernanza
    {
      id: lf_out1,
      project_id: projId,
      type: 'outcome',
      code: 'R-1',
      description: 'Fortalecimiento de la gobernanza, planeación asociativa y capacidades organizacionales de las comunidades pesqueras Wayuu.',
      parent_id: null,
      updated_at: now
    },
    {
      id: 'lf-wayuu-act1.1',
      project_id: projId,
      type: 'activity',
      code: 'A-1.1',
      description: 'Socialización territorial y concertación del proyecto en idioma Wayuunaiki con autoridades tradicionales y asociaciones.',
      parent_id: lf_out1,
      updated_at: now
    },
    {
      id: 'lf-wayuu-act1.2',
      project_id: projId,
      type: 'activity',
      code: 'A-1.2',
      description: 'Campaña de caracterización socioeconómica individual de pescadores y diagnóstico asociativo base en el primer mes.',
      parent_id: lf_out1,
      updated_at: now
    },

    // Resultado 2: Productivo
    {
      id: lf_out2,
      project_id: projId,
      type: 'outcome',
      code: 'R-2',
      description: 'Mejoramiento de las capacidades productivas pesqueras, cadena de frío, inocuidad alimentaria (HSE) y seguridad marítima.',
      parent_id: null,
      updated_at: now
    },
    {
      id: 'lf-wayuu-act2.1',
      project_id: projId,
      type: 'activity',
      code: 'A-2.1',
      description: 'Entrega de activos estratégicos de conservación, refrigeración y postcaptura pesquera.',
      parent_id: lf_out2,
      updated_at: now
    },
    {
      id: 'lf-wayuu-act2.2',
      project_id: projId,
      type: 'activity',
      code: 'A-2.2',
      description: 'Dotación de equipos de seguridad náutica y capacitación bajo parámetros de la DIMAR.',
      parent_id: lf_out2,
      updated_at: now
    },

    // Resultado 3: Turismo
    {
      id: lf_out3,
      project_id: projId,
      type: 'outcome',
      code: 'R-3',
      description: 'Estructuración y diseño del portafolio de experiencias de pescaturismo y patrimonio inmaterial Wayuu.',
      parent_id: null,
      updated_at: now
    },
    {
      id: 'lf-wayuu-act3.1',
      project_id: projId,
      type: 'activity',
      code: 'A-3.1',
      description: 'Diseño técnico de las 5 propuestas de experiencias turísticas y evaluación competitiva mediante Pitch Vivencial.',
      parent_id: lf_out3,
      updated_at: now
    },
    {
      id: 'lf-wayuu-act3.2',
      project_id: projId,
      type: 'activity',
      code: 'A-3.2',
      description: 'Ejecución de validaciones operativas y viajes de familiarización (FAM TRIP) con agencias turísticas.',
      parent_id: lf_out3,
      updated_at: now
    },

    // Resultado 4: Comercialización
    {
      id: lf_out4,
      project_id: projId,
      type: 'outcome',
      code: 'R-4',
      description: 'Articulación comercial (Modelo B2B) y mecanismos de sostenibilidad financiera comunitaria.',
      parent_id: null,
      updated_at: now
    },
    {
      id: 'lf-wayuu-act4.1',
      project_id: projId,
      type: 'activity',
      code: 'A-4.1',
      description: 'Formalización de alianzas estratégicas con operadores de la cadena de valor turística regional.',
      parent_id: lf_out4,
      updated_at: now
    },
    {
      id: 'lf-wayuu-act4.2',
      project_id: projId,
      type: 'activity',
      code: 'A-4.2',
      description: 'Adopción de acuerdos comunitarios y constitución de fondos de ahorro y reinversión para mantenimiento de activos.',
      parent_id: lf_out4,
      updated_at: now
    }
  ]);

  // 3. Indicadores Oficiales de la Propuesta (Sección 9)
  await db.indicators.bulkAdd([
    {
      id: 'ind-wayuu-101',
      project_id: projId,
      logframe_id: lf_out1,
      code: 'IND-1.1',
      name: 'Personas que culminan los ciclos de formación en turismo, inocuidad y pesca',
      unit: 'Participantes',
      baseline: 0,
      target: 100,
      actual: 15, // Supongamos un avance inicial de socialización
      updated_at: now
    },
    {
      id: 'ind-wayuu-102',
      project_id: projId,
      logframe_id: lf_out1,
      code: 'IND-1.2',
      name: 'Asociaciones de pescadores fortalecidas en gobernanza comunitaria y administración',
      unit: 'Asociaciones',
      baseline: 0,
      target: 5,
      actual: 2, // 2 asociaciones ya iniciaron diagnósticos asociativos
      updated_at: now
    },
    {
      id: 'ind-wayuu-201',
      project_id: projId,
      logframe_id: lf_out2,
      code: 'IND-2.1',
      name: 'Asociaciones pesqueras dotadas de activos productivos de conservación y seguridad marítima',
      unit: 'Asociaciones',
      baseline: 0,
      target: 2,
      actual: 0,
      updated_at: now
    },
    {
      id: 'ind-wayuu-301',
      project_id: projId,
      logframe_id: lf_out3,
      code: 'IND-3.1',
      name: 'Propuestas de experiencias turísticas comunitarias estructuradas y costeadas',
      unit: 'Propuestas',
      baseline: 0,
      target: 5,
      actual: 1, // Una primera propuesta borrador en Mayapo
      updated_at: now
    },
    {
      id: 'ind-wayuu-302',
      project_id: projId,
      logframe_id: lf_out3,
      code: 'IND-3.2',
      name: 'Experiencias de pescaturismo fortalecidas, validadas en campo e implementadas',
      unit: 'Experiencias',
      baseline: 0,
      target: 2,
      actual: 0,
      updated_at: now
    },
    {
      id: 'ind-wayuu-401',
      project_id: projId,
      logframe_id: lf_out4,
      code: 'IND-4.1',
      name: 'Alianzas o acuerdos de articulación comercial establecidos con operadores (B2B)',
      unit: 'Alianzas',
      baseline: 0,
      target: 4,
      actual: 0,
      updated_at: now
    },
    {
      id: 'ind-wayuu-402',
      project_id: projId,
      logframe_id: lf_out4,
      code: 'IND-4.2',
      name: 'Mecanismos comunitarios de ahorro y fondos de reinversión adoptados formalmente',
      unit: 'Mecanismos',
      baseline: 0,
      target: 2,
      actual: 0,
      updated_at: now
    }
  ]);

  // 4. Plantillas de Encuesta adaptadas al proyecto Wayuu
  await db.surveys.bulkAdd([
    {
      id: 'srv-wayuu-101',
      title: 'Ficha de Caracterización y Diagnóstico Socioeconómico (Mes 1)',
      description: 'Formulario oficial de caracterización socioeconómica individual para el censo de pescadores artesanales en Mayapo y El Pájaro.',
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
      description: 'Encuesta técnica para evaluar la viabilidad operativa y comercial de las experiencias piloto de pescaturismo con agencias de viaje.',
      schema: {
        fields: [
          { name: 'agency_name', label: 'Agencia de Viajes / Operadora Turística', type: 'text', required: true },
          { name: 'route_evaluated', label: 'Experiencia Turística Evaluada', type: 'select', options: ['Pesca Ancestral Wayuu en Mayapo', 'Ruta de la Tortuga y Gastronomía en El Pájaro'], required: true },
          { name: 'cultural_respect', label: 'Nivel de pertinencia y respeto cultural Wayuu (1 al 5)', type: 'number', required: true },
          { name: 'safety_equipment', label: '¿Se constató el uso de chalecos salvavidas y equipos náuticos de seguridad?', type: 'select', options: ['Sí, todo el equipamiento reglamentario', 'Parcialmente (faltaban algunos chalecos)', 'No contaban con equipos de seguridad marítima'], required: true },
          { name: 'commercial_potential', label: 'Potencial de inserción en el portafolio B2B de su agencia', type: 'select', options: ['Alto potencial, listos para firmar acuerdo', 'Medio potencial, requiere ajustes de costo/tiempos', 'Bajo potencial, no se adapta a nuestro público'], required: true },
          { name: 'improvement_points', label: 'Recomendaciones de mejora operativa identificadas', type: 'textarea', required: false }
        ]
      },
      created_by: 'coordinacion@guajiracompetitiva.org',
      updated_at: now
    }
  ]);

  // 5. Quejas y Sugerencias de comunidades Wayuu
  await db.feedbacks.bulkAdd([
    {
      id: 'fb-wayuu-101',
      project_id: projId,
      category: 'complaint',
      details: 'Pescadores de la zona norte de Mayapo reportan que la marea alta ha socavado los postes de amarre y solicitan priorizar el estudio de geolocalización de puntos de embarque.',
      contact_info: 'Líder Gelasio Uriana, Cel: 312-445588',
      status: 'pending',
      updated_at: now,
      sync_status: 'synced'
    },
    {
      id: 'fb-wayuu-102',
      project_id: projId,
      category: 'suggestion',
      details: 'Sugerimos que los talleres de servicio al cliente del SENA se dicten en la tarde en el Centro de Mayapo, para evitar cruces con la jornada de pesca matutina.',
      contact_info: 'Asociación Mar del Cabo',
      status: 'under_review',
      updated_at: now,
      sync_status: 'synced'
    }
  ]);

  // 6. Lecciones Aprendidas de Proyectos Anteriores (Ruta Jemeilli y Turismo Emprende)
  await db.lessons_learned.bulkAdd([
    {
      id: 'll-wayuu-101',
      project_id: projId,
      title: 'Estandarización de tarifas netas para el canal B2B',
      description: 'Durante la operación piloto de la Ruta Ancestral Jemeilli, se evidenció que las agencias mayoristas exigen tarifas netas fijas anualizadas con al menos 20% de comisión garantizada y seguros de accidentes activos.',
      challenges: 'Las asociaciones comunitarias cambiaban los costos de los almuerzos de mariscos semanalmente según el precio de mercado, rompiendo reservas previas de agencias asociadas.',
      recommendations: 'Establecer acuerdos de costos fijos estacionales por semestre con las asociaciones y contratar pólizas colectivas anuales desde el mes de diseño del producto turístico.',
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
