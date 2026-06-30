import React, { useState, useEffect } from 'react';
import { 
  subscribeToSyncState, 
  triggerSync, 
  setSimulatedOffline,
  p2pSyncManager
} from '../syncEngine';
import { 
  Wifi, 
  WifiOff, 
  RotateCw, 
  CloudLightning, 
  CheckCircle2, 
  AlertTriangle,
  Users,
  Copy,
  Check,
  Play,
  ArrowRightLeft,
  X
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

  // Estados para la interfaz P2P WebRTC
  const [showP2PPanel, setShowP2PPanel] = useState(false);
  const [p2pRole, setP2PRole] = useState(null); // 'initiator' o 'receiver'
  const [sdpOfferText, setSdpOfferText] = useState('');
  const [sdpAnswerText, setSdpAnswerText] = useState('');
  
  const [generatedSdp, setGeneratedSdp] = useState('');
  const [p2pStatus, setP2PStatus] = useState('disconnected');
  const [p2pLogs, setP2PLogs] = useState([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToSyncState((newState) => {
      setSync(newState);
    });
    return unsubscribe;
  }, []);

  // Suscribirse a los cambios de estado de p2pSyncManager
  useEffect(() => {
    p2pSyncManager.onStatusChange = (status) => {
      setP2PStatus(status);
    };

    p2pSyncManager.onLog = (logMsg) => {
      setP2PLogs(prev => [...prev.slice(-15), `[${new Date().toLocaleTimeString()}] ${logMsg}`]);
    };

    return () => {
      p2pSyncManager.onStatusChange = null;
      p2pSyncManager.onLog = null;
    };
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

  // --- CONTROLADORES WEBRTC P2P ---
  
  const handleStartP2PInitiator = async () => {
    setP2PRole('initiator');
    setGeneratedSdp('');
    setSdpAnswerText('');
    setP2PLogs([]);
    try {
      const offerBase64 = await p2pSyncManager.startInitiator();
      setGeneratedSdp(offerBase64);
    } catch (err) {
      p2pSyncManager.log(`Fallo al generar oferta SDP: ${err.message}`);
    }
  };

  const handleStartP2PReceiver = () => {
    setP2PRole('receiver');
    setSdpOfferText('');
    setGeneratedSdp('');
    setP2PLogs([]);
  };

  const handleProcessOfferAndAnswer = async () => {
    if (!sdpOfferText) return;
    try {
      const answerBase64 = await p2pSyncManager.startReceiver(sdpOfferText.trim());
      setGeneratedSdp(answerBase64);
    } catch (err) {
      p2pSyncManager.log(`Fallo al procesar oferta u obtener respuesta: ${err.message}`);
    }
  };

  const handleConnectInitiator = async () => {
    if (!sdpAnswerText) return;
    try {
      await p2pSyncManager.acceptAnswer(sdpAnswerText.trim());
    } catch (err) {
      p2pSyncManager.log(`Error al aceptar respuesta SDP: ${err.message}`);
    }
  };

  const handleCopySdp = () => {
    if (!generatedSdp) return;
    navigator.clipboard.writeText(generatedSdp);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCloseP2P = () => {
    p2pSyncManager.close();
    setP2PRole(null);
    setGeneratedSdp('');
    setSdpOfferText('');
    setSdpAnswerText('');
    setShowP2PPanel(false);
  };

  // Determinar clases y textos de estado para el badge
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

  // Clases y colores para P2P status
  const getP2PStatusBadgeColor = (status) => {
    switch (status) {
      case 'connected': return '#10b981';
      case 'connecting':
      case 'initiating':
      case 'waiting_answer': return '#eab308';
      default: return 'var(--text-secondary)';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
      
      {/* 1. INDICADOR PRINCIPAL DE RED */}
      <div className="glass-panel" style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <span className={`badge ${badgeClass}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            {statusIcon}
            {statusText}
          </span>

          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Última Sincronización: <strong style={{ color: 'var(--text-primary)' }}>{sync.lastSyncedAt}</strong>
          </span>

          {sync.error && (
            <span className="badge badge-warning" style={{ color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.05)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }} title={sync.error}>
              <AlertTriangle size={14} />
              Error de Red
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Botón para expandir Sincronización P2P WebRTC */}
          <button 
            onClick={() => setShowP2PPanel(!showP2PPanel)}
            className="btn btn-secondary"
            style={{ 
              padding: '0.4rem 0.8rem', 
              fontSize: '0.8rem',
              borderColor: showP2PPanel ? 'var(--primary-color)' : 'var(--border-glass)',
              background: showP2PPanel ? 'rgba(5, 150, 105, 0.08)' : 'transparent'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: showP2PPanel ? 'var(--primary-light)' : 'var(--text-primary)' }}>
              <Users size={14} /> Sincro P2P Offline
            </span>
          </button>

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

      {/* 2. PANEL INTERACTIVO WEBRTC P2P OFFLINE */}
      {showP2PPanel && (
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', background: 'rgba(15,23,42,0.4)', border: '1px dashed var(--border-glass)' }}>
          <div className="flex-between">
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.95rem' }}>
              <ArrowRightLeft size={16} style={{ color: 'var(--primary-light)' }} /> Canal Par-a-Par WebRTC (Offline en Campo)
            </h3>
            
            <button onClick={handleCloseP2P} style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--text-secondary)' }}>
              <X size={16} />
            </button>
          </div>

          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Permite fusionar datos Dexie locales (LWW) en la red local offline. Selecciona el rol de cada equipo.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
            
            {/* Columna Izquierda: Roles e Inicio */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderRight: '1px dashed var(--border-glass)', paddingRight: '1.5rem' }}>
              <strong>1. Elegir Rol:</strong>
              
              <button 
                onClick={handleStartP2PInitiator} 
                className="btn btn-secondary" 
                style={{ 
                  textAlign: 'left', 
                  fontSize: '0.8rem', 
                  padding: '0.5rem 0.75rem',
                  borderColor: p2pRole === 'initiator' ? 'var(--primary-color)' : 'var(--border-glass)',
                  background: p2pRole === 'initiator' ? 'rgba(5,150,105,0.05)' : 'transparent'
                }}
              >
                📡 Dispositivo A (Emisor/Iniciador)
              </button>

              <button 
                onClick={handleStartP2PReceiver} 
                className="btn btn-secondary" 
                style={{ 
                  textAlign: 'left', 
                  fontSize: '0.8rem', 
                  padding: '0.5rem 0.75rem',
                  borderColor: p2pRole === 'receiver' ? 'var(--primary-color)' : 'var(--border-glass)',
                  background: p2pRole === 'receiver' ? 'rgba(5,150,105,0.05)' : 'transparent'
                }}
              >
                📥 Dispositivo B (Receptor)
              </button>

              <div style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>
                Estado P2P: <strong style={{ color: getP2PStatusBadgeColor(p2pStatus) }}>{p2pStatus.toUpperCase()}</strong>
              </div>
            </div>

            {/* Columna Derecha: Intercambio de SDP */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* Flujo Iniciador */}
              {p2pRole === 'initiator' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <strong>2. Proceso de Conexión (Iniciador):</strong>
                  
                  {generatedSdp ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Copia esta Oferta y pégala en el Dispositivo B:</span>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input 
                          type="text" 
                          readOnly 
                          value={generatedSdp} 
                          onClick={handleCopySdp}
                          style={{ fontSize: '0.7rem', padding: '0.4rem', background: 'var(--bg-dark)' }} 
                        />
                        <button onClick={handleCopySdp} className="btn btn-secondary" style={{ padding: '0.4rem' }}>
                          {copied ? <Check size={14} style={{ color: '#10b981' }} /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Generando oferta local SDP...</span>
                  )}

                  <div className="form-group" style={{ marginTop: '0.5rem' }}>
                    <label style={{ fontSize: '0.75rem' }}>3. Pega la Respuesta SDP generada por el Dispositivo B:</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input 
                        type="text" 
                        placeholder="Pega la respuesta del par..." 
                        value={sdpAnswerText}
                        onChange={e => setSdpAnswerText(e.target.value)}
                        style={{ fontSize: '0.7rem', padding: '0.4rem' }}
                      />
                      <button 
                        onClick={handleConnectInitiator} 
                        disabled={!sdpAnswerText}
                        className="btn btn-primary" 
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
                      >
                        Conectar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Flujo Receptor */}
              {p2pRole === 'receiver' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <strong>2. Proceso de Conexión (Receptor):</strong>
                  
                  <div className="form-group">
                    <label style={{ fontSize: '0.75rem' }}>Pega la Oferta SDP del Dispositivo A:</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input 
                        type="text" 
                        placeholder="Pega la oferta del par..." 
                        value={sdpOfferText}
                        onChange={e => setSdpOfferText(e.target.value)}
                        style={{ fontSize: '0.7rem', padding: '0.4rem' }}
                      />
                      <button 
                        onClick={handleProcessOfferAndAnswer} 
                        disabled={!sdpOfferText}
                        className="btn btn-primary" 
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
                      >
                        Procesar
                      </button>
                    </div>
                  </div>

                  {generatedSdp && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Copia esta Respuesta y pégala en el Dispositivo A:</span>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input 
                          type="text" 
                          readOnly 
                          value={generatedSdp} 
                          onClick={handleCopySdp}
                          style={{ fontSize: '0.7rem', padding: '0.4rem', background: 'var(--bg-dark)' }} 
                        />
                        <button onClick={handleCopySdp} className="btn btn-secondary" style={{ padding: '0.4rem' }}>
                          {copied ? <Check size={14} style={{ color: '#10b981' }} /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!p2pRole && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Selecciona un rol a la izquierda para iniciar la sincronización manual.
                </div>
              )}

            </div>
          </div>

          {/* Consola de logs de sincronización */}
          {p2pLogs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', borderTop: '1px dashed var(--border-glass)', paddingTop: '0.75rem' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Consola de Operaciones P2P:</span>
              <div 
                style={{ 
                  background: 'rgba(0,0,0,0.3)', 
                  padding: '0.5rem 0.75rem', 
                  borderRadius: '6px', 
                  maxHeight: '80px', 
                  overflowY: 'auto', 
                  fontSize: '0.65rem',
                  fontFamily: 'monospace',
                  color: '#a7f3d0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.15rem'
                }}
              >
                {p2pLogs.map((log, idx) => (
                  <div key={idx}>{log}</div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
