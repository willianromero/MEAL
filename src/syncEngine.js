import { db } from './db';
import { supabase, isSupabaseConfigured } from './supabaseClient';

// Estado global en memoria para reactividad rápida en la UI
let syncState = {
  isOnline: navigator.onLine,
  isSyncing: false,
  pendingCount: 0,
  lastSyncedAt: 'Nunca',
  error: null,
  isSimulatedOffline: false // Permite forzar modo offline desde la UI para pruebas
};

const subscribers = new Set();

function notifySubscribers() {
  subscribers.forEach(cb => cb({ ...syncState }));
}

export function subscribeToSyncState(cb) {
  subscribers.add(cb);
  // Llamar inmediatamente con el estado actual
  cb({ ...syncState });
  return () => subscribers.delete(cb);
}

// Actualiza el conteo de elementos pendientes de sincronización localmente
export async function updatePendingCount() {
  try {
    const pendingResponses = await db.survey_responses.where('sync_status').equals('pending_sync').count();
    const pendingFeedbacks = await db.feedbacks.where('sync_status').equals('pending_sync').count();
    const pendingLessons = await db.lessons_learned.where('sync_status').equals('pending_sync').count();
    const pendingIndicators = await db.indicators.filter(ind => ind.sync_status === 'pending_sync').count();

    syncState.pendingCount = pendingResponses + pendingFeedbacks + pendingLessons + pendingIndicators;
    
    // Obtener última fecha de sincronización de los metadatos
    const meta = await db.sync_meta.get('last_synced_at');
    if (meta && meta.value !== '1970-01-01T00:00:00.000Z') {
      syncState.lastSyncedAt = new Date(meta.value).toLocaleString();
    } else {
      syncState.lastSyncedAt = 'Nunca';
    }

    notifySubscribers();
  } catch (err) {
    console.error('Error calculando elementos pendientes:', err);
  }
}

// Configurar modo de red
export function setSimulatedOffline(value) {
  syncState.isSimulatedOffline = value;
  updateNetworkStatus();
}

function updateNetworkStatus() {
  const actualOnline = navigator.onLine;
  syncState.isOnline = actualOnline && !syncState.isSimulatedOffline;
  notifySubscribers();
  
  if (syncState.isOnline) {
    // Si vuelve a estar en línea, intentar sincronizar automáticamente
    triggerSync();
  }
}

// Escuchar eventos de red del navegador
window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);

// Cargar estado inicial
updateNetworkStatus();
updatePendingCount();

// --- ALGORITMO DE SINCRONIZACIÓN ---
export async function triggerSync() {
  if (syncState.isSyncing) return;
  if (!syncState.isOnline) {
    console.log('[Sync Engine] Sincronización cancelada: el sistema está sin conexión.');
    return;
  }

  console.log('[Sync Engine] Iniciando sincronización...');
  syncState.isSyncing = true;
  syncState.error = null;
  notifySubscribers();

  try {
    // Obtener marca de tiempo de la última sincronización
    const metaRecord = await db.sync_meta.get('last_synced_at');
    const lastSyncedStr = metaRecord ? metaRecord.value : '1970-01-01T00:00:00.000Z';
    const currentSyncStart = new Date().toISOString();

    // 1. PUSH: Subir cambios locales creados offline hacia Supabase
    await pushLocalChanges();

    // 2. PULL: Descargar cambios remotos ocurridos desde la última sincronización
    if (isSupabaseConfigured) {
      await pullRemoteChanges(lastSyncedStr);
    } else {
      console.log('[Sync Engine] Supabase no configurado, se omite el Pull de cambios reales.');
    }

    // 3. Registrar marca de tiempo de sincronización exitosa
    await db.sync_meta.put({ key: 'last_synced_at', value: currentSyncStart });
    syncState.lastSyncedAt = new Date(currentSyncStart).toLocaleString();
    syncState.error = null;
    
    console.log('[Sync Engine] Sincronización completada exitosamente.');
  } catch (err) {
    console.error('[Sync Engine] Error durante la sincronización:', err);
    syncState.error = err.message || 'Error de conexión con el servidor remoto';
  } finally {
    syncState.isSyncing = false;
    await updatePendingCount();
    notifySubscribers();
  }
}

// --- SUBIR CAMBIOS LOCALES (PUSH) ---
async function pushLocalChanges() {
  console.log('[Sync Engine] Fase PUSH: subiendo datos locales...');

  // 1. Respuestas de Encuestas
  const pendingResponses = await db.survey_responses.where('sync_status').equals('pending_sync').toArray();
  for (const resp of pendingResponses) {
    const cleanRecord = { ...resp };
    delete cleanRecord.sync_status; // No subir este campo local a Supabase
    
    const { error } = await supabase.from('survey_responses').upsert(cleanRecord);
    if (!error) {
      await db.survey_responses.update(resp.id, { sync_status: 'synced' });
    } else {
      console.error('Error al subir encuesta:', error);
      throw error;
    }
  }

  // 2. Quejas y Sugerencias (Feedback)
  const pendingFeedbacks = await db.feedbacks.where('sync_status').equals('pending_sync').toArray();
  for (const fb of pendingFeedbacks) {
    const cleanRecord = { ...fb };
    delete cleanRecord.sync_status;
    
    const { error } = await supabase.from('feedbacks').upsert(cleanRecord);
    if (!error) {
      await db.feedbacks.update(fb.id, { sync_status: 'synced' });
    } else {
      console.error('Error al subir queja/sugerencia:', error);
      throw error;
    }
  }

  // 3. Lecciones Aprendidas
  const pendingLessons = await db.lessons_learned.where('sync_status').equals('pending_sync').toArray();
  for (const lesson of pendingLessons) {
    const cleanRecord = { ...lesson };
    delete cleanRecord.sync_status;
    
    const { error } = await supabase.from('lessons_learned').upsert(cleanRecord);
    if (!error) {
      await db.lessons_learned.update(lesson.id, { sync_status: 'synced' });
    } else {
      console.error('Error al subir lección aprendida:', error);
      throw error;
    }
  }

  // 4. Indicadores (actualizaciones de avance registradas en el terreno)
  const pendingIndicators = await db.indicators.filter(ind => ind.sync_status === 'pending_sync').toArray();
  for (const ind of pendingIndicators) {
    const cleanRecord = { ...ind };
    delete cleanRecord.sync_status;
    
    const { error } = await supabase.from('indicators').upsert(cleanRecord);
    if (!error) {
      await db.indicators.update(ind.id, { sync_status: 'synced' });
    } else {
      console.error('Error al subir indicador:', error);
      throw error;
    }
  }
}

// --- DESCARGAR CAMBIOS REMOTOS (PULL) ---
async function pullRemoteChanges(lastSyncedStr) {
  console.log(`[Sync Engine] Fase PULL: descargando cambios desde ${lastSyncedStr}...`);

  const tablesToPull = [
    { name: 'projects', store: db.projects },
    { name: 'logframes', store: db.logframes },
    { name: 'indicators', store: db.indicators },
    { name: 'surveys', store: db.surveys },
    { name: 'survey_responses', store: db.survey_responses },
    { name: 'feedbacks', store: db.feedbacks },
    { name: 'lessons_learned', store: db.lessons_learned }
  ];

  for (const { name, store } of tablesToPull) {
    // Buscar registros remotos con updated_at superior a la última sincronización
    const { data, error } = await supabase
      .from(name)
      .select('*')
      .gt('updated_at', lastSyncedStr);

    if (error) {
      console.error(`Error descargando tabla ${name}:`, error);
      throw error;
    }

    if (data && data.length > 0) {
      console.log(`[Sync Engine] Descargados ${data.length} registros nuevos/modificados para la tabla "${name}"`);
      
      for (const remoteRecord of data) {
        // Buscar si existe localmente
        const localRecord = await store.get(remoteRecord.id);
        
        // Estrategia: Last Write Wins (LWW)
        // Si no existe localmente, lo guardamos.
        // Si existe localmente, solo lo sobreescribimos si el remoto es más nuevo
        // y el local no tiene un estado pendiente de subir (para evitar pisar trabajo offline sin sincronizar).
        if (!localRecord) {
          const toAdd = { ...remoteRecord };
          if ('sync_status' in store.schema.instance) {
            toAdd.sync_status = 'synced';
          }
          await store.put(toAdd);
        } else {
          const isLocalPending = localRecord.sync_status === 'pending_sync';
          const localUpdatedAt = new Date(localRecord.updated_at).getTime();
          const remoteUpdatedAt = new Date(remoteRecord.updated_at).getTime();

          if (!isLocalPending || remoteUpdatedAt > localUpdatedAt) {
            const toUpdate = { ...remoteRecord };
            if ('sync_status' in store.schema.instance) {
              toUpdate.sync_status = 'synced';
            }
            await store.put(toUpdate);
          } else {
            console.log(`[Sync Engine] Conflicto LWW en tabla "${name}" para ID ${remoteRecord.id}: Se preserva la versión local (más reciente o pendiente de sincronizar).`);
          }
        }
      }
    }
  }
}
