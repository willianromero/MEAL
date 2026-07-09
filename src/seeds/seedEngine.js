import { bulkPutWithSignature, putWithSignature } from '../db';
// Reexporta las constantes por compatibilidad con quienes las importan de aquí.
export { DEFAULT_PQRS_LEVELS, DEFAULT_ROLE_NAMES } from './defaults.js';

// Motor genérico de sembrado por tenant (DRT Sección 17.5):
// recibe un objeto de configuración y lo materializa en la BD local.
// Es idempotente: si el tenant ya existe, no vuelve a sembrar.
export async function seedTenantConfig(db, config) {
  const existing = await db.tenants.get(config.tenant.id);
  if (existing) return false;

  console.log(`Sembrando configuración del tenant "${config.tenant.nombre}"...`);
  const now = new Date().toISOString();
  const stamp = (record) => ({
    updated_at: now,
    sync_status: 'synced',
    ...record
  });

  await putWithSignature(db.tenants, stamp(config.tenant));

  const putScoped = async (store, rows) => {
    if (!rows || rows.length === 0) return;
    await bulkPutWithSignature(store, rows.map(r => stamp({ tenant_id: config.tenant.id, ...r })));
  };

  await putScoped(db.program_lines, config.lines);
  await putScoped(db.units, config.units);
  await putScoped(db.projects, config.projects);
  await putScoped(db.logframes, config.logframes);
  await putScoped(db.indicators, config.indicators);
  await putScoped(db.forms, config.forms);
  await putScoped(db.surveys, config.surveys);
  await putScoped(db.survey_responses, config.survey_responses);
  await putScoped(db.beneficiaries, config.beneficiaries);
  await putScoped(db.consents, config.consents);
  await putScoped(db.feedbacks, config.feedbacks);
  await putScoped(db.lessons_learned, config.lessons);
  await putScoped(db.memberships, config.memberships);

  return true;
}

