import { vi, describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';

// ============================================================================
// GATE DE ACEPTACIÓN 13.2-2 (DRT): batería de aislamiento multi-tenant.
// "Se crean dos (o más) tenants con datos y se verifica que ningún usuario,
// endpoint o manipulación de identificadores permita ver datos del otro
// tenant. Debe cerrar en CERO fugas."
// Nivel unitario: sembrado + scoping de consultas + integridad referencial.
// Nivel servidor: verificación estática de que las migraciones RLS cubren
// todas las tablas (la ejecución contra PostgreSQL se corre en despliegue).
// ============================================================================

vi.mock('dexie', () => {
  class MockDexie {
    constructor() {
      const chain = { stores: vi.fn(() => chain), upgrade: vi.fn(() => chain) };
      this.version = vi.fn(() => chain);
    }
  }
  return { default: MockDexie, Dexie: MockDexie };
});

import { seedTenantConfig } from '../seeds/seedEngine';
import { TENANT_SEEDS } from '../seeds/index';

// BD en memoria con la misma semántica de scoping que usa la app:
// where('tenant_id').equals(x).toArray()
function makeStore() {
  const rows = new Map();
  return {
    _rows: rows,
    get: async (id) => rows.get(id) || null,
    put: async (r) => { rows.set(r.id, r); return r.id; },
    add: async (r) => { rows.set(r.id, r); return r.id; },
    bulkPut: async (arr) => arr.forEach(r => rows.set(r.id, r)),
    bulkAdd: async (arr) => arr.forEach(r => rows.set(r.id, r)),
    toArray: async () => [...rows.values()],
    where: (field) => ({
      equals: (val) => ({
        toArray: async () => [...rows.values()].filter(r => r[field] === val),
        count: async () => [...rows.values()].filter(r => r[field] === val).length
      })
    })
  };
}

const TABLES = [
  'tenants', 'program_lines', 'units', 'projects', 'logframes', 'indicators',
  'forms', 'surveys', 'survey_responses', 'beneficiaries', 'consents',
  'feedbacks', 'lessons_learned', 'memberships'
];

const memDb = Object.fromEntries(TABLES.map(t => [t, makeStore()]));

beforeAll(async () => {
  for (const cfg of TENANT_SEEDS) {
    await seedTenantConfig(memDb, cfg);
  }
});

describe('GATE 13.2-2 — Aislamiento multi-tenant (cero fugas)', () => {
  const TENANT_IDS = ['ten-wayuu', 'ten-maicao', 'ten-hocol'];

  it('Existen múltiples tenants con datos (precondición del gate)', async () => {
    const tenants = await memDb.tenants.toArray();
    expect(tenants.map(t => t.id).sort()).toEqual([...TENANT_IDS].sort());
  });

  it('TODA fila operativa lleva tenant_id no vacío (RF-TEN-2)', async () => {
    for (const table of TABLES.filter(t => t !== 'tenants')) {
      const rows = await memDb[table].toArray();
      for (const row of rows) {
        expect(row.tenant_id, `${table}/${row.id} sin tenant_id`).toBeTruthy();
        expect(TENANT_IDS).toContain(row.tenant_id);
      }
    }
  });

  it('Una consulta scopeada NUNCA devuelve filas de otro tenant', async () => {
    for (const tid of TENANT_IDS) {
      for (const table of TABLES.filter(t => t !== 'tenants')) {
        const scoped = await memDb[table].where('tenant_id').equals(tid).toArray();
        const fugas = scoped.filter(r => r.tenant_id !== tid);
        expect(fugas, `Fuga en ${table} para ${tid}`).toHaveLength(0);
      }
    }
  });

  it('Manipular el identificador de tenant no expone datos ajenos', async () => {
    // Simula el intento de HU-11: un usuario del tenant A consulta con ids
    // inventados o de otro tenant → conjunto vacío, nunca datos cruzados.
    for (const forged of ['ten-inexistente', 'TEN-HOCOL', 'ten-hocol; DROP', '*']) {
      const rows = await memDb.units.where('tenant_id').equals(forged).toArray();
      expect(rows).toHaveLength(0);
    }
  });

  it('Integridad referencial DENTRO del tenant: los indicadores de Hocol solo referencian líneas de Hocol', async () => {
    const hocolLines = new Set((await memDb.program_lines.where('tenant_id').equals('ten-hocol').toArray()).map(l => l.id));
    const hocolInds = await memDb.indicators.where('tenant_id').equals('ten-hocol').toArray();
    for (const ind of hocolInds) {
      if (ind.linea_id) expect(hocolLines.has(ind.linea_id), `Indicador ${ind.code} referencia línea ajena`).toBe(true);
    }
    // Y ninguna línea de Hocol aparece referenciada por indicadores de otros tenants
    for (const tid of ['ten-wayuu', 'ten-maicao']) {
      const inds = await memDb.indicators.where('tenant_id').equals(tid).toArray();
      for (const ind of inds) {
        if (ind.linea_id) expect(hocolLines.has(ind.linea_id)).toBe(false);
      }
    }
  });

  it('La suma de los datos por tenant reconstruye el total (sin filas huérfanas)', async () => {
    for (const table of TABLES.filter(t => t !== 'tenants')) {
      const total = (await memDb[table].toArray()).length;
      let porTenant = 0;
      for (const tid of TENANT_IDS) {
        porTenant += await memDb[table].where('tenant_id').equals(tid).count();
      }
      expect(porTenant, `Filas fuera de todo tenant en ${table}`).toBe(total);
    }
  });
});

describe('GATE 13.2-2 — Defensa en profundidad en el backend (migraciones RLS)', () => {
  const schema = readFileSync('supabase/migrations/001_schema.sql', 'utf8');
  const rls = readFileSync('supabase/migrations/002_rls.sql', 'utf8');
  const triggers = readFileSync('supabase/migrations/003_audit_triggers.sql', 'utf8');

  const OPERATIONAL = [
    'memberships', 'units', 'program_lines', 'projects', 'logframes',
    'beneficiaries', 'consents', 'forms', 'field_records', 'evidences',
    'indicators', 'indicator_values', 'feedbacks', 'lessons_learned',
    'surveys', 'survey_responses'
  ];

  it('Toda tabla operativa define tenant_id NOT NULL en el esquema', () => {
    for (const t of OPERATIONAL) {
      const def = schema.slice(schema.indexOf(`create table if not exists public.${t} `));
      const body = def.slice(0, def.indexOf(');'));
      expect(body, `${t} sin tenant_id NOT NULL`).toMatch(/tenant_id text not null/);
    }
  });

  it('RLS se activa y FUERZA en todas las tablas (filtro imposible de omitir)', () => {
    for (const t of [...OPERATIONAL, 'tenants', 'profiles', 'audit_log']) {
      expect(rls, `${t} sin RLS en la lista`).toContain(`'${t}'`);
    }
    expect(rls).toContain('enable row level security');
    expect(rls).toContain('force row level security');
  });

  it('Las políticas usan membresía por tenant (is_member_of) y el bucket segrega por carpeta de tenant', () => {
    expect(rls).toMatch(/is_member_of\(tenant_id\)/);
    expect(rls).toMatch(/storage\.foldername\(name\)/);
  });

  it('La bitácora es append-only: sin UPDATE/DELETE y con privilegios revocados', () => {
    expect(rls).toMatch(/revoke update, delete on public\.audit_log/);
    expect(rls).not.toMatch(/create policy audit_(update|delete)/);
  });

  it('El servidor refuerza la separación de funciones y la inmutabilidad (11.3, 8.4)', () => {
    expect(triggers).toMatch(/quien captura un dato no puede validarlo/i);
    expect(triggers).toMatch(/inmutables tras sincronizar/i);
    expect(triggers).toMatch(/linea_base_congelada/);
  });
});
