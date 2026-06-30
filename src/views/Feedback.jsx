import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { updatePendingCount } from '../syncEngine';
import { MessageSquare, Send, CheckCircle2, AlertCircle, Info, Lock } from 'lucide-react';

export default function Feedback({ currentUser }) {
  const isAdmin = currentUser?.role === 'admin';
  const isViewer = currentUser?.role === 'viewer';

  // Cargar datos reactivos locales
  const projects = useLiveQuery(() => db.projects.toArray()) || [];
  const feedbacks = useLiveQuery(() => db.feedbacks.toArray()) || [];

  // Pestañas: 'report' (registrar queja) o 'admin_panel' (historial y seguimiento)
  const [tab, setTab] = useState(isAdmin ? 'admin_panel' : 'report');

  // Formulario de Reporte
  const [projectId, setProjectId] = useState('');
  const [category, setCategory] = useState('complaint');
  const [details, setDetails] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

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
      status: 'pending',
      updated_at: now,
      sync_status: 'pending_sync' // Marcar para sincronizar
    };

    try {
      await db.feedbacks.add(newFeedback);
      
      setProjectId('');
      setCategory('complaint');
      setDetails('');
      setContactInfo('');
      setSubmitSuccess(true);
      await updatePendingCount();

      setTimeout(() => {
        setSubmitSuccess(false);
        if (isAdmin) setTab('admin_panel');
      }, 2000);
    } catch (err) {
      console.error('Error guardando feedback:', err);
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Cabecera */}
      <div>
        <h1>Mecanismo de Rendición de Cuentas (FCRM)</h1>
        <p>Canal de comunicación seguro para capturar sugerencias, quejas e inquietudes de la comunidad.</p>
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

      {/* REGISTRAR FEEDBACK */}
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
                <label>Detalles del Caso (Sé lo más descriptivo posible)</label>
                <textarea 
                  rows="4" 
                  placeholder="Explica qué sucedió, cuándo, y dónde..."
                  value={details}
                  onChange={e => setDetails(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Datos de Contacto (Nombre, Teléfono o marcar como Anónimo)</label>
                <input 
                  type="text" 
                  placeholder="Ej. Juan Perez, Tel: 7777-8888 o vacío para dejar anónimo"
                  value={contactInfo}
                  onChange={e => setContactInfo(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
                <Send size={16} /> Guardar localmente en el Buzón
              </button>
            </form>
          )}
        </div>
      )}

      {/* BANDEJA / HISTORIAL */}
      {tab === 'admin_panel' && (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
            <h3>Historial de Casos Ingresados</h3>
            {!isAdmin && (
              <span className="badge badge-info" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem' }}>
                <Info size={12} /> Solo Administradores pueden cambiar el estado administrativo del caso
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {feedbacks.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No existen registros ingresados en el buzón actualmente.
              </div>
            ) : (
              feedbacks.slice().reverse().map(fb => {
                const project = projects.find(p => p.id === fb.project_id);
                const isSynced = fb.sync_status === 'synced';

                return (
                  <div 
                    key={fb.id}
                    className="glass-card"
                    style={{ 
                      background: 'rgba(30,41,59,0.3)', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '0.75rem',
                      borderLeft: fb.status === 'pending' ? '4px solid #ef4444' : fb.status === 'under_review' ? '4px solid #eab308' : '4px solid #10b981'
                    }}
                  >
                    {/* Fila 1 */}
                    <div className="flex-between" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span className="badge badge-info" style={{ textTransform: 'none' }}>
                          {getCategoryLabel(fb.category)}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Proyecto: {project ? project.name : 'Desconocido'}
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className={`badge ${isSynced ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.6rem' }}>
                          {isSynced ? 'Sincronizado' : 'Pendiente Sincro'}
                        </span>
                        
                        <span className={`badge ${getStatusBadge(fb.status)}`} style={{ fontSize: '0.7rem' }}>
                          {getStatusLabel(fb.status)}
                        </span>
                      </div>
                    </div>

                    {/* Fila 2 (Detalles) */}
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', background: 'rgba(0,0,0,0.1)', padding: '0.75rem', borderRadius: '6px' }}>
                      {fb.details}
                    </p>

                    {/* Fila 3 */}
                    <div className="flex-between" style={{ flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <span>Contacto: <strong style={{ color: 'var(--text-primary)' }}>{fb.contact_info}</strong></span>
                      <span>Modificado: {new Date(fb.updated_at).toLocaleString()}</span>
                      
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
