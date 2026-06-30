import { describe, it, expect } from 'vitest';
import { shouldRemoteOverwriteLocal } from '../syncEngine';

describe('Pruebas unitarias de resolución de conflictos - Last Write Wins (LWW)', () => {
  
  it('Debería retornar true si el registro no existe localmente (PULL inicial)', () => {
    const local = null;
    const remote = { id: '1', updated_at: '2026-06-30T12:00:00.000Z', name: 'Proyecto A' };
    
    const result = shouldRemoteOverwriteLocal(local, remote);
    expect(result).toBe(true);
  });

  it('Debería retornar true si el local NO está pendiente de sincronización y el remoto es más nuevo', () => {
    const local = { id: '1', updated_at: '2026-06-30T10:00:00.000Z', sync_status: 'synced' };
    const remote = { id: '1', updated_at: '2026-06-30T11:00:00.000Z' };

    const result = shouldRemoteOverwriteLocal(local, remote);
    expect(result).toBe(true);
  });

  it('Debería retornar false si el local SÍ está pendiente de sincronización y el remoto es anterior (LWW protege cambios offline locales)', () => {
    const local = { id: '1', updated_at: '2026-06-30T11:00:00.000Z', sync_status: 'pending_sync' };
    const remote = { id: '1', updated_at: '2026-06-30T10:00:00.000Z' };

    const result = shouldRemoteOverwriteLocal(local, remote);
    expect(result).toBe(false);
  });

  it('Debería retornar true si el local está pendiente de sincronización pero el remoto es aún más reciente (conflicto tardío superado por servidor)', () => {
    const local = { id: '1', updated_at: '2026-06-30T11:00:00.000Z', sync_status: 'pending_sync' };
    const remote = { id: '1', updated_at: '2026-06-30T12:00:00.000Z' };

    const result = shouldRemoteOverwriteLocal(local, remote);
    expect(result).toBe(true);
  });

  it('Debería retornar false si las marcas de tiempo son iguales y el local está pendiente de sincronización', () => {
    const local = { id: '1', updated_at: '2026-06-30T12:00:00.000Z', sync_status: 'pending_sync' };
    const remote = { id: '1', updated_at: '2026-06-30T12:00:00.000Z' };

    const result = shouldRemoteOverwriteLocal(local, remote);
    expect(result).toBe(false);
  });
});
