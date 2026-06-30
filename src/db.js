import Dexie from 'dexie';

// --- PILAR CRIPTOGRÁFICO: Web Crypto API SHA-256 Determinista ---
export async function calculateRecordHash(record) {
  if (!record) return '';
  const clean = { ...record };
  delete clean.signature;
  delete clean.sync_status;

  const keys = Object.keys(clean).sort();
  const sortedObj = {};
  keys.forEach(k => {
    sortedObj[k] = clean[k];
  });
  
  const jsonString = JSON.stringify(sortedObj);
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(jsonString);

  const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export async function addWithSignature(store, record) {
  const signature = await calculateRecordHash(record);
  const signed = { ...record, signature };
  await store.add(signed);
  return signed;
}

export async function putWithSignature(store, record) {
  const signature = await calculateRecordHash(record);
  const signed = { ...record, signature };
  await store.put(signed);
  return signed;
}

async function bulkAddWithSignature(store, records) {
  const signed = await Promise.all(records.map(async r => {
    const signature = await calculateRecordHash(r);
    return { ...r, signature };
  }));
  await store.bulkAdd(signed);
}

export const db = new Dexie('MealOfflineDB');

db.version(1).stores({
  profiles: 'id, email, role, updated_at, sync_status, signature',
  projects: 'id, name, status, start_date, end_date, updated_at, signature',
  logframes: 'id, project_id, type, code, parent_id, updated_at, signature',
  indicators: 'id, project_id, logframe_id, code, name, updated_at, signature',
  surveys: 'id, title, created_by, updated_at, signature',
  survey_responses: 'id, survey_id, submitted_by, submitted_at, updated_at, sync_status, signature',
  feedbacks: 'id, project_id, category, status, updated_at, sync_status, signature',
  lessons_learned: 'id, project_id, title, updated_at, sync_status, signature',
  sync_meta: 'key, value'
});

// Función para inicializar datos semilla de los proyectos
export async function seedLocalData() {
  const projectCount = await db.projects.count();
  const hasWayuu = await db.projects.get('proj-wayuu-001');
  const hasMaicao = await db.projects.get('proj-maicao-002');
  const hasImpact = await db.logframes.get('lf-wayuu-impact');
  
  if (projectCount >= 2 && hasWayuu && hasMaicao && hasImpact) {
    console.log('Los proyectos ya están sembrados localmente.');
    return;
  }

  console.log('Sembrando datos de "Guardianes del Mar Wayuu" y "Clínica Maicao" en Dexie con Firmas SHA-256...');
  
  // Limpiar para asegurar reinicio limpio
  await db.projects.clear();
  await db.logframes.clear();
  await db.indicators.clear();
  await db.surveys.clear();
  await db.survey_responses.clear();
  await db.feedbacks.clear();
  await db.lessons_learned.clear();
  await db.sync_meta.clear();

  const now = new Date().toISOString();
  const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
  
  const projWayuuId = 'proj-wayuu-001';
  const projMaicaoId = 'proj-maicao-002';

  // ==========================================
  // 1. PROYECTO 1: GUARDIANES DEL MAR WAYUU
  // ==========================================

  await addWithSignature(db.projects, {
    id: projWayuuId,
    name: 'Guardianes del Mar Wayuu',
    description: 'Fortalecimiento pesquero artesanal y desarrollo de experiencias turísticas comunitarias sostenibles en Mayapo y El Pájaro, Manaure, La Guajira.',
    start_date: '2026-06-01',
    end_date: '2027-04-01',
    status: 'active',
    updated_at: now
  });

  const lf_wayuu_impact = 'lf-wayuu-impact';
  const lf_wayuu_out1 = 'lf-wayuu-out1'; 
  const lf_wayuu_out2 = 'lf-wayuu-out2'; 
  const lf_wayuu_out3 = 'lf-wayuu-out3'; 
  const lf_wayuu_out4 = 'lf-wayuu-out4'; 
  const lf_wayuu_outp1_1 = 'lf-wayuu-outp1.1'; 
  const lf_wayuu_outp2_1 = 'lf-wayuu-outp2.1'; 

  await bulkAddWithSignature(db.logframes, [
    {
      id: lf_wayuu_impact,
      project_id: projWayuuId,
      type: 'impact',
      code: 'OBJ-G',
      description: 'Mejorar de forma sostenible las condiciones socioeconómicas, la gobernanza comunitaria y la resiliencia climática de las comunidades pesqueras artesanales Wayuu en La Guajira.',
      parent_id: null,
      updated_at: now
    },
    {
      id: lf_wayuu_out1,
      project_id: projWayuuId,
      type: 'outcome',
      code: 'R-1',
      description: 'Fortalecimiento de la gobernanza asociativa y las capacidades organizacionales para la auto-gestión del territorio costero.',
      parent_id: lf_wayuu_impact,
      updated_at: now
    },
    {
      id: lf_wayuu_out2,
      project_id: projWayuuId,
      type: 'outcome',
      code: 'R-2',
      description: 'Mejoramiento de las capacidades productivas, cadena de frío y seguridad marítima de las tripulaciones.',
      parent_id: lf_wayuu_impact,
      updated_at: now
    },
    {
      id: lf_wayuu_out3,
      project_id: projWayuuId,
      type: 'outcome',
      code: 'R-3',
      description: 'Estructuración y validación del portafolio comunitario de pescaturismo y patrimonio cultural.',
      parent_id: lf_wayuu_impact,
      updated_at: now
    },
    {
      id: lf_wayuu_out4,
      project_id: projWayuuId,
      type: 'outcome',
      code: 'R-4',
      description: 'Establecimiento de acuerdos comerciales estables y mecanismos de financiamiento para la sostenibilidad.',
      parent_id: lf_wayuu_impact,
      updated_at: now
    },
    {
      id: lf_wayuu_outp1_1,
      project_id: projWayuuId,
      type: 'output',
      code: 'P-1.1',
      description: 'Diagnóstico base completado y talleres de gobernanza impartidos a líderes tradicionales.',
      parent_id: lf_wayuu_out1,
      updated_at: now
    },
    {
      id: lf_wayuu_outp2_1,
      project_id: projWayuuId,
      type: 'output',
      code: 'P-2.1',
      description: 'Activos estratégicos (cavas de frío, chalecos de seguridad, GPS náuticos) entregados a cooperativas.',
      parent_id: lf_wayuu_out2,
      updated_at: now
    },
    {
      id: 'lf-wayuu-act1.1',
      project_id: projWayuuId,
      type: 'activity',
      code: 'A-1.1',
      description: 'Socialización y concertación territorial del censo en Wayuunaiki con autoridades tradicionales.',
      parent_id: lf_wayuu_outp1_1,
      updated_at: now
    },
    {
      id: 'lf-wayuu-act1.2',
      project_id: projWayuuId,
      type: 'activity',
      code: 'A-1.2',
      description: 'Campaña de caracterización socioeconómica individual de pescadores artesanales en campo.',
      parent_id: lf_wayuu_outp1_1,
      updated_at: now
    },
    {
      id: 'lf-wayuu-act2.1',
      project_id: projWayuuId,
      type: 'activity',
      code: 'A-2.1',
      description: 'Entrega técnica de activos de conservación y cavas isotérmicas.',
      parent_id: lf_wayuu_outp2_1,
      updated_at: now
    },
    {
      id: 'lf-wayuu-act2.2',
      project_id: projWayuuId,
      type: 'activity',
      code: 'A-2.2',
      description: 'Talleres de capacitación en cartografía náutica y primeros auxilios marítimos.',
      parent_id: lf_wayuu_outp2_1,
      updated_at: now
    }
  ]);

  await bulkAddWithSignature(db.indicators, [
    {
      id: 'ind-wayuu-101',
      project_id: projWayuuId,
      logframe_id: lf_wayuu_out1,
      code: 'IND-1.1',
      name: 'Personas que culminan los ciclos de formación en turismo, inocuidad y pesca',
      unit: 'Participantes',
      baseline: 0,
      target: 100,
      actual: 15,
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
      project_id: projWayuuId,
      logframe_id: lf_wayuu_out1,
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
      project_id: projWayuuId,
      logframe_id: lf_wayuu_out2,
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
      updated_at: fortyDaysAgo
    },
    {
      id: 'ind-wayuu-301',
      project_id: projWayuuId,
      logframe_id: lf_wayuu_out3,
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

  // ==========================================
  // 2. PROYECTO 2: CLÍNICA MAICAO (Reforma Laboral)
  // ==========================================

  await addWithSignature(db.projects, {
    id: projMaicaoId,
    name: 'Implementación Reforma Laboral - Clínica Maicao',
    description: 'Diseño, adecuación e implementación del modelo laboral organizacional de la Clínica Maicao en el marco de la Ley 2466 de 2025 (Reforma Laboral), mitigando riesgos jurídicos y optimizando mallas de turnos de salud de alta complejidad.',
    start_date: '2026-03-30',
    end_date: '2026-09-30',
    status: 'active',
    updated_at: now
  });

  const lf_maicao_impact = 'lf-maicao-impact';
  const lf_maicao_out1 = 'lf-maicao-out1'; 
  const lf_maicao_out2 = 'lf-maicao-out2'; 
  const lf_maicao_out3 = 'lf-maicao-out3'; 
  const lf_maicao_out4 = 'lf-maicao-out4'; 
  const lf_maicao_otp1_1 = 'lf-maicao-otp1.1'; 
  const lf_maicao_otp2_1 = 'lf-maicao-otp2.1'; 
  const lf_maicao_otp3_1 = 'lf-maicao-otp3.1'; 
  const lf_maicao_otp4_1 = 'lf-maicao-otp4.1'; 

  await bulkAddWithSignature(db.logframes, [
    // Nivel 1: IMPACTO
    {
      id: lf_maicao_impact,
      project_id: projMaicaoId,
      type: 'impact',
      code: 'OBJ-G',
      description: 'Garantizar la adecuada implementación de la Reforma Laboral (Ley 2466 de 2025) en la Clínica Maicao mediante un modelo de transformación organizacional 360° para mitigar riesgos legales y optimizar la continuidad del servicio de salud.',
      parent_id: null,
      updated_at: now
    },
    // Nivel 2: RESULTADOS
    {
      id: lf_maicao_out1,
      project_id: projMaicaoId,
      type: 'outcome',
      code: 'R-1',
      description: 'Adecuación normativa, prevención de riesgo jurídico y fortalecimiento del marco legal institucional.',
      parent_id: lf_maicao_impact,
      updated_at: now
    },
    {
      id: lf_maicao_out2,
      project_id: projMaicaoId,
      type: 'outcome',
      code: 'R-2',
      description: 'Optimización de la estructura de jornada laboral, turnos, mallas, liquidación de nómina y recargos.',
      parent_id: lf_maicao_impact,
      updated_at: now
    },
    {
      id: lf_maicao_out3,
      project_id: projMaicaoId,
      type: 'outcome',
      code: 'R-3',
      description: 'Fortalecimiento del clima laboral, prevención de conflictos y cumplimiento de obligaciones en riesgo psicosocial.',
      parent_id: lf_maicao_impact,
      updated_at: now
    },
    {
      id: lf_maicao_out4,
      project_id: projMaicaoId,
      type: 'outcome',
      code: 'R-4',
      description: 'Apropiación institucional y capacitación del talento humano sobre los cambios derivados de la reforma laboral.',
      parent_id: lf_maicao_impact,
      updated_at: now
    },
    // Nivel 3: PRODUCTOS
    {
      id: lf_maicao_otp1_1,
      project_id: projMaicaoId,
      type: 'output',
      code: 'P-1.1',
      description: 'Políticas de contratación y modelos contractuales adaptados y redactados.',
      parent_id: lf_maicao_out1,
      updated_at: now
    },
    {
      id: lf_maicao_otp2_1,
      project_id: projMaicaoId,
      type: 'output',
      code: 'P-2.1',
      description: 'Manual de jornada laboral adaptado a 42 horas y mallas de turnos de salud optimizadas.',
      parent_id: lf_maicao_out2,
      updated_at: now
    },
    {
      id: lf_maicao_otp3_1,
      project_id: projMaicaoId,
      type: 'output',
      code: 'P-3.1',
      description: 'Protocolo de prevención del acoso laboral y diagnóstico psicosocial.',
      parent_id: lf_maicao_out3,
      updated_at: now
    },
    {
      id: lf_maicao_otp4_1,
      project_id: projMaicaoId,
      type: 'output',
      code: 'P-4.1',
      description: 'Talleres presenciales de formación ejecutados y kit pedagógico institucional de reforma.',
      parent_id: lf_maicao_out4,
      updated_at: now
    },
    // Nivel 4: ACTIVIDADES
    {
      id: 'lf-maicao-act1.1',
      project_id: projMaicaoId,
      type: 'activity',
      code: 'A-1.1',
      description: 'Elaboración del informe diagnóstico jurídico de la Clínica y matriz de riesgos inicial.',
      parent_id: lf_maicao_otp1_1,
      updated_at: now
    },
    {
      id: 'lf-maicao-act2.1',
      project_id: projMaicaoId,
      type: 'activity',
      code: 'A-2.1',
      description: 'Ejecución de simulaciones financieras sobre el impacto de recargos nocturnos y dominicales.',
      parent_id: lf_maicao_otp2_1,
      updated_at: now
    },
    {
      id: 'lf-maicao-act3.1',
      project_id: projMaicaoId,
      type: 'activity',
      code: 'A-3.1',
      description: 'Aplicación de encuestas de evaluación del riesgo psicosocial del personal médico y administrativo.',
      parent_id: lf_maicao_otp3_1,
      updated_at: now
    },
    {
      id: 'lf-maicao-act4.1',
      project_id: projMaicaoId,
      type: 'activity',
      code: 'A-4.1',
      description: 'Diseño e impartición de talleres de gestión del cambio para coordinadores y jefes de área.',
      parent_id: lf_maicao_otp4_1,
      updated_at: now
    }
  ]);

  await bulkAddWithSignature(db.indicators, [
    {
      id: 'ind-maicao-101',
      project_id: projMaicaoId,
      logframe_id: lf_maicao_out1,
      code: 'IND-1.1',
      name: 'Porcentaje de adecuación jurídica de contratos del personal',
      unit: '%',
      baseline: 0,
      target: 100,
      actual: 0,
      disaggregated_data: {
        gender: { male: 0, female: 0, other: 0 },
        age: { children: 0, youth: 0, adult: 0, elder: 0 },
        ethnicity: { indigenous: 0, afrodescendant: 0, local: 0 },
        location: { Mayapo: 0, ElPajaro: 0 }
      },
      updated_at: now
    },
    {
      id: 'ind-maicao-201',
      project_id: projMaicaoId,
      logframe_id: lf_maicao_out2,
      code: 'IND-2.1',
      name: 'Simulaciones financieras de nómina y turnos completadas y aprobadas',
      unit: 'Simulaciones',
      baseline: 0,
      target: 3,
      actual: 0,
      disaggregated_data: {
        gender: { male: 0, female: 0, other: 0 },
        age: { children: 0, youth: 0, adult: 0, elder: 0 },
        ethnicity: { indigenous: 0, afrodescendant: 0, local: 0 },
        location: { Mayapo: 0, ElPajaro: 0 }
      },
      updated_at: now
    },
    {
      id: 'ind-maicao-301',
      project_id: projMaicaoId,
      logframe_id: lf_maicao_out3,
      code: 'IND-3.1',
      name: 'Protocolo contra el acoso laboral socializado y aprobado',
      unit: 'Protocolo',
      baseline: 0,
      target: 1,
      actual: 0,
      disaggregated_data: {
        gender: { male: 0, female: 0, other: 0 },
        age: { children: 0, youth: 0, adult: 0, elder: 0 },
        ethnicity: { indigenous: 0, afrodescendant: 0, local: 0 },
        location: { Mayapo: 0, ElPajaro: 0 }
      },
      updated_at: now
    },
    {
      id: 'ind-maicao-401',
      project_id: projMaicaoId,
      logframe_id: lf_maicao_out4,
      code: 'IND-4.1',
      name: 'Colaboradores de la clínica capacitados en gestión del cambio',
      unit: 'Colaboradores',
      baseline: 0,
      target: 150,
      actual: 0,
      disaggregated_data: {
        gender: { male: 0, female: 0, other: 0 },
        age: { children: 0, youth: 0, adult: 0, elder: 0 },
        ethnicity: { indigenous: 0, afrodescendant: 0, local: 0 },
        location: { Mayapo: 0, ElPajaro: 0 }
      },
      updated_at: now
    }
  ]);

  // ==========================================
  // 3. DATOS SEMILLA ADICIONALES (Encuestas, Quejas, etc.)
  // ==========================================

  await bulkAddWithSignature(db.surveys, [
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
      created_by: 'coordinacion@guajiracompetitiva.org',
      updated_at: now
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
      created_by: 'coordinacion@guajiracompetitiva.org',
      updated_at: now
    }
  ]);

  await bulkAddWithSignature(db.feedbacks, [
    {
      id: 'fb-wayuu-101',
      project_id: projWayuuId,
      category: 'complaint',
      details: 'Pescadores de la zona norte de Mayapo reportan que la marea alta ha socavado los postes de amarre y solicitan priorizar el estudio de geolocalización de puntos de embarque.',
      contact_info: 'Líder Gelasio Uriana, Cel: 312-445588',
      status: 'pending',
      severity: 'medium',
      is_confidential: false,
      response_text: null,
      updated_at: now,
      created_at: now,
      sync_status: 'synced'
    },
    {
      id: 'fb-wayuu-102',
      project_id: projWayuuId,
      category: 'complaint',
      details: 'Reporte confidencial: Se detectaron sospechas de favoritismo familiar en la pre-asignación del kit de cavas de frío en la ranchería de El Pájaro.',
      contact_info: 'Pescador anónimo de El Pájaro',
      status: 'under_review',
      severity: 'high',
      is_confidential: true,
      response_text: null,
      created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: now,
      sync_status: 'synced'
    }
  ]);

  await bulkAddWithSignature(db.lessons_learned, [
    {
      id: 'll-wayuu-101',
      project_id: projWayuuId,
      title: 'Estandarización de tarifas netas para el canal B2B',
      description: 'Durante la operación piloto de la Ruta Ancestral Jemeilli, se evidenció que las agencias mayoristas exigen tarifas netas fijas anualizadas con comisiones del 20% y seguros de accidentes.',
      challenges: 'Las asociaciones comunitarias cambiaban los costos de los almuerzos semanalmente según el precio de mercado, rompiendo reservas de agencias.',
      recommendations: 'Establecer acuerdos de costos fijos estacionales por semestre con las asociaciones y contratar pólizas colectivas anuales.',
      action_plan: {
        description: 'Redactar acuerdo firmado de tarifas fijas para almuerzos con la cooperativa de Mayapo.',
        responsible: 'Coordinador Territorial MEAL',
        deadline: '2026-07-15',
        status: 'pending'
      },
      updated_at: now,
      sync_status: 'synced'
    }
  ]);

  await db.sync_meta.bulkAdd([
    { key: 'last_synced_at', value: '1970-01-01T00:00:00.000Z' },
    { key: 'network_mode', value: 'online' }
  ]);

  console.log('Sembrado de datos de los proyectos completado con éxito.');
}
