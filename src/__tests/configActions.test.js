import { vi, describe, it, expect, beforeEach } from 'vitest';

// --- Mocks de db (Dexie) y supabase, para probar los helpers en aislamiento ---
const auditRows = [];

vi.mock('../db', () => {
  const rows = new Map();
  const store = {
    _rows: rows,
    put: vi.fn(async (r) => { rows.set(r.id, r); return r.id; }),
    add: vi.fn(async (r) => { rows.set(r.id, r); return r.id; }),
    delete: vi.fn(async (id) => { rows.delete(id); })
  };
  return {
    db: { indicators: store, audit_log: { add: vi.fn() } },
    putWithSignature: vi.fn(async (s, r) => { await s.put(r); return r; }),
    logAudit: vi.fn(async (e) => { globalThis.__auditRows.push(e); return e; })
  };
});
globalThis.__auditRows = auditRows;

const supabaseDelete = vi.fn(async () => ({ error: null }));
vi.mock('../supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: { from: () => ({ delete: () => ({ eq: supabaseDelete }) }) }
}));

vi.mock('../syncEngine', () => ({ updatePendingCount: vi.fn(async () => {}) }));

import { archiveRecord, restoreRecord, hardDelete, isArchived } from '../lib/configActions';
import { db } from '../db';

describe('configActions — archivar / restaurar / eliminar', () => {
  beforeEach(() => {
    auditRows.length = 0;
    supabaseDelete.mockClear();
    supabaseDelete.mockResolvedValue({ error: null });
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  it('isArchived usa archivado en general y activo en forms', () => {
    expect(isArchived('indicators', { archivado: true })).toBe(true);
    expect(isArchived('indicators', { archivado: false })).toBe(false);
    expect(isArchived('forms', { activo: false })).toBe(true);
    expect(isArchived('forms', { activo: true })).toBe(false);
  });

  it('archiveRecord marca archivado=true, deja pendiente y audita', async () => {
    const rec = { id: 'i1', tenant_id: 't1', archivado: false, name: 'X' };
    await archiveRecord('indicators', db.indicators, rec, { tenantId: 't1', userId: 'u1' });
    const saved = db.indicators._rows.get('i1');
    expect(saved.archivado).toBe(true);
    expect(saved.sync_status).toBe('pending_sync');
    expect(auditRows.at(-1)).toMatchObject({ accion: 'archivar', entidad: 'indicators', entidadId: 'i1' });
  });

  it('restoreRecord marca archivado=false y audita', async () => {
    const rec = { id: 'i2', tenant_id: 't1', archivado: true };
    await restoreRecord('indicators', db.indicators, rec, { tenantId: 't1' });
    expect(db.indicators._rows.get('i2').archivado).toBe(false);
    expect(auditRows.at(-1).accion).toBe('restaurar');
  });

  it('hardDelete borra en Supabase y en local, y audita', async () => {
    const rec = { id: 'i3', tenant_id: 't1' };
    db.indicators._rows.set('i3', rec);
    await hardDelete('indicators', db.indicators, rec, { tenantId: 't1' });
    expect(supabaseDelete).toHaveBeenCalledWith('id', 'i3');
    expect(db.indicators._rows.has('i3')).toBe(false);
    expect(auditRows.at(-1).accion).toBe('eliminar');
  });

  it('hardDelete se bloquea sin conexión (usa archivar)', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    await expect(hardDelete('indicators', db.indicators, { id: 'i4' }, {})).rejects.toThrow(/conexión/i);
    expect(supabaseDelete).not.toHaveBeenCalled();
  });

  it('hardDelete traduce error de llave foránea en mensaje claro', async () => {
    supabaseDelete.mockResolvedValueOnce({ error: { code: '23503', message: 'foreign key violation' } });
    await expect(hardDelete('indicators', db.indicators, { id: 'i5' }, {})).rejects.toThrow(/dependen/i);
  });
});
