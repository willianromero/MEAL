import { db, putWithSignature, logAudit } from '../db';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { updatePendingCount } from '../syncEngine';

// ============================================================================
// Acciones de edición de configuración (DRT RF-CAT-5): archivar (reversible),
// restaurar y borrado definitivo. Centraliza la lógica para todas las vistas
// de catálogo (indicadores, marco lógico, proyectos, unidades, líneas, formularios).
//
// Solo aplica a CONFIGURACIÓN. Los datos inmutables (registros de campo,
// evidencias, bitácora) NO usan estos helpers.
// ============================================================================

// forms usa `activo` (true/false); el resto usa `archivado` (false/true).
function isArchived(table, record) {
  if (table === 'forms') return record.activo === false;
  return record.archivado === true;
}

function setArchivedPatch(table, archived) {
  return table === 'forms' ? { activo: !archived } : { archivado: archived };
}

async function setArchivedState(table, store, record, archived, ctx) {
  const now = new Date().toISOString();
  await putWithSignature(store, {
    ...record,
    ...setArchivedPatch(table, archived),
    updated_at: now,
    sync_status: 'pending_sync'
  });
  await logAudit({
    tenantId: ctx?.tenantId ?? record.tenant_id,
    actorId: ctx?.userId,
    actorEmail: ctx?.userEmail,
    accion: archived ? 'archivar' : 'restaurar',
    entidad: table,
    entidadId: record.id,
    antes: { archivado: isArchived(table, record) },
    despues: { archivado: archived }
  });
  await updatePendingCount();
}

export function archiveRecord(table, store, record, ctx) {
  return setArchivedState(table, store, record, true, ctx);
}

export function restoreRecord(table, store, record, ctx) {
  return setArchivedState(table, store, record, false, ctx);
}

// Borrado definitivo (DRT: reservado a admin). Es una acción EN LÍNEA: borra en
// Dexie y en Supabase. Sin conexión se bloquea (usar archivar). Ante error de
// llave foránea (tiene hijos/referencias), avisa para archivar o borrar primero.
export async function hardDelete(table, store, record, ctx) {
  const online = navigator.onLine && !(ctx?.isSimulatedOffline);
  if (isSupabaseConfigured && !online) {
    const err = new Error('El borrado definitivo requiere conexión. Sin conexión, usa "Archivar".');
    err.code = 'OFFLINE';
    throw err;
  }

  if (isSupabaseConfigured) {
    const { error } = await supabase.from(table).delete().eq('id', record.id);
    if (error) {
      // 23503 = violación de llave foránea (tiene dependencias)
      if (error.code === '23503' || /foreign key/i.test(error.message || '')) {
        const e = new Error('No se puede eliminar: tiene elementos que dependen de él. Archívalo o elimina primero sus dependencias.');
        e.code = 'HAS_DEPENDENTS';
        throw e;
      }
      throw new Error(error.message || 'Error al eliminar en el servidor');
    }
  }

  await store.delete(record.id);
  await logAudit({
    tenantId: ctx?.tenantId ?? record.tenant_id,
    actorId: ctx?.userId,
    actorEmail: ctx?.userEmail,
    accion: 'eliminar',
    entidad: table,
    entidadId: record.id,
    antes: record
  });
  await updatePendingCount();
}

export { isArchived };
