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

// Función para inicializar datos semilla locales si la base de datos está vacía
export async function seedLocalData() {
  const projectCount = await db.projects.count();
  if (projectCount > 0) return; // Ya hay datos, no re-sembrar

  console.log('Sembrando datos locales iniciales en Dexie...');

  // 1. Proyectos Semilla
  const p1_id = 'e7b08b3e-e6bf-4632-9b2f-1aef201c1001';
  const p2_id = 'e7b08b3e-e6bf-4632-9b2f-1aef201c1002';
  
  const now = new Date().toISOString();

  await db.projects.bulkAdd([
    {
      id: p1_id,
      name: 'Acceso Seguro al Agua Potable y Saneamiento (ASAPS)',
      description: 'Proyecto orientado a construir sistemas de recolección de agua y letrinas en comunidades rurales vulnerables.',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      status: 'active',
      updated_at: now
    },
    {
      id: p2_id,
      name: 'Seguridad Alimentaria y Huertos Familiares Urbanos',
      description: 'Establecimiento de huertos urbanos comunitarios para mejorar la nutrición familiar en zonas vulnerables.',
      start_date: '2026-03-01',
      end_date: '2026-11-30',
      status: 'active',
      updated_at: now
    }
  ]);

  // 2. Marcos Lógicos Semilla (LogFrames)
  const lf1_out1 = 'lf-101';
  const lf1_act1 = 'lf-102';
  const lf2_out1 = 'lf-201';
  const lf2_act1 = 'lf-202';

  await db.logframes.bulkAdd([
    // Proyecto 1
    {
      id: lf1_out1,
      project_id: p1_id,
      type: 'outcome',
      code: 'R-1',
      description: 'Las familias participantes cuentan con acceso regular a agua libre de contaminantes.',
      parent_id: null,
      updated_at: now
    },
    {
      id: lf1_act1,
      project_id: p1_id,
      type: 'activity',
      code: 'A-1.1',
      description: 'Instalación de 50 sistemas familiares de recolección y filtrado de agua de lluvia.',
      parent_id: lf1_out1,
      updated_at: now
    },
    // Proyecto 2
    {
      id: lf2_out1,
      project_id: p2_id,
      type: 'outcome',
      code: 'R-1',
      description: 'Familias incrementan su consumo diario de hortalizas frescas cultivadas localmente.',
      parent_id: null,
      updated_at: now
    },
    {
      id: lf2_act1,
      project_id: p2_id,
      type: 'activity',
      code: 'A-1.1',
      description: 'Entrega de kits de siembra y capacitación presencial a 120 jefas de hogar.',
      parent_id: lf2_out1,
      updated_at: now
    }
  ]);

  // 3. Indicadores Semilla
  await db.indicators.bulkAdd([
    // Proyecto 1
    {
      id: 'ind-101',
      project_id: p1_id,
      logframe_id: lf1_out1,
      code: 'IND-1.1',
      name: 'Número de letrinas sanitarias construidas y en funcionamiento',
      unit: 'Letrinas',
      baseline: 0,
      target: 50,
      actual: 18,
      updated_at: now
    },
    {
      id: 'ind-102',
      project_id: p1_id,
      logframe_id: lf1_act1,
      code: 'IND-1.2',
      name: 'Porcentaje de familias con acceso directo a agua potable',
      unit: 'Porcentaje',
      baseline: 15,
      target: 90,
      actual: 35,
      updated_at: now
    },
    // Proyecto 2
    {
      id: 'ind-201',
      project_id: p2_id,
      logframe_id: lf2_out1,
      code: 'IND-2.1',
      name: 'Huertos comunitarios implementados y activos',
      unit: 'Huertos',
      baseline: 0,
      target: 10,
      actual: 4,
      updated_at: now
    },
    {
      id: 'ind-202',
      project_id: p2_id,
      logframe_id: lf2_act1,
      code: 'IND-2.2',
      name: 'Número de personas capacitadas en técnicas agroecológicas',
      unit: 'Personas',
      baseline: 0,
      target: 120,
      actual: 45,
      updated_at: now
    }
  ]);

  // 4. Plantillas de Encuestas Semilla
  await db.surveys.bulkAdd([
    {
      id: 'srv-101',
      title: 'Monitoreo Técnico de Agua y Saneamiento',
      description: 'Formulario técnico para registrar el estado de los tanques de agua instalados y satisfacción del usuario.',
      schema: {
        fields: [
          { name: 'beneficiary_name', label: 'Nombre del Beneficiario', type: 'text', required: true },
          { name: 'family_members', label: 'Cantidad de miembros en el hogar', type: 'number', required: true },
          { name: 'tank_status', label: 'Estado del Filtro/Tanque de Agua', type: 'select', options: ['Excelente', 'Bueno', 'Requiere Mantenimiento', 'No Funciona'], required: true },
          { name: 'water_taste', label: '¿El agua tiene sabor u olor extraño?', type: 'select', options: ['No, totalmente limpia', 'Sí, sabor metálico/tierra', 'Sí, turbia'], required: false },
          { name: 'comments', label: 'Observaciones Técnicas', type: 'textarea', required: false }
        ]
      },
      created_by: 'system',
      updated_at: now
    },
    {
      id: 'srv-102',
      title: 'Registro de Capacitación de Huertos Familiares',
      description: 'Encuesta corta para evaluar la asimilación del taller práctico de siembra y entrega de kits.',
      schema: {
        fields: [
          { name: 'participant_name', label: 'Nombre del Participante', type: 'text', required: true },
          { name: 'gender', label: 'Género del Participante', type: 'select', options: ['Femenino', 'Masculino', 'Otro'], required: true },
          { name: 'kit_received', label: '¿Recibió el kit completo de herramientas y semillas?', type: 'select', options: ['Sí, completo', 'Incompleto', 'No recibió'], required: true },
          { name: 'understanding_score', label: 'Nivel de comprensión de la capacitación (1 al 5)', type: 'number', required: true },
          { name: 'challenges', label: '¿Cuáles son los principales desafíos identificados para su huerto?', type: 'textarea', required: false }
        ]
      },
      created_by: 'system',
      updated_at: now
    }
  ]);

  // 5. Quejas y Sugerencias Semilla
  await db.feedbacks.bulkAdd([
    {
      id: 'fb-101',
      project_id: p1_id,
      category: 'complaint',
      details: 'El sistema de filtrado instalado en el Sector 3 presenta una fisura en el grifo secundario y gotea constantemente.',
      contact_info: 'Maria Gomez, Tel: 555-0199',
      status: 'pending',
      updated_at: now,
      sync_status: 'synced'
    },
    {
      id: 'fb-102',
      project_id: p2_id,
      category: 'suggestion',
      details: 'Sería de gran utilidad programar la capacitación de compostaje orgánico los fines de semana, ya que muchas participantes trabajan entre semana.',
      contact_info: 'Anonimo',
      status: 'under_review',
      updated_at: now,
      sync_status: 'synced'
    }
  ]);

  // 6. Lecciones Aprendidas Semilla
  await db.lessons_learned.bulkAdd([
    {
      id: 'll-101',
      project_id: p1_id,
      title: 'Alineación de tiempos con temporadas de lluvia',
      description: 'La entrega de tanques de recolección de agua pluvial debe completarse al menos un mes antes del inicio previsto de las lluvias.',
      challenges: 'Se entregaron tanques tarde y las primeras lluvias torrenciales lavaron los cimientos inacabados de 3 tanques en terreno inclinado.',
      recommendations: 'Avanzar los cimientos de concreto en época seca (diciembre-enero) y montar los tanques justo al iniciar las lluvias.',
      updated_at: now,
      sync_status: 'synced'
    }
  ]);

  // 7. Sincronización Meta Inicial
  await db.sync_meta.bulkAdd([
    { key: 'last_synced_at', value: '1970-01-01T00:00:00.000Z' },
    { key: 'network_mode', value: 'online' }
  ]);

  console.log('Sembrado de Dexie finalizado.');
}
