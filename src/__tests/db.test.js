import { vi, describe, it, expect, beforeEach } from 'vitest';

// Nombres de tabla usados por las aserciones (el mock los redefine internamente
// porque vi.mock se eleva por encima de las variables del módulo).
const TABLE_NAMES = [
  'tenants', 'memberships', 'profiles', 'units', 'program_lines', 'projects',
  'logframes', 'indicators', 'indicator_values', 'forms', 'field_records',
  'evidences', 'beneficiaries', 'consents', 'surveys', 'survey_responses',
  'feedbacks', 'lessons_learned', 'audit_log', 'sync_meta'
];

vi.mock('dexie', () => {
  const names = [
    'tenants', 'memberships', 'profiles', 'units', 'program_lines', 'projects',
    'logframes', 'indicators', 'indicator_values', 'forms', 'field_records',
    'evidences', 'beneficiaries', 'consents', 'surveys', 'survey_responses',
    'feedbacks', 'lessons_learned', 'audit_log', 'sync_meta'
  ];
  const mkTable = () => {
    const rows = new Map();
    return {
      _rows: rows,
      add: vi.fn(async (r) => { rows.set(r.id, r); return r.id; }),
      put: vi.fn(async (r) => { rows.set(r.id, r); return r.id; }),
      bulkAdd: vi.fn(async (arr) => { arr.forEach(r => rows.set(r.id, r)); }),
      bulkPut: vi.fn(async (arr) => { arr.forEach(r => rows.set(r.id, r)); }),
      get: vi.fn(async (id) => rows.get(id) || null),
      count: vi.fn(async () => rows.size),
      clear: vi.fn(async () => rows.clear()),
      toArray: vi.fn(async () => [...rows.values()]),
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          count: vi.fn(async () => 0),
          toArray: vi.fn(async () => [])
        }))
      }))
    };
  };
  class MockDexie {
    constructor() {
      const versionChain = {
        stores: vi.fn(() => versionChain),
        upgrade: vi.fn(() => versionChain)
      };
      this.version = vi.fn(() => versionChain);
      names.forEach(name => { this[name] = mkTable(); });
    }
  }
  return { default: MockDexie, Dexie: MockDexie };
});

import { db, seedLocalData, calculateRecordHash, logAudit } from '../db';

describe('Base de datos local multi-tenant (Dexie v2 mock)', () => {
  beforeEach(() => {
    // Vaciar el almacenamiento en memoria de cada tabla antes de cada prueba
    TABLE_NAMES.forEach(name => db[name]._rows.clear());
    vi.clearAllMocks();
  });

  it('Debería exponer todas las tablas del esquema multi-tenant', () => {
    expect(db.tenants).toBeDefined();
    expect(db.units).toBeDefined();
    expect(db.field_records).toBeDefined();
    expect(db.audit_log).toBeDefined();
    expect(db.consents).toBeDefined();
  });

  it('Debería sembrar los 3 tenants de configuración cuando la BD está vacía', async () => {
    await seedLocalData();

    // Los 3 tenants del plan: Wayuu, Maicao y Hocol
    expect(db.tenants._rows.has('ten-wayuu')).toBe(true);
    expect(db.tenants._rows.has('ten-maicao')).toBe(true);
    expect(db.tenants._rows.has('ten-hocol')).toBe(true);
    expect(db.tenants._rows.size).toBe(3);
  });

  it('Debería etiquetar cada dato con su tenant_id (aislamiento M0)', async () => {
    await seedLocalData();

    const allUnits = [...db.units._rows.values()];
    expect(allUnits.length).toBeGreaterThan(0);
    expect(allUnits.every(u => typeof u.tenant_id === 'string' && u.tenant_id.length > 0)).toBe(true);

    // Hocol debe cargar sus 36 comunidades (Anexo E)
    const hocolUnits = allUnits.filter(u => u.tenant_id === 'ten-hocol');
    expect(hocolUnits.length).toBe(36);
  });

  it('Debería cargar el catálogo de indicadores del Anexo E para Hocol (tablas 8.1–8.7)', async () => {
    await seedLocalData();
    const hocolIndicators = [...db.indicators._rows.values()].filter(i => i.tenant_id === 'ten-hocol');
    // 8 estratégicos + 8 L1 + 4 L2 + 4 L3 + 4 L4 + 4 L5 + 12 MEAL = 44
    expect(hocolIndicators.length).toBe(44);
    expect(hocolIndicators.some(i => i.code === 'IND-EST-01')).toBe(true);
  });

  it('NO debería re-sembrar un tenant que ya existe (idempotencia)', async () => {
    await seedLocalData();
    const firstCount = db.tenants._rows.size;
    // Segunda ejecución: no debe duplicar ni recrear
    await seedLocalData();
    expect(db.tenants._rows.size).toBe(firstCount);
  });

  it('Debería firmar los registros sembrados con SHA-256 (integridad)', async () => {
    await seedLocalData();
    const tenant = db.tenants._rows.get('ten-wayuu');
    expect(tenant.signature).toMatch(/^[0-9a-f]{64}$/);
  });

  it('logAudit debería crear una entrada firmada en la bitácora', async () => {
    const entry = await logAudit({
      tenantId: 'ten-wayuu',
      actorId: 'user-1',
      accion: 'validar',
      entidad: 'field_records',
      entidadId: 'rec-1'
    });
    expect(entry.signature).toMatch(/^[0-9a-f]{64}$/);
    expect(db.audit_log._rows.get(entry.id).accion).toBe('validar');
  });

  it('calculateRecordHash debería ser determinista e ignorar signature/sync_status', async () => {
    const a = await calculateRecordHash({ id: '1', name: 'x', sync_status: 'pending_sync' });
    const b = await calculateRecordHash({ id: '1', name: 'x', signature: 'zzz', sync_status: 'synced' });
    expect(a).toBe(b);
  });
});
