import { db, calculateRecordHash } from './db';
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

  let hasLock = false;
  const nowMs = Date.now();
  const lockTimeoutMs = 5 * 60 * 1000;

  try {
    await db.transaction('rw', db.sync_meta, async () => {
      const lockRecord = await db.sync_meta.get('sync_lock');
      
      if (lockRecord) {
        const lockTime = new Date(lockRecord.value).getTime();
        if (nowMs - lockTime < lockTimeoutMs) {
          console.warn('[Sync Engine] Omitiendo sincronización: Otra pestaña del navegador tiene el bloqueo de sync activo.');
          return;
        }
      }
      
      await db.sync_meta.put({ key: 'sync_lock', value: new Date(nowMs).toISOString() });
      hasLock = true;
    });
  } catch (err) {
    console.error('[Sync Engine] Error al intentar obtener el bloqueo de sincronización:', err);
    return;
  }

  if (!hasLock) return;

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

    await db.sync_meta.put({ key: 'last_synced_at', value: currentSyncStart });
    syncState.lastSyncedAt = new Date(currentSyncStart).toLocaleString();
    syncState.error = null;
    
    console.log('[Sync Engine] Sincronización finalizada con éxito.');
  } catch (err) {
    console.error('[Sync Engine] Fallo en el ciclo de sincronización:', err);
    syncState.error = err.message || 'Error de comunicación remota';
  } finally {
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
    { name: 'profiles', store: db.profiles },
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

// --- PIAR P2P: Sincronización WebRTC Offline mediante Señalización Manual ---

export const p2pSyncManager = {
  peerConnection: null,
  dataChannel: null,
  status: 'disconnected', // 'disconnected', 'initiating', 'waiting_answer', 'connecting', 'connected'
  onStatusChange: null,
  onLog: null,

  log(msg) {
    console.log(`[P2P Sync] ${msg}`);
    if (this.onLog) this.onLog(msg);
  },

  setStatus(newStatus) {
    this.status = newStatus;
    if (this.onStatusChange) this.onStatusChange(newStatus);
  },

  // Dispositivo A: Crear oferta SDP
  async startInitiator() {
    this.log('Iniciando rol de emisor (Iniciador)...');
    this.setStatus('initiating');

    // iceServers vacío obliga a buscar conexiones en la red local LAN sin internet
    this.peerConnection = new RTCPeerConnection({ iceServers: [] });
    
    // Crear el canal de datos WebRTC
    this.dataChannel = this.peerConnection.createDataChannel('meal_sync_channel', { ordered: true });
    this.setupDataChannelEvents();

    // Crear la oferta SDP
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    // Esperar a que se complete la recolección de candidatos locales antes de entregar el SDP
    return new Promise((resolve) => {
      this.peerConnection.onicegatheringstatechange = () => {
        if (this.peerConnection.iceGatheringState === 'complete') {
          this.log('Recolección de candidatos ICE locales completada.');
          const sdpText = btoa(JSON.stringify(this.peerConnection.localDescription));
          this.setStatus('waiting_answer');
          resolve(sdpText);
        }
      };
      
      // Fallback si ya estuviera completo
      if (this.peerConnection.iceGatheringState === 'complete') {
        const sdpText = btoa(JSON.stringify(this.peerConnection.localDescription));
        this.setStatus('waiting_answer');
        resolve(sdpText);
      }
    });
  },

  // Dispositivo B: Recibir oferta SDP y generar respuesta SDP
  async startReceiver(offerSdpBase64) {
    this.log('Procesando oferta SDP recibida...');
    this.setStatus('connecting');

    const offerDescription = JSON.parse(atob(offerSdpBase64));
    this.peerConnection = new RTCPeerConnection({ iceServers: [] });

    // Escuchar el canal de datos creado por el Iniciador
    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannelEvents();
    };

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offerDescription));
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    return new Promise((resolve) => {
      this.peerConnection.onicegatheringstatechange = () => {
        if (this.peerConnection.iceGatheringState === 'complete') {
          this.log('Recolección de candidatos ICE completada en receptor.');
          const answerSdpText = btoa(JSON.stringify(this.peerConnection.localDescription));
          resolve(answerSdpText);
        }
      };

      if (this.peerConnection.iceGatheringState === 'complete') {
        const answerSdpText = btoa(JSON.stringify(this.peerConnection.localDescription));
        resolve(answerSdpText);
      }
    });
  },

  // Dispositivo A: Aceptar respuesta SDP del Dispositivo B
  async acceptAnswer(answerSdpBase64) {
    this.log('Procesando respuesta SDP recibida...');
    const answerDescription = JSON.parse(atob(answerSdpBase64));
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answerDescription));
    this.setStatus('connecting');
  },

  setupDataChannelEvents() {
    this.dataChannel.onopen = () => {
      this.log('¡Conexión WebRTC P2P Offline abierta exitosamente!');
      this.setStatus('connected');
      // Al abrirse, enviamos automáticamente nuestra cola local
      this.sendLocalQueue();
    };

    this.dataChannel.onclose = () => {
      this.log('Conexión P2P cerrada.');
      this.setStatus('disconnected');
    };

    this.dataChannel.onmessage = async (event) => {
      this.log('Recibiendo datos de sincronización del par...');
      try {
        const payload = JSON.parse(event.data);
        await mergeP2PPayload(payload);
        this.log('Fusión e integración de datos completada satisfactoriamente.');
      } catch (err) {
        this.log(`Error al procesar los datos P2P recibidos: ${err.message}`);
      }
    };
  },

  // Enviar todos los registros pendientes de sincronización (Sync Queue)
  async sendLocalQueue() {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      this.log('Imposible enviar cola: Canal WebRTC no está abierto.');
      return;
    }

    this.log('Recopilando cola local para transmisión...');
    
    // Obtener los datos locales de Dexie que requieran sincronización
    const payload = {
      survey_responses: await db.survey_responses.where('sync_status').equals('pending_sync').toArray(),
      feedbacks: await db.feedbacks.where('sync_status').equals('pending_sync').toArray(),
      lessons_learned: await db.lessons_learned.where('sync_status').equals('pending_sync').toArray(),
      indicators: await db.indicators.filter(ind => ind.sync_status === 'pending_sync').toArray(),
      profiles: await db.profiles.filter(p => p.sync_status === 'pending_sync').toArray()
    };

    this.dataChannel.send(JSON.stringify(payload));
    this.log('Cola local transmitida exitosamente al dispositivo par.');
  },

  close() {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.setStatus('disconnected');
    this.log('Conexión reiniciada.');
  }
};

// Fusionar los datos recibidos mediante WebRTC P2P (LWW)
async function mergeP2PPayload(payload) {
  const tables = [
    { name: 'profiles', store: db.profiles },
    { name: 'indicators', store: db.indicators },
    { name: 'survey_responses', store: db.survey_responses },
    { name: 'feedbacks', store: db.feedbacks },
    { name: 'lessons_learned', store: db.lessons_learned }
  ];

  for (const { name, store } of tables) {
    const remoteRecords = payload[name] || [];
    for (const remoteRecord of remoteRecords) {
      const localRecord = await store.get(remoteRecord.id);

      // Criterio de validación de firma criptográfica local antes de fusionar
      // (Si el registro tiene una firma, recalculamos y comparamos para asegurar validez)
      if (remoteRecord.signature) {
        const calculatedSignature = await calculateRecordHash(remoteRecord);
        if (calculatedSignature !== remoteRecord.signature) {
          console.warn(`[P2P Sync] Se descarta registro corrompido de "${name}" id ${remoteRecord.id} por firma inválida.`);
          continue;
        }
      }

      if (shouldRemoteOverwriteLocal(localRecord, remoteRecord)) {
        const toSave = { ...remoteRecord };
        // Asegurar que el registro consolidado mantenga el estado de sincronización pendiente
        toSave.sync_status = 'pending_sync';
        await store.put(toSave);
      }
    }
  }
  await updatePendingCount();
}
