import { db } from './db';
import { supabase, isSupabaseConfigured } from './supabaseClient';

// Estado global en memoria
let syncState = {
  isOnline: navigator.onLine,
  isSyncing: false,
  pendingCount: 0,
  lastSyncedAt: 'Nunca',
  error: null,
  isSimulatedOffline: false
};

const subscribers = new Set();

function notifySubscribers() {
  subscribers.forEach(cb => cb({ ...syncState }));
}

export function subscribeToSyncState(cb) {
  subscribers.add(cb);
  cb({ ...syncState });
  return () => subscribers.delete(cb);
}

export async function updatePendingCount() {
  try {
    const pendingResponses = await db.survey_responses.where('sync_status').equals('pending_sync').count();
    const pendingFeedbacks = await db.feedbacks.where('sync_status').equals('pending_sync').count();
    const pendingLessons = await db.lessons_learned.where('sync_status').equals('pending_sync').count();
    const pendingIndicators = await db.indicators.filter(ind => ind.sync_status === 'pending_sync').count();
    const pendingProfiles = await db.profiles.filter(p => p.sync_status === 'pending_sync').count();

    syncState.pendingCount = pendingResponses + pendingFeedbacks + pendingLessons + pendingIndicators + pendingProfiles;
    
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

export function setSimulatedOffline(value) {
  syncState.isSimulatedOffline = value;
  updateNetworkStatus();
}

function updateNetworkStatus() {
  const actualOnline = navigator.onLine;
  syncState.isOnline = actualOnline && !syncState.isSimulatedOffline;
  notifySubscribers();
  
  if (syncState.isOnline) {
    triggerSync();
  }
}

// Escuchar eventos de red del navegador
window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);

// Función para liberar recursos y evitar fugas de memoria en desmontajes (Auditoría 1)
export function cleanupNetworkListeners() {
  window.removeEventListener('online', updateNetworkStatus);
  window.removeEventListener('offline', updateNetworkStatus);
  subscribers.clear();
}

// Cargar estado inicial
updateNetworkStatus();
updatePendingCount();

// --- ALGORITMO DE SINCRONIZACIÓN CON CONTROL DE CONCURRENCIA ---
export async function triggerSync() {
  if (syncState.isSyncing) return;
  if (!syncState.isOnline) {
    console.log('[Sync Engine] Sincronización omitida: el sistema está offline.');
    return;
  }

  // 1. Obtener bloqueo exclusivo de sincronización en IndexedDB (Auditoría 1 - Concurrencia entre pestañas)
  let hasLock = false;
  const nowMs = Date.now();
  const lockTimeoutMs = 5 * 60 * 1000; // 5 minutos de expiración de seguridad

  try {
    // Usamos una transacción atómica de Dexie en la tabla sync_meta para verificar y tomar el bloqueo
    await db.transaction('rw', db.sync_meta, async () => {
      const lockRecord = await db.sync_meta.get('sync_lock');
      
      if (lockRecord) {
        const lockTime = new Date(lockRecord.value).getTime();
        // Si el bloqueo existe y tiene menos de 5 minutos, abortamos la sincronización actual
        if (nowMs - lockTime < lockTimeoutMs) {
          console.warn('[Sync Engine] Omitiendo sincronización: Otra pestaña del navegador tiene el bloqueo de sync activo.');
          return;
        }
      }
      
      // Escribir el bloqueo con el timestamp actual
      await db.sync_meta.put({ key: 'sync_lock', value: new Date(nowMs).toISOString() });
      hasLock = true;
    });
  } catch (err) {
    console.error('[Sync Engine] Error al intentar obtener el bloqueo de sincronización:', err);
    return;
  }

  if (!hasLock) return; // Abortar si otra pestaña tiene el semáforo en verde

  console.log('[Sync Engine] Bloqueo exclusivo obtenido. Iniciando sincronización...');
  syncState.isSyncing = true;
  syncState.error = null;
  notifySubscribers();

  try {
    const metaRecord = await db.sync_meta.get('last_synced_at');
    const lastSyncedStr = metaRecord ? metaRecord.value : '1970-01-01T00:00:00.000Z';
    const currentSyncStart = new Date().toISOString();

    // 1. PUSH: Enviar escrituras locales offline a Supabase
    await pushLocalChanges();

    // 2. PULL: Descargar cambios remotos ocurridos desde la última sincronización
    if (isSupabaseConfigured) {
      await pullRemoteChanges(lastSyncedStr);
    }

    // 3. Registrar marca de tiempo de sincronización exitosa
    await db.sync_meta.put({ key: 'last_synced_at', value: currentSyncStart });
    syncState.lastSyncedAt = new Date(currentSyncStart).toLocaleString();
    syncState.error = null;
    
    console.log('[Sync Engine] Sincronización finalizada con éxito.');
  } catch (err) {
    console.error('[Sync Engine] Fallo en el ciclo de sincronización:', err);
    syncState.error = err.message || 'Error de comunicación remota';
  } finally {
    // 4. Liberar bloqueo de sincronización en IndexedDB
    try {
      await db.sync_meta.delete('sync_lock');
      console.log('[Sync Engine] Bloqueo de sincronización liberado.');
    } catch (err) {
      console.error('[Sync Engine] Error al liberar el bloqueo de sincronización:', err);
    }
    
    syncState.isSyncing = false;
    await updatePendingCount();
    notifySubscribers();
  }
}

// --- SUBIR CAMBIOS LOCALES (PUSH) ---
async function pushLocalChanges() {
  // 1. Respuestas de Encuestas
  const pendingResponses = await db.survey_responses.where('sync_status').equals('pending_sync').toArray();
  for (const resp of pendingResponses) {
    const cleanRecord = { ...resp };
    delete cleanRecord.sync_status;
    const { error } = await supabase.from('survey_responses').upsert(cleanRecord);
    if (!error) {
      await db.survey_responses.update(resp.id, { sync_status: 'synced' });
    } else {
      throw new Error(`Fallo push encuestas: ${error.message}`);
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
      throw new Error(`Fallo push quejas: ${error.message}`);
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
      throw new Error(`Fallo push lecciones: ${error.message}`);
    }
  }

  // 4. Indicadores
  const pendingIndicators = await db.indicators.filter(ind => ind.sync_status === 'pending_sync').toArray();
  for (const ind of pendingIndicators) {
    const cleanRecord = { ...ind };
    delete cleanRecord.sync_status;
    const { error } = await supabase.from('indicators').upsert(cleanRecord);
    if (!error) {
      await db.indicators.update(ind.id, { sync_status: 'synced' });
    } else {
      throw new Error(`Fallo push indicadores: ${error.message}`);
    }
  }

  // 5. Perfiles (profiles)
  const pendingProfiles = await db.profiles.filter(p => p.sync_status === 'pending_sync').toArray();
  for (const prof of pendingProfiles) {
    const cleanRecord = { ...prof };
    delete cleanRecord.sync_status;
    const { error } = await supabase.from('profiles').upsert(cleanRecord);
    if (!error) {
      await db.profiles.update(prof.id, { sync_status: 'synced' });
    } else {
      throw new Error(`Fallo push perfiles: ${error.message}`);
    }
  }
}

// --- RESOLUCIÓN MATEMÁTICA LAST WRITE WINS (LWW) ---
export function shouldRemoteOverwriteLocal(localRecord, remoteRecord) {
  if (!localRecord) return true;
  const isLocalPending = localRecord.sync_status === 'pending_sync';
  const localUpdatedAt = new Date(localRecord.updated_at).getTime();
  const remoteUpdatedAt = new Date(remoteRecord.updated_at).getTime();
  return !isLocalPending || remoteUpdatedAt > localUpdatedAt;
}

// --- DESCARGAR CAMBIOS REMOTOS (PULL) ---
async function pullRemoteChanges(lastSyncedStr) {
  const tablesToPull = [
    { name: 'profiles', store: db.profiles }, // Descargar roles actualizados
    { name: 'projects', store: db.projects },
    { name: 'logframes', store: db.logframes },
    { name: 'indicators', store: db.indicators },
    { name: 'surveys', store: db.surveys },
    { name: 'survey_responses', store: db.survey_responses },
    { name: 'feedbacks', store: db.feedbacks },
    { name: 'lessons_learned', store: db.lessons_learned }
  ];

  for (const { name, store } of tablesToPull) {
    const { data, error } = await supabase
      .from(name)
      .select('*')
      .gt('updated_at', lastSyncedStr);

    if (error) {
      throw new Error(`Fallo pull tabla ${name}: ${error.message}`);
    }

    if (data && data.length > 0) {
      for (const remoteRecord of data) {
        const localRecord = await store.get(remoteRecord.id);
        
        // Aplicar la lógica LWW extraída
        if (shouldRemoteOverwriteLocal(localRecord, remoteRecord)) {
          const toUpdate = { ...remoteRecord };
          if ('sync_status' in store.schema.instance) {
            toUpdate.sync_status = 'synced';
          }
          await store.put(toUpdate);
        } else {
          console.log(`[LWW Concurrency] Se descarta cambio remoto en "${name}" id ${remoteRecord.id} por ser más antiguo que el cambio offline local.`);
        }
      }
    }
  }
}
