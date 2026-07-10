import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock de Dexie con tablas mínimas necesarias para el motor de sync.
vi.mock('../db', () => {
  const mkTable = () => {
    const rows = new Map();
    return {
      _rows: rows,
      get: vi.fn(async (id) => rows.get(id) || null),
      put: vi.fn(async (r) => { rows.set(r.id, r); return r.id; }),
      update: vi.fn(async (id, patch) => { const r = rows.get(id); if (r) rows.set(id, { ...r, ...patch }); }),
      delete: vi.fn(async (id) => rows.delete(id)),
      toArray: vi.fn(async () => [...rows.values()]),
      where: vi.fn((field) => ({
        equals: vi.fn((val) => ({
          toArray: async () => [...rows.values()].filter(r => r[field] === val),
          count: async () => [...rows.values()].filter(r => r[field] === val).length
        })),
        anyOf: vi.fn((vals) => ({
          toArray: async () => [...rows.values()].filter(r => vals.includes(r[field])),
          count: async () => [...rows.values()].filter(r => vals.includes(r[field])).length
        }))
      }))
    };
  };
  const tables = {};
  const names = ['profiles', 'tenants', 'memberships', 'units', 'program_lines', 'projects', 'logframes',
    'forms', 'indicators', 'indicator_values', 'beneficiaries', 'consents', 'field_records', 'evidences',
    'surveys', 'survey_responses', 'feedbacks', 'lessons_learned', 'audit_log', 'sync_meta'];
  names.forEach(n => { tables[n] = mkTable(); });
  // Dexie expone db.transaction('rw', tabla, callback); el motor de sync lo
  // usa solo para el candado, así que basta con ejecutar el callback directo.
  tables.transaction = vi.fn(async (_mode, _table, cb) => cb());
  return {
    db: tables,
    calculateRecordHash: vi.fn(async () => 'deadbeef')
  };
});

const upsertMock = vi.fn(async () => ({ error: null }));
vi.mock('../supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: () => ({
      upsert: upsertMock,
      select: () => ({ gt: async () => ({ data: [], error: null }) })
    }),
    storage: null
  }
}));

describe('syncEngine — auto-sincronización y candado corto', () => {
  beforeEach(async () => {
    vi.resetModules();
    upsertMock.mockClear();
    upsertMock.mockResolvedValue({ error: null });
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  it('updatePendingCount dispara sync automáticamente cuando hay pendientes', async () => {
    const { db } = await import('../db');
    const mod = await import('../syncEngine');
    await db.indicators.put({ id: 'i1', tenant_id: 't1', name: 'X', sync_status: 'pending_sync', updated_at: new Date().toISOString() });

    await mod.updatePendingCount();
    // triggerSync es async y no se espera dentro de updatePendingCount (fire-and-forget);
    // damos un tick para que el push corra.
    await new Promise(r => setTimeout(r, 50));

    expect(upsertMock).toHaveBeenCalled();
  });

  it('expone errorCount distinto de pendingCount', async () => {
    // Offline a propósito: aísla el cálculo de errorCount del auto-sync (que
    // se prueba aparte) para que no haya carrera entre ambos efectos.
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    const { db } = await import('../db');
    const mod = await import('../syncEngine');
    await db.indicators.put({ id: 'i2', tenant_id: 't1', sync_status: 'error', updated_at: new Date().toISOString() });

    let lastState;
    const unsub = mod.subscribeToSyncState((s) => { lastState = s; });
    await mod.updatePendingCount();
    unsub();

    expect(lastState.errorCount).toBeGreaterThanOrEqual(1);
    expect(lastState.pendingCount).toBeGreaterThanOrEqual(1);
  });

  it('el candado de sync usa una ventana de 60s, no 5 minutos', async () => {
    // Verifica indirectamente: un candado de hace 2 minutos debe considerarse
    // vencido y permitir un nuevo triggerSync (no quedarse bloqueado).
    const { db } = await import('../db');
    const mod = await import('../syncEngine');
    const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    await db.sync_meta.put({ key: 'sync_lock', value: twoMinAgo });
    await db.indicators.put({ id: 'i3', tenant_id: 't1', sync_status: 'pending_sync', updated_at: new Date().toISOString() });

    await mod.triggerSync();
    await new Promise(r => setTimeout(r, 50));

    // Si el candado de 2 min ya no bloquea (ventana=60s), el push debió ejecutarse.
    expect(upsertMock).toHaveBeenCalled();
  });
});
