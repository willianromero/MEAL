import { db, calculateRecordHash } from './db';
import { supabase, isSupabaseConfigured } from './supabaseClient';

// Tablas sincronizables con el backend, en orden de dependencia (FKs).
// Toda tabla lleva tenant_id (RF-TEN-2) y sync_status indexado.
export const SYNC_TABLES = [
  { name: 'profiles', store: () => db.profiles },
  { name: 'tenants', store: () => db.tenants },
  { name: 'memberships', store: () => db.memberships },
  { name: 'units', store: () => db.units },
  { name: 'program_lines', store: () => db.program_lines },
  { name: 'projects', store: () => db.projects },
  { name: 'logframes', store: () => db.logframes },
  { name: 'forms', store: () => db.forms },
  { name: 'indicators', store: () => db.indicators },
  { name: 'indicator_values', store: () => db.indicator_values },
  { name: 'beneficiaries', store: () => db.beneficiaries },
  { name: 'consents', store: () => db.consents },
  { name: 'field_records', store: () => db.field_records },
  { name: 'evidences', store: () => db.evidences },
  { name: 'surveys', store: () => db.surveys },
  { name: 'survey_responses', store: () => db.survey_responses },
  { name: 'feedbacks', store: () => db.feedbacks },
  { name: 'lessons_learned', store: () => db.lessons_learned },
  { name: 'audit_log', store: () => db.audit_log }
];

// Estado global en memoria
let syncState = {
  isOnline: navigator.onLine,
  isSyncing: false,
  pendingCount: 0,
  errorCount: 0,
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
    let total = 0;
    let errors = 0;
    for (const { store } of SYNC_TABLES) {
      total += await store().where('sync_status').anyOf(['pending_sync', 'error']).count();
      errors += await store().where('sync_status').equals('error').count();
    }
    syncState.pendingCount = total;
    syncState.errorCount = errors;

    const meta = await db.sync_meta.get('last_synced_at');
    if (meta && meta.value !== '1970-01-01T00:00:00.000Z') {
      syncState.lastSyncedAt = new Date(meta.value).toLocaleString();
    } else {
      syncState.lastSyncedAt = 'Nunca';
    }

    notifySubscribers();

    // Auto-disparo: cada escritura local llama a updatePendingCount(), así que
    // este es el punto único donde "hay algo pendiente" se detecta. Se evita
    // al usuario tener que pulsar "Sincronizar" manualmente (RF-OFF-2).
    requestAutoSync();
  } catch (err) {
    console.error('Error calculando elementos pendientes:', err);
  }
}

// --- AUTO-SINCRONIZACIÓN ---
// Se dispara sola tras cada escritura local (vía updatePendingCount) y de
// forma periódica en segundo plano, para no depender de que el usuario pulse
// "Sincronizar". Con un piso mínimo entre disparos para no saturar la red si
// hay muchas escrituras seguidas (ej. varios indicadores creados rápido).
const AUTO_TRIGGER_MIN_INTERVAL_MS = 3000;
let lastAutoTriggerAt = 0;

function requestAutoSync() {
  if (syncState.pendingCount === 0) return;
  if (!syncState.isOnline || syncState.isSyncing) return;
  const now = Date.now();
  if (now - lastAutoTriggerAt < AUTO_TRIGGER_MIN_INTERVAL_MS) return;
  lastAutoTriggerAt = now;
  triggerSync();
}

// Reintento periódico en segundo plano: cubre fallas transitorias de red y
// autolibera un candado huérfano (ver lockTimeoutMs) sin acción del usuario.
const BACKGROUND_RETRY_INTERVAL_MS = 30000;
setInterval(() => {
  if (syncState.pendingCount > 0 && syncState.isOnline && !syncState.isSyncing) {
    triggerSync();
  }
}, BACKGROUND_RETRY_INTERVAL_MS);

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
  // Ventana corta a propósito: las operaciones de push/pull son idempotentes
  // (upsert por id), así que un candado duplicado no corrompe nada; en cambio
  // un candado huérfano (pestaña recargada a mitad de sync) NO debe bloquear
  // la sincronización más de un minuto.
  const lockTimeoutMs = 60 * 1000;

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

// Reintento con backoff exponencial para operaciones de red transitorias (RF-OFF-2).
async function withBackoff(fn, { retries = 3, baseMs = 500 } = {}) {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { error } = await fn();
    if (!error) return;
    attempt += 1;
    if (attempt > retries) throw new Error(error.message || 'Error de red tras reintentos');
    const delay = baseMs * Math.pow(2, attempt - 1); // 500ms, 1s, 2s...
    console.warn(`[Sync Engine] Reintento ${attempt}/${retries} en ${delay}ms: ${error.message || error}`);
    await new Promise(res => setTimeout(res, delay));
  }
}

// Campos locales que no viajan como columnas al backend (se manejan aparte).
const LOCAL_ONLY_FIELDS = { evidences: ['blob'] };

// --- SUBIR CAMBIOS LOCALES (PUSH) ---
// Recorre las tablas en orden de dependencia y sube los registros pendientes,
// por lotes idempotentes (UUID) y con reintentos por registro. Marca estado
// 'error' en el registro si agota reintentos, sin abortar toda la sincronización.
async function pushLocalChanges() {
  for (const { name, store } of SYNC_TABLES) {
    // Reintenta también los que quedaron en 'error' en ciclos previos
    const pending = await store().where('sync_status').anyOf(['pending_sync', 'error']).toArray();
    const stripFields = LOCAL_ONLY_FIELDS[name] || [];
    for (const record of pending) {
      const cleanRecord = { ...record };
      delete cleanRecord.sync_status;
      stripFields.forEach(f => delete cleanRecord[f]);
      try {
        await withBackoff(() => supabase.from(name).upsert(cleanRecord));
        // Las evidencias suben su binario al almacén de objetos por separado (8.3)
        if (name === 'evidences' && record.blob) {
          await uploadEvidenceBlob(record);
        }
        await store().update(record.id, { sync_status: 'synced' });
      } catch (err) {
        console.error(`[Sync Engine] Registro ${name}/${record.id} marcado con error:`, err.message);
        await store().update(record.id, { sync_status: 'error' });
      }
    }
  }
}

// Subida diferida del binario de una evidencia al bucket segregado por tenant.
async function uploadEvidenceBlob(evidence) {
  if (!isSupabaseConfigured || !supabase.storage) return; // en modo mock no hay almacén
  const path = `${evidence.tenant_id}/${evidence.registro_id}/${evidence.id}.jpg`;
  const { error } = await supabase.storage.from('evidencias').upload(path, evidence.blob, {
    contentType: evidence.mime || 'image/jpeg', upsert: true
  });
  if (error) throw new Error(`Fallo subida de evidencia: ${error.message}`);
  await db.evidences.update(evidence.id, { url_objeto: path });
}

// --- RESOLUCIÓN DE CONFLICTOS (DRT 8.4) ---
// Registros de campo y evidencias son INMUTABLES tras sincronizar: una vez que
// existen localmente, el servidor no los sobreescribe (una corrección es un
// registro nuevo). El resto de catálogos usa Last-Write-Wins por updated_at.
const IMMUTABLE_TABLES = new Set(['field_records', 'evidences', 'audit_log']);

export function shouldRemoteOverwriteLocal(localRecord, remoteRecord, tableName) {
  if (!localRecord) return true;
  if (tableName && IMMUTABLE_TABLES.has(tableName)) {
    // Inmutable: solo se acepta si el local aún no llegó al servidor y el
    // remoto es idéntico (idempotencia); nunca se pisa contenido ya validado.
    return false;
  }
  const isLocalPending = localRecord.sync_status === 'pending_sync';
  const localUpdatedAt = new Date(localRecord.updated_at).getTime();
  const remoteUpdatedAt = new Date(remoteRecord.updated_at).getTime();
  return !isLocalPending || remoteUpdatedAt > localUpdatedAt;
}

// --- DESCARGAR CAMBIOS REMOTOS (PULL) ---
async function pullRemoteChanges(lastSyncedStr) {
  for (const { name, store } of SYNC_TABLES) {
    const table = store();
    const { data, error } = await supabase
      .from(name)
      .select('*')
      .gt('updated_at', lastSyncedStr);

    if (error) {
      throw new Error(`Fallo pull tabla ${name}: ${error.message}`);
    }

    if (data && data.length > 0) {
      for (const remoteRecord of data) {
        const localRecord = await table.get(remoteRecord.id);

        if (shouldRemoteOverwriteLocal(localRecord, remoteRecord, name)) {
          await table.put({ ...remoteRecord, sync_status: 'synced' });
        } else {
          console.log(`[Sync Conflicto] Se conserva versión local de "${name}" id ${remoteRecord.id} (offline pendiente o registro inmutable).`);
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

    // Obtener de cada tabla los registros pendientes de sincronización
    const payload = {};
    for (const { name, store } of SYNC_TABLES) {
      payload[name] = await store().where('sync_status').equals('pending_sync').toArray();
    }

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

// Fusionar los datos recibidos mediante WebRTC P2P, validando firma y conflicto
async function mergeP2PPayload(payload) {
  for (const { name, store } of SYNC_TABLES) {
    const table = store();
    const remoteRecords = payload[name] || [];
    for (const remoteRecord of remoteRecords) {
      const localRecord = await table.get(remoteRecord.id);

      // Validación de firma criptográfica antes de fusionar: se recalcula el
      // hash y se descarta cualquier registro corrompido (integridad, 8.6).
      if (remoteRecord.signature) {
        const calculatedSignature = await calculateRecordHash(remoteRecord);
        if (calculatedSignature !== remoteRecord.signature) {
          console.warn(`[P2P Sync] Se descarta registro corrompido de "${name}" id ${remoteRecord.id} por firma inválida.`);
          continue;
        }
      }

      if (shouldRemoteOverwriteLocal(localRecord, remoteRecord, name)) {
        // El registro fusionado queda pendiente para propagarse al backend
        await table.put({ ...remoteRecord, sync_status: 'pending_sync' });
      }
    }
  }
  await updatePendingCount();
}
