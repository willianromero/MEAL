import React, { useState, useEffect } from 'react';
import { 
  subscribeToSyncState, 
  triggerSync, 
  setSimulatedOffline 
} from '../syncEngine';
import { 
  Wifi, 
  WifiOff, 
  RotateCw, 
  CloudLightning, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';

export default function SyncIndicator() {
  const [sync, setSync] = useState({
    isOnline: navigator.onLine,
    isSyncing: false,
    pendingCount: 0,
    lastSyncedAt: 'Nunca',
    error: null,
    isSimulatedOffline: false
  });

  useEffect(() => {
    const unsubscribe = subscribeToSyncState((newState) => {
      setSync(newState);
    });
    return unsubscribe;
  }, []);

  const handleSyncClick = () => {
    if (sync.isOnline && !sync.isSyncing) {
      triggerSync();
    }
  };

  const toggleSimulation = () => {
    const nextVal = !sync.isSimulatedOffline;
    setSimulatedOffline(nextVal);
  };

  // Determinar clases y textos de estado
  let statusText = 'Sincronizado';
  let badgeClass = 'badge-success';
  let statusIcon = <CheckCircle2 size={16} />;

  if (sync.isSyncing) {
    statusText = 'Sincronizando...';
    badgeClass = 'badge-warning';
    statusIcon = <RotateCw size={16} className="animate-spin" />;
  } else if (!sync.isOnline) {
    statusText = sync.isSimulatedOffline ? 'Offline (Simulado)' : 'Desconectado';
    badgeClass = 'badge-warning';
    statusIcon = <WifiOff size={16} />;
  } else if (sync.pendingCount > 0) {
    statusText = `${sync.pendingCount} Pendiente(s)`;
    badgeClass = 'badge-info';
    statusIcon = <CloudLightning size={16} />;
  }

  return (
    <div className="glass-panel" style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        {/* Sync Status Badge */}
        <span className={`badge ${badgeClass}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          {statusIcon}
          {statusText}
        </span>

        {/* Last Synced Text */}
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Última Sincronización: <strong style={{ color: 'var(--text-primary)' }}>{sync.lastSyncedAt}</strong>
        </span>

        {/* Error alert if sync failed */}
        {sync.error && (
          <span className="badge badge-warning" style={{ color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.05)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }} title={sync.error}>
            <AlertTriangle size={14} />
            Error de Red
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {/* Force Offline Simulator Toggle */}
        <button 
          onClick={toggleSimulation}
          className="btn btn-secondary"
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
        >
          {sync.isSimulatedOffline ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--primary-light)' }}>
              <Wifi size={14} /> Reconectar
            </span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#f97316' }}>
              <WifiOff size={14} /> Simular Offline
            </span>
          )}
        </button>

        {/* Manual Sync Button */}
        <button
          onClick={handleSyncClick}
          disabled={!sync.isOnline || sync.isSyncing}
          className="btn btn-primary"
          style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', opacity: (!sync.isOnline || sync.isSyncing) ? 0.4 : 1 }}
        >
          <RotateCw size={14} className={sync.isSyncing ? 'animate-spin' : ''} />
          Sincronizar
        </button>
      </div>
    </div>
  );
}
