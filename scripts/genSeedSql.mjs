// Generador de supabase/seed.sql a partir de la configuración de tenants
// (src/seeds/). Reejecutar cuando cambie la configuración:  node scripts/genSeedSql.mjs
import { writeFileSync } from 'node:fs';
import { TENANT_SEEDS } from '../src/seeds/index.js';

// --- Literal SQL seguro para cada valor ---
function sql(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'object') {
    // jsonb
    return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  }
  return `'${String(v).replace(/'/g, "''")}'`;
}

// Columnas por tabla (el orden define el INSERT). Los id son text.
const SPECS = {
  tenants: ['id', 'nombre', 'financiador', 'entidad_ejecutora', 'unidad_analisis_default', 'moneda', 'vigencia_inicio', 'vigencia_fin', 'estado', 'config'],
  program_lines: ['id', 'tenant_id', 'codigo', 'nombre', 'tipo', 'orden', 'fases'],
  units: ['id', 'tenant_id', 'nombre', 'municipio', 'estado_reconocimiento', 'autoridad_tradicional', 'geopunto', 'poblacion_estimada', 'atributos'],
  projects: ['id', 'tenant_id', 'name', 'description', 'linea_id', 'unidad_ids', 'tipo', 'presupuesto', 'start_date', 'end_date', 'status'],
  logframes: ['id', 'tenant_id', 'project_id', 'type', 'code', 'description', 'parent_id'],
  indicators: ['id', 'tenant_id', 'project_id', 'logframe_id', 'linea_id', 'code', 'name', 'unit', 'baseline', 'target', 'actual', 'meta_tipo', 'frecuencia', 'medio_verificacion', 'formula', 'linea_base_valor', 'linea_base_congelada', 'meta_ajustable', 'disaggregated_data'],
  forms: ['id', 'tenant_id', 'codigo', 'nombre', 'version', 'linea_id', 'activo', 'campos'],
  surveys: ['id', 'tenant_id', 'title', 'description', 'indicator_id', 'schema', 'created_by'],
  feedbacks: ['id', 'tenant_id', 'project_id', 'unidad_id', 'category', 'canal', 'nivel', 'details', 'contact_info', 'is_confidential', 'estado', 'status', 'severity', 'response_text', 'created_at'],
  lessons_learned: ['id', 'tenant_id', 'project_id', 'title', 'description', 'challenges', 'recommendations', 'action_plan']
};

// Mapea una clave de config a su tabla destino
const COLLECTIONS = [
  ['lines', 'program_lines'],
  ['units', 'units'],
  ['projects', 'projects'],
  ['logframes', 'logframes'],
  ['indicators', 'indicators'],
  ['forms', 'forms'],
  ['surveys', 'surveys'],
  ['feedbacks', 'feedbacks'],
  ['lessons', 'lessons_learned']
];

function insertRow(table, row, tenantId) {
  const cols = SPECS[table];
  const vals = cols.map(c => {
    if (c === 'tenant_id') return sql(tenantId);
    return sql(row[c]);
  });
  return `insert into public.${table} (${cols.join(', ')}) values (${vals.join(', ')}) on conflict (id) do nothing;`;
}

let out = `-- ============================================================================
-- seed.sql — Configuración inicial de los tenants (GENERADO automáticamente
-- desde src/seeds/ por scripts/genSeedSql.mjs). No editar a mano.
-- Ejecutar en Supabase DESPUÉS de 001/002/003. Idempotente (on conflict do nothing).
-- ============================================================================

`;

for (const cfg of TENANT_SEEDS) {
  const t = cfg.tenant;
  out += `\n-- ===== Tenant: ${t.nombre} (${t.id}) =====\n`;
  out += insertRow('tenants', t) + '\n';
  for (const [key, table] of COLLECTIONS) {
    const rows = cfg[key];
    if (!rows || rows.length === 0) continue;
    out += `-- ${table} (${rows.length})\n`;
    for (const row of rows) out += insertRow(table, row, t.id) + '\n';
  }
}

// Verificación rápida al final
out += `\n-- Verificación: debe devolver 3 tenants\nselect id, nombre from public.tenants order by id;\n`;

writeFileSync(new URL('../supabase/seed.sql', import.meta.url), out, 'utf8');
console.log('supabase/seed.sql generado.');
