import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { updatePendingCount } from '../syncEngine';
import { MessageSquare, Send, CheckCircle2, AlertCircle, Info, Lock, Clock, ShieldAlert, EyeOff } from 'lucide-react';

export default function Feedback({ currentUser }) {
  const isAdmin = currentUser?.role === 'admin';
  const isViewer = currentUser?.role === 'viewer';

  // Cargar datos reactivos locales
  const projects = useLiveQuery(() => db.projects.toArray()) || [];
  const feedbacks = useLiveQuery(() => db.feedbacks.toArray()) || [];

  // Pestañas: 'report' o 'admin_panel'
  const [tab, setTab] = useState(isAdmin ? 'admin_panel' : 'report');

  // Formulario de Reporte
  const [projectId, setProjectId] = useState('');
  const [category, setCategory] = useState('complaint');
  const [details, setDetails] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [severity, setSeverity] = useState('medium'); // Por defecto Media
  const [isConfidential, setIsConfidential] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Estado para la respuesta oficial (Admin)
  const [responseMap, setResponseMap] = useState({});

  const handleSaveFeedback = async (e) => {
    e.preventDefault();
    if (isViewer) return;
    if (!projectId || !details) return;

    const newId = `fb-uuid-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const newFeedback = {
      id: newId,
      project_id: projectId,
      category,
      details,
      contact_info: contactInfo || 'Anónimo',
      severity,
      is_confidential: isConfidential,
      status: 'pending',
      response_text: null,
      created_at: now,
      updated_at: now,
      sync_status: 'pending_sync'
    };

    try {
      await db.feedbacks.add(newFeedback);
      
      setProjectId('');
      setCategory('complaint');
      setDetails('');
      setContactInfo('');
      setSeverity('medium');
      setIsConfidential(false);
      setSubmitSuccess(true);
      await updatePendingCount();

      setTimeout(() => {
        setSubmitSuccess(false);
        setTab('admin_panel');
      }, 2000);
    } catch (err) {
      console.error('Error guardando feedback:', err);
    }
  };

  const handleSaveResponse = async (fbId, text) => {
    if (!isAdmin) return;
    if (!text || !text.trim()) return;

    try {
      // Registrar la respuesta y marcar como resuelto
      await db.feedbacks.update(fbId, {
        response_text: text,
        status: 'resolved',
        updated_at: new Date().toISOString(),
        sync_status: 'pending_sync'
      });

      // Limpiar el campo del textarea en el mapa local
      setResponseMap(prev => {
        const next = { ...prev };
        delete next[fbId];
        return next;
      });

      await updatePendingCount();
    } catch (err) {
      console.error('Error guardando respuesta al feedback:', err);
    }
  };

  const handleStatusChange = async (fbId, newStatus) => {
    if (!isAdmin) return;

    try {
      await db.feedbacks.update(fbId, {
        status: newStatus,
        updated_at: new Date().toISOString(),
        sync_status: 'pending_sync'
      });
      await updatePendingCount();
    } catch (err) {
      console.error('Error actualizando estado de queja:', err);
    }
  };

  const getCategoryLabel = (cat) => {
    switch (cat) {
      case 'complaint': return 'Queja';
      case 'suggestion': return 'Sugerencia';
      case 'inquiry': return 'Consulta';
      case 'compliment': return 'Felicitación';
      default: return cat;
    }
  };

  const getStatusLabel = (st) => {
    switch (st) {
      case 'pending': return 'Pendiente';
      case 'under_review': return 'En Revisión';
      case 'resolved': return 'Resuelto';
      default: return st;
    }
  };

  const getStatusBadge = (st) => {
    switch (st) {
      case 'pending': return 'badge-danger';
      case 'under_review': return 'badge-warning';
      case 'resolved': return 'badge-success';
      default: return 'badge-info';
    }
  };

  const getSeverityBadge = (sev) => {
    switch (sev) {
      case 'high': return { bg: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.2)', text: 'Alta (SLA 5d)' };
      case 'medium': return { bg: 'rgba(234, 179, 8, 0.1)', color: '#fef08a', border: '1px solid rgba(234, 179, 8, 0.2)', text: 'Media (SLA 15d)' };
      case 'low': return { bg: 'rgba(14, 165, 233, 0.1)', color: '#e0f2fe', border: '1px solid rgba(14, 165, 233, 0.2)', text: 'Baja (SLA 30d)' };
      default: return { bg: 'rgba(255,255,255,0.05)', color: 'white', border: 'none', text: sev };
    }
  };

  // Calcular el estado de SLA (Pilar 3)
  const renderSlaStatus = (fb) => {
    if (fb.status === 'resolved') {
      return (
        <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.65rem' }}>
          <CheckCircle2 size={12} /> Cerrado
        </span>
      );
    }

    const createdTime = new Date(fb.created_at || fb.updated_at).getTime();
    const nowTime = Date.now();
    let slaDays = 30; // Bajo por defecto
    if (fb.severity === 'high') slaDays = 5;
    else if (fb.severity === 'medium') slaDays = 15;

    const limitTime = createdTime + (slaDays * 24 * 60 * 60 * 1000);
    const timeRemaining = limitTime - nowTime;
    const daysRemaining = Math.ceil(timeRemaining / (1000 * 60 * 60 * 24));

    if (daysRemaining < 0) {
      return (
        <span className="badge badge-danger" style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.65rem', background: '#ef4444', color: 'white' }}>
          <AlertCircle size={12} /> VENCIDO ({Math.abs(daysRemaining)}d de retraso)
        </span>
      );
    } else {
      return (
        <span 
          className="badge" 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.2rem', 
            fontSize: '0.65rem', 
            background: daysRemaining <= 2 ? 'rgba(234, 179, 8, 0.2)' : 'rgba(16, 185, 129, 0.1)',
            color: daysRemaining <= 2 ? '#fef08a' : '#a7f3d0',
            border: `1px solid ${daysRemaining <= 2 ? 'rgba(234, 179, 8, 0.3)' : 'rgba(16, 185, 129, 0.2)'}`
          }}
        >
          <Clock size={12} /> SLA: {daysRemaining} días restantes
        </span>
      );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Cabecera */}
      <div>
        <h1>Mecanismo de Quejas y Respuestas (FRM)</h1>
        <p>Buzón seguro de retroalimentación comunitaria con flujos de confidencialidad y control de ANS/SLA.</p>
      </div>

      {/* Tabs */}
      <div className="glass-panel" style={{ padding: '0.5rem', display: 'flex', gap: '0.5rem' }}>
        <button 
          onClick={() => setTab('report')}
          disabled={isViewer}
          className="btn"
          style={{ 
            flex: 1, 
            background: tab === 'report' ? 'var(--bg-dark)' : 'transparent',
            borderColor: tab === 'report' ? 'var(--border-glass)' : 'transparent',
            color: tab === 'report' ? 'var(--primary-light)' : 'var(--text-secondary)',
            opacity: isViewer ? 0.4 : 1
          }}
        >
          {isViewer ? <><Lock size={12} style={{ display: 'inline', marginRight: '4px' }} /> Registrar Reporte</> : 'Registrar Reporte'}
        </button>

        <button 
          onClick={() => setTab('admin_panel')}
          className="btn"
          style={{ 
            flex: 1, 
            background: tab === 'admin_panel' ? 'var(--bg-dark)' : 'transparent',
            borderColor: tab === 'admin_panel' ? 'var(--border-glass)' : 'transparent',
            color: tab === 'admin_panel' ? 'var(--primary-light)' : 'var(--text-secondary)'
          }}
        >
          {isAdmin ? 'Bandeja de Entrada (Admin)' : 'Historial de Reportes'}
        </button>
      </div>

      {/* REGISTRAR FEEDBACK (FRM FORM) */}
      {tab === 'report' && !isViewer && (
        <div className="glass-panel" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
          {submitSuccess ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 0', gap: '1rem' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--status-online)', padding: '1rem', borderRadius: '50%' }}>
                <CheckCircle2 size={48} />
              </div>
              <h2>Reporte Registrado</h2>
              <p style={{ textAlign: 'center' }}>Los detalles del caso se guardaron localmente en el buzón y serán revisados por el oficial de rendición de cuentas.</p>
            </div>
          ) : (
            <form onSubmit={handleSaveFeedback} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MessageSquare size={22} style={{ color: 'var(--primary-light)' }} /> Capturar Comentario en Terreno
              </h2>
              
              <div className="form-group">
                <label>Proyecto Referenciado</label>
                <select 
                  value={projectId} 
                  onChange={e => setProjectId(e.target.value)}
                  required
                >
                  <option value="">-- Seleccionar Proyecto --</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div className="form-group">
                  <label>Categoría del Reporte</label>
                  <select 
                    value={category} 
                    onChange={e => setCategory(e.target.value)}
                  >
                    <option value="complaint">Queja (Insatisfacción o Fallo Técnico)</option>
                    <option value="suggestion">Sugerencia (Idea de Mejora)</option>
                    <option value="inquiry">Consulta (Pregunta de Información)</option>
                    <option value="compliment">Felicitación (Agradecimiento)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Nivel de Severidad (ANS/SLA)</label>
                  <select 
                    value={severity} 
                    onChange={e => setSeverity(e.target.value)}
                  >
                    <option value="low">Baja (ANS 30 días - Sugerencias / Felicitaciones)</option>
                    <option value="medium">Media (ANS 15 días - Problemas operativos / Retrasos)</option>
                    <option value="high">Alta (ANS 5 días - Sospechas de fraude / Protección)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Detalles del Caso (Sé lo más descriptivo posible)</label>
                <textarea 
                  rows="4" 
                  placeholder="Explica qué sucedió, cuándo, y dónde..."
                  value={details}
                  onChange={e => setDetails(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Datos de Contacto (Nombre, Teléfono o marcar como Anónimo)</label>
                  <input 
                    type="text" 
                    placeholder="Ej. Juan Perez, Tel: 312-4545 o dejar vacío para anónimo"
                    value={contactInfo}
                    onChange={e => setContactInfo(e.target.value)}
                    disabled={isConfidential}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <input 
                    type="checkbox" 
                    id="chkConf"
                    checked={isConfidential}
                    onChange={e => {
                      setIsConfidential(e.target.checked);
                      if (e.target.checked) setContactInfo('Información Confidencial');
                    }}
                    style={{ width: 'auto', cursor: 'pointer' }}
                  />
                  <label htmlFor="chkConf" style={{ marginBottom: 0, fontSize: '0.8rem', fontWeight: 600, color: 'var(--secondary-light)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <EyeOff size={14} /> Marcar este reporte como CONFIDENCIAL
                  </label>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
                <Send size={16} /> Guardar localmente en el Buzón
              </button>
            </form>
          )}
        </div>
      )}

      {/* BANDEJA / HISTORIAL (FRM BANDEJA) */}
      {tab === 'admin_panel' && (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
            <h3>Buzón de Rendición de Cuentas (FCRM)</h3>
            {!isAdmin && (
              <span className="badge badge-info" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem' }}>
                <Info size={12} /> Solo Administradores pueden responder oficialmente a las quejas
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {feedbacks.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No existen registros ingresados en el buzón actualmente.
              </div>
            ) : (
              feedbacks.slice().reverse().map(fb => {
                const project = projects.find(p => p.id === fb.project_id);
                const isSynced = fb.sync_status === 'synced';
                const sevInfo = getSeverityBadge(fb.severity || 'low');

                // Encriptación y Ocultamiento por Confidencialidad (Pilar 3)
                const shouldMaskContact = fb.is_confidential && !isAdmin;
                const contactLabel = shouldMaskContact 
                  ? '[CONFIDENCIAL - DETALLES RESERVADOS]' 
                  : fb.contact_info;

                const hasResponseText = fb.response_text && fb.response_text.trim();

                return (
                  <div 
                    key={fb.id}
                    className="glass-card"
                    style={{ 
                      background: 'rgba(30,41,59,0.3)', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '0.85rem',
                      borderLeft: fb.status === 'pending' ? '4px solid #ef4444' : fb.status === 'under_review' ? '4px solid #eab308' : '4px solid #10b981'
                    }}
                  >
                    {/* Fila superior de información */}
                    <div className="flex-between" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="badge badge-info" style={{ textTransform: 'none', fontSize: '0.7rem' }}>
                          {getCategoryLabel(fb.category)}
                        </span>
                        
                        {/* Badge de Severidad (Pilar 3) */}
                        <span 
                          className="badge" 
                          style={{ 
                            background: sevInfo.bg, 
                            color: sevInfo.color, 
                            border: sevInfo.border,
                            fontSize: '0.65rem' 
                          }}
                        >
                          {sevInfo.text}
                        </span>

                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Proyecto: {project ? project.name : 'Desconocido'}
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {renderSlaStatus(fb)}

                        <span className={`badge ${isSynced ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.6rem' }}>
                          {isSynced ? 'Sincronizado' : 'Pendiente Sincro'}
                        </span>
                        
                        <span className={`badge ${getStatusBadge(fb.status)}`} style={{ fontSize: '0.7rem' }}>
                          {getStatusLabel(fb.status)}
                        </span>
                      </div>
                    </div>

                    {/* Contenido/Detalles */}
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', background: 'rgba(0,0,0,0.15)', padding: '0.75rem 1rem', borderRadius: '6px', margin: 0 }}>
                      {fb.details}
                    </p>

                    {/* Respuesta Oficial (si existe) */}
                    {hasResponseText && (
                      <div style={{ padding: '0.75rem 1rem', background: 'rgba(16, 185, 129, 0.04)', border: '1px solid rgba(16, 185, 129, 0.15)', borderRadius: '6px' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#a7f3d0', display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.2rem' }}>
                          <CheckCircle2 size={12} /> Respuesta Oficial dada a la comunidad:
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>{fb.response_text}</p>
                      </div>
                    )}

                    {/* Fila inferior de metadata y controles */}
                    <div className="flex-between" style={{ flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        Contacto:{' '}
                        <strong style={{ color: fb.is_confidential ? 'var(--secondary-light)' : 'var(--text-primary)' }}>
                          {contactLabel}
                        </strong>
                        {fb.is_confidential && <EyeOff size={12} style={{ color: 'var(--secondary-light)' }} />}
                      </span>
                      <span>Fecha Reporte: {new Date(fb.created_at || fb.updated_at).toLocaleString()}</span>
                      
                      {isAdmin ? (
                        /* Selector administrativo de estado */
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <label style={{ fontSize: '0.75rem' }}>Cambiar Estado:</label>
                          <select
                            value={fb.status}
                            onChange={(e) => handleStatusChange(fb.id, e.target.value)}
                            style={{ padding: '0.2rem 1.25rem 0.2rem 0.5rem', width: 'auto', fontSize: '0.75rem' }}
                          >
                            <option value="pending">Pendiente</option>
                            <option value="under_review">En Revisión</option>
                            <option value="resolved">Resuelto</option>
                          </select>
                        </div>
                      ) : null}
                    </div>

                    {/* Sección para que el Administrador redacte respuesta oficial de cierre (Pilar 3) */}
                    {isAdmin && fb.status !== 'resolved' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px dashed var(--border-glass)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                        <textarea
                          placeholder="Escribe la respuesta oficial o la acción resolutiva tomada..."
                          rows="2"
                          value={responseMap[fb.id] || ''}
                          onChange={(e) => setResponseMap({ ...responseMap, [fb.id]: e.target.value })}
                          style={{ fontSize: '0.8rem', padding: '0.4rem' }}
                        />
                        <button
                          onClick={() => handleSaveResponse(fb.id, responseMap[fb.id])}
                          className="btn btn-primary"
                          style={{ alignSelf: 'flex-end', padding: '0.3rem 0.75rem', fontSize: '0.75rem' }}
                          disabled={!responseMap[fb.id] || !responseMap[fb.id].trim()}
                        >
                          Resolver Caso y Responder
                        </button>
                      </div>
                    )}

                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
