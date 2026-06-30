import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { updatePendingCount } from '../syncEngine';
import { BookOpen, AlertTriangle, Lightbulb, Plus, Send, Info, Eye } from 'lucide-react';

export default function Lessons({ currentUser }) {
  const isViewer = currentUser?.role === 'viewer';

  // Cargar datos reactivos locales
  const projects = useLiveQuery(() => db.projects.toArray()) || [];
  const lessons = useLiveQuery(() => db.lessons_learned.toArray()) || [];

  // Vista activa: 'list' (revisar lecciones) o 'create' (nueva lección)
  const [tab, setTab] = useState('list');

  // Formulario de Nueva Lección
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [challenges, setChallenges] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const handleSaveLesson = async (e) => {
    e.preventDefault();
    if (isViewer) return;
    if (!projectId || !title || !description) return;

    const newId = `ll-uuid-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const newLesson = {
      id: newId,
      project_id: projectId,
      title,
      description,
      challenges,
      recommendations,
      updated_at: now,
      sync_status: 'pending_sync' // Marcar para sincronización
    };

    try {
      await db.lessons_learned.add(newLesson);
      
      setProjectId('');
      setTitle('');
      setDescription('');
      setChallenges('');
      setRecommendations('');
      setSubmitSuccess(true);
      await updatePendingCount();

      setTimeout(() => {
        setSubmitSuccess(false);
        setTab('list');
      }, 2000);
    } catch (err) {
      console.error('Error guardando lección aprendida:', err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Cabecera */}
      <div className="flex-between">
        <div>
          <h1>Lecciones Aprendidas (Learning)</h1>
          <p>Repositorio metodológico de conocimientos adquiridos, desafíos identificados y recomendaciones para futuros proyectos.</p>
        </div>

        {!isViewer && (
          <button 
            onClick={() => setTab(tab === 'list' ? 'create' : 'list')}
            className="btn btn-primary"
          >
            {tab === 'list' ? (
              <>
                <Plus size={16} /> Compartir Aprendizaje
              </>
            ) : (
              'Ver Repositorio'
            )}
          </button>
        )}
      </div>

      {/* Tabs para simular filtros de consulta rápida */}
      {tab === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {lessons.length === 0 ? (
            <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No se han registrado lecciones aprendidas en esta misión todavía.
            </div>
          ) : (
            lessons.slice().reverse().map(lesson => {
              const project = projects.find(p => p.id === lesson.project_id);
              const isSynced = lesson.sync_status === 'synced';

              return (
                <div key={lesson.id} className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Fila superior */}
                  <div className="flex-between">
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Proyecto: <strong style={{ color: 'var(--text-secondary)' }}>{project ? project.name : 'Cargando...'}</strong>
                    </span>
                    <span className={`badge ${isSynced ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>
                      {isSynced ? 'Sincronizado' : 'Pendiente Sincro'}
                    </span>
                  </div>

                  {/* Título de la Lección */}
                  <h2 style={{ fontSize: '1.35rem', color: 'var(--primary-light)' }}>
                    {lesson.title}
                  </h2>

                  {/* Descripción General */}
                  <p style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                    {lesson.description}
                  </p>

                  {/* Bloques de Aprendizaje Especiales */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginTop: '0.5rem' }}>
                    {/* Desafío */}
                    {lesson.challenges && (
                      <div style={{ background: 'rgba(239, 68, 68, 0.03)', border: '1px solid rgba(239, 68, 68, 0.15)', padding: '1rem', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#fca5a5', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                          <AlertTriangle size={16} /> Desafío Identificado
                        </div>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{lesson.challenges}</span>
                      </div>
                    )}

                    {/* Recomendación */}
                    {lesson.recommendations && (
                      <div style={{ background: 'rgba(16, 185, 129, 0.03)', border: '1px solid rgba(16, 185, 129, 0.15)', padding: '1rem', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#a7f3d0', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                          <Lightbulb size={16} /> Recomendación Metodológica
                        </div>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{lesson.recommendations}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* FORMULARIO CREACIÓN DE APRENDIZAJE */}
      {tab === 'create' && !isViewer && (
        <div className="glass-panel" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
          {submitSuccess ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 0', gap: '1rem' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--status-online)', padding: '1rem', borderRadius: '50%' }}>
                <BookOpen size={48} />
              </div>
              <h2>Lección Registrada</h2>
              <p style={{ textAlign: 'center' }}>Los aprendizajes fueron almacenados localmente en IndexedDB. Se sincronizarán al detectar conexión.</p>
            </div>
          ) : (
            <form onSubmit={handleSaveLesson} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BookOpen size={22} style={{ color: 'var(--primary-light)' }} /> Registrar Nueva Lección Aprendida
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
                <label>Título Breve de la Lección</label>
                <input 
                  type="text" 
                  placeholder="Ej. Sincronización estacional para distribución de semillas"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Descripción del Aprendizaje / Qué se aprendió</label>
                <textarea 
                  rows="3" 
                  placeholder="Describe la lección principal que el equipo consolidó..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Desafíos / Dificultades Encontradas</label>
                <textarea 
                  rows="2" 
                  placeholder="¿Qué problemas específicos gatillaron esta lección?"
                  value={challenges}
                  onChange={e => setChallenges(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Recomendación para futuras implementaciones</label>
                <textarea 
                  rows="2" 
                  placeholder="¿Cómo deberíamos operar la próxima vez para mitigar el desafío?"
                  value={recommendations}
                  onChange={e => setRecommendations(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setTab('list')} className="btn btn-secondary" style={{ flex: 1 }}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>
                  <Send size={16} /> Guardar Lección Aprendida Offline
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
