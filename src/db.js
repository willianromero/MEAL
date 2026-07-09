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

  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', dataBytes);
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

export async function bulkPutWithSignature(store, records) {
  const signed = await Promise.all(records.map(async r => {
    const signature = await calculateRecordHash(r);
    return { ...r, signature };
  }));
  await store.bulkPut(signed);
  return signed;
}

export const db = new Dexie('MealOfflineDB');

// --- ESQUEMA v1 (histórico, previo al DRT v2.0) ---
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

// --- ESQUEMA v2: Plataforma multi-tenant (DRT v2.0, Sección 7) ---
// Regla transversal: toda tabla operativa lleva tenant_id y se filtra por él.
db.version(2).stores({
  // Núcleo multi-tenant
  tenants: 'id, nombre, estado, updated_at, sync_status',
  memberships: 'id, usuario_id, tenant_id, rol, [usuario_id+tenant_id], updated_at, sync_status',
  profiles: 'id, email, role, updated_at, sync_status, signature',

  // Catálogo maestro por tenant
  units: 'id, tenant_id, nombre, municipio, updated_at, sync_status',
  program_lines: 'id, tenant_id, codigo, orden, updated_at, sync_status',
  projects: 'id, tenant_id, name, status, start_date, end_date, updated_at, sync_status, signature',
  logframes: 'id, tenant_id, project_id, type, code, parent_id, updated_at, sync_status, signature',

  // Indicadores (catálogo + serie temporal)
  indicators: 'id, tenant_id, project_id, logframe_id, linea_id, code, name, updated_at, sync_status, signature',
  indicator_values: 'id, tenant_id, indicador_id, unidad_id, periodo, updated_at, sync_status',

  // Formularios configurables y captura de campo
  forms: 'id, tenant_id, codigo, version, linea_id, activo, updated_at, sync_status',
  field_records: 'id, tenant_id, formulario_id, unidad_id, proyecto_id, autor_id, estado_validacion, capturado_at, updated_at, sync_status',
  evidences: 'id, tenant_id, registro_id, tipo, updated_at, sync_status',

  // Beneficiarios y Habeas Data (Ley 1581/2012)
  beneficiaries: 'id, tenant_id, unidad_id, documento_hash, updated_at, sync_status',
  consents: 'id, tenant_id, beneficiario_id, otorgado, updated_at, sync_status',

  // Encuestas legadas (migran al motor de formularios en Fase 2)
  surveys: 'id, tenant_id, title, created_by, updated_at, sync_status, signature',
  survey_responses: 'id, tenant_id, survey_id, submitted_by, submitted_at, updated_at, sync_status, signature',

  // PQRS / alertas tempranas y aprendizaje
  feedbacks: 'id, tenant_id, project_id, unidad_id, category, nivel, estado, status, updated_at, sync_status, signature',
  lessons_learned: 'id, tenant_id, project_id, title, updated_at, sync_status, signature',

  // Bitácora de auditoría (append-only: nunca se actualiza ni borra)
  audit_log: 'id, tenant_id, actor_id, entidad, entidad_id, created_at, sync_status',

  sync_meta: 'key, value'
}).upgrade(async (tx) => {
  // Migración v1 → v2: asignar tenant_id a los datos existentes.
  // Los proyectos sembrados en v1 se convierten en tenants reales (decisión del plan DRT).
  const tenantForProject = (projectId) =>
    projectId === 'proj-maicao-002' ? 'ten-maicao' : 'ten-wayuu';

  await tx.table('projects').toCollection().modify(p => {
    p.tenant_id = tenantForProject(p.id);
  });
  for (const tableName of ['logframes', 'indicators', 'feedbacks', 'lessons_learned']) {
    await tx.table(tableName).toCollection().modify(r => {
      r.tenant_id = tenantForProject(r.project_id);
    });
  }
  // Las encuestas legadas pertenecían al proyecto Wayuu
  await tx.table('surveys').toCollection().modify(r => { r.tenant_id = 'ten-wayuu'; });
  await tx.table('survey_responses').toCollection().modify(r => { r.tenant_id = 'ten-wayuu'; });
});

// --- BITÁCORA DE AUDITORÍA (M13): registro append-only de operaciones sensibles ---
export async function logAudit({ tenantId, actorId, actorEmail, accion, entidad, entidadId, antes = null, despues = null }) {
  const now = new Date().toISOString();
  const entry = {
    id: globalThis.crypto.randomUUID(),
    tenant_id: tenantId || null,
    actor_id: actorId || null,
    actor_email: actorEmail || null,
    accion,
    entidad,
    entidad_id: entidadId || null,
    antes,
    despues,
    created_at: now,
    updated_at: now,
    sync_status: 'pending_sync'
  };
  return addWithSignature(db.audit_log, entry);
}

// --- SEMBRADO POR CONFIGURACIÓN DE TENANT (DRT: "configuración, no código") ---
// Cada tenant es un archivo de configuración en src/seeds/. Dar de alta un
// proyecto nuevo = agregar configuración, sin tocar la lógica de la plataforma.
export async function seedLocalData() {
  const { TENANT_SEEDS } = await import('./seeds/index.js');
  const { seedTenantConfig } = await import('./seeds/seedEngine.js');

  let anySeeded = false;
  for (const config of TENANT_SEEDS) {
    const seeded = await seedTenantConfig(db, config);
    anySeeded = seeded || anySeeded;
  }

  const meta = await db.sync_meta.get('last_synced_at');
  if (!meta) {
    await db.sync_meta.bulkPut([
      { key: 'last_synced_at', value: '1970-01-01T00:00:00.000Z' },
      { key: 'network_mode', value: 'online' }
    ]);
  }

  if (anySeeded) {
    console.log('Sembrado de configuración de tenants completado (firmas SHA-256 aplicadas).');
  } else {
    console.log('Los tenants ya están sembrados localmente.');
  }
}
