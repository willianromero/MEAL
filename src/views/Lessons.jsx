import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addWithSignature, putWithSignature } from '../db';
import { updatePendingCount } from '../syncEngine';
import SignatureVerifier from '../components/SignatureVerifier';
import { BookOpen, AlertTriangle, Lightbulb, Plus, Send, Info, Eye, ClipboardCheck, Calendar, User, CheckCircle2 } from 'lucide-react';

export default function Lessons({ currentUser }) {
  const isViewer = currentUser?.role === 'viewer';
  const isAdmin = currentUser?.role === 'admin';

  // Cargar datos reactivos locales
  const projects = useLiveQuery(() => db.projects.toArray()) || [];
  const lessons = useLiveQuery(() => db.lessons_learned.toArray()) || [];

  // Vista activa: 'list' o 'create'
  const [tab, setTab] = useState('list');

  // Formulario de Nueva Lección
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [challenges, setChallenges] = useState('');
  const [recommendations, setRecommendations] = useState('');

  // Formulario de Plan de Acción Vinculado
  const [actionDescription, setActionDescription] = useState('');
  const [actionResponsible, setActionResponsible] = useState('');
  const [actionDeadline, setActionDeadline] = useState('');

  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [formError, setFormError] = useState('');

  const handleSaveLesson = async (e) => {
    e.preventDefault();
    setFormError('');
    if (isViewer) return;

    if (!projectId || !title || !description || !actionDescription || !actionResponsible || !actionDeadline) {
      setFormError('Error metodológico: Es obligatorio definir la lección y estructurar su correspondiente Plan de Acción de Mejora.');
      return;
    }

    const newId = `ll-uuid-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const newLesson = {
      id: newId,
      project_id: projectId,
      title,
      description,
      challenges,
      recommendations,
      action_plan: {
        description: actionDescription,
        responsible: actionResponsible,
        deadline: actionDeadline,
        status: 'pending'
      },
      created_at: now,
      updated_at: now,
      sync_status: 'pending_sync'
    };

    try {
      // Guardar con firmado criptográfico SHA-256 (Pilar 3)
      await addWithSignature(db.lessons_learned, newLesson);
      
      setProjectId('');
      setTitle('');
      setDescription('');
      setChallenges('');
      setRecommendations('');
      setActionDescription('');
      setActionResponsible('');
      setActionDeadline('');
      setSubmitSuccess(true);
      await updatePendingCount();

      setTimeout(() => {
        setSubmitSuccess(false);
        setTab('list');
      }, 2000);
    } catch (err) {
      console.error('Error guardando lección aprendida:', err);
      setFormError('Error al guardar la lección en la base de datos local.');
    }
  };

  const handleToggleActionStatus = async (lessonId, currentStatus) => {
    if (isViewer) return;

    const nextStatus = currentStatus === 'completed' ? 'pending' : 'completed';

    try {
      const lesson = await db.lessons_learned.get(lessonId);
      if (lesson && lesson.action_plan) {
        const updatedActionPlan = {
          ...lesson.action_plan,
          status: nextStatus
        };

        const updatedLesson = {
          ...lesson,
          action_plan: updatedActionPlan,
          updated_at: new Date().toISOString(),
          sync_status: 'pending_sync'
        };

        // Guardar actualizando firma (Pilar 3)
        await putWithSignature(db.lessons_learned, updatedLesson);
        await updatePendingCount();
      }
    } catch (err) {
      console.error('Error alternando estado del plan de acción:', err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Cabecera */}
      <div className="flex-between">
        <div>
          <h1>Lecciones Aprendidas (Learning)</h1>
          <p>Repositorio de conocimientos con planes de acción vinculados obligatoriamente para la mejora continua del proyecto.</p>
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

      {/* LISTADO DE LECCIONES */}
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
              const ap = lesson.action_plan || {};
              const isCompleted = ap.status === 'completed';

              return (
                <div key={lesson.id} className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  
                  {/* Fila superior de metadatos */}
                  <div className="flex-between">
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Proyecto: <strong style={{ color: 'var(--text-secondary)' }}>{project ? project.name : 'Cargando...'}</strong>
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {/* Validador Criptográfico de Integridad SHA-256 (Pilar 3) */}
                      <SignatureVerifier record={lesson} />
                      
                      <span className={`badge ${isSynced ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>
                        {isSynced ? 'Sincronizado' : 'Pendiente Sincro'}
                      </span>
                    </div>
                  </div>

                  {/* Título */}
                  <h2 style={{ fontSize: '1.3rem', color: 'var(--primary-light)', margin: 0 }}>
                    {lesson.title}
                  </h2>

                  {/* Descripción */}
                  <p style={{ fontSize: '0.95rem', color: 'var(--text-primary)', margin: 0 }}>
                    {lesson.description}
                  </p>

                  {/* Desafío y Recomendación */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                    {lesson.challenges && (
                      <div style={{ background: 'rgba(239, 68, 68, 0.02)', border: '1px solid rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#fca5a5', fontWeight: 'bold', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
                          <AlertTriangle size={15} /> Desafío Encontrado
                        </div>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{lesson.challenges}</span>
                      </div>
                    )}

                    {lesson.recommendations && (
                      <div style={{ background: 'rgba(16, 185, 129, 0.02)', border: '1px solid rgba(16, 185, 129, 0.1)', padding: '1rem', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#a7f3d0', fontWeight: 'bold', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
                          <Lightbulb size={15} /> Recomendación Metodológica
                        </div>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{lesson.recommendations}</span>
                      </div>
                    )}
                  </div>

                  {/* PLAN DE ACCIÓN VINCULADO */}
                  {ap.description && (
                    <div 
                      style={{ 
                        background: isCompleted ? 'rgba(16, 185, 129, 0.04)' : 'rgba(234, 179, 8, 0.03)', 
                        border: `1px solid ${isCompleted ? 'rgba(16, 185, 129, 0.15)' : 'rgba(234, 179, 8, 0.15)'}`, 
                        padding: '1.25rem', 
                        borderRadius: '8px', 
                        marginTop: '0.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem'
                      }}
                    >
                      <div className="flex-between" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: isCompleted ? '#a7f3d0' : '#fef08a', fontWeight: 'bold', fontSize: '0.85rem' }}>
                          <ClipboardCheck size={18} /> Plan de Acción de Mejora
                        </div>
                        
                        {/* Checkbox interactivo */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input 
                            type="checkbox"
                            id={`chkAp-${lesson.id}`}
                            checked={isCompleted}
                            onChange={() => handleToggleActionStatus(lesson.id, ap.status)}
                            disabled={isViewer}
                            style={{ width: '16px', height: '16px', cursor: isViewer ? 'not-allowed' : 'pointer' }}
                          />
                          <label htmlFor={`chkAp-${lesson.id}`} style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', cursor: isViewer ? 'not-allowed' : 'pointer', marginBottom: 0 }}>
                            {isCompleted ? 'Marcado como Completado' : 'Marcar como Completado'}
                          </label>
                        </div>
                      </div>

                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                        {ap.description}
                      </p>

                      <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <User size={12} /> Responsable: <strong style={{ color: 'var(--text-secondary)' }}>{ap.responsible}</strong>
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <Calendar size={12} /> Fecha Límite: <strong style={{ color: 'var(--text-secondary)' }}>{ap.deadline}</strong>
                        </span>
                      </div>
                    </div>
                  )}

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
                <CheckCircle2 size={48} />
              </div>
              <h2>Lección Registrada</h2>
              <p style={{ textAlign: 'center' }}>Los aprendizajes y el plan de acción fueron almacenados localmente en IndexedDB.</p>
            </div>
          ) : (
            <form onSubmit={handleSaveLesson} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BookOpen size={22} style={{ color: 'var(--primary-light)' }} /> Compartir Nuevo Aprendizaje
              </h2>

              {formError && (
                <div style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 'bold', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                  {formError}
                </div>
              )}

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
                <label>Título de la Lección</label>
                <input 
                  type="text" 
                  placeholder="Ej. Estandarización de costos logísticos locales"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Descripción del Aprendizaje / Qué se aprendió</label>
                <textarea 
                  rows="3" 
                  placeholder="Describe la lección principal..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Desafíos / Dificultades Encontradas (Opcional)</label>
                <textarea 
                  rows="2" 
                  placeholder="¿Qué problemas específicos originaron esta lección?"
                  value={challenges}
                  onChange={e => setChallenges(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Recomendación para futuros proyectos (Opcional)</label>
                <textarea 
                  rows="2" 
                  placeholder="¿Qué sugerimos hacer operativamente la próxima vez?"
                  value={recommendations}
                  onChange={e => setRecommendations(e.target.value)}
                />
              </div>

              {/* SECCIÓN PLAN DE ACCIÓN OBLIGATORIO */}
              <div 
                style={{ 
                  background: 'rgba(5, 150, 105, 0.02)', 
                  border: '1px dashed var(--primary-color)', 
                  padding: '1.5rem', 
                  borderRadius: '8px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '1rem',
                  marginTop: '0.5rem'
                }}
              >
                <h3 style={{ fontSize: '0.95rem', color: 'var(--primary-light)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <ClipboardCheck size={16} /> Plan de Acción de Mejora (Obligatorio)
                </h3>
                
                <div className="form-group">
                  <label>Acción Correctora de Mejora</label>
                  <textarea 
                    rows="2" 
                    placeholder="¿Qué acción concreta se va a ejecutar para aplicar la lección?"
                    value={actionDescription}
                    onChange={e => setActionDescription(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label>Responsable Asignado</label>
                    <input 
                      type="text" 
                      placeholder="Ej. Coordinador de Logística"
                      value={actionResponsible}
                      onChange={e => setActionResponsible(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Fecha Límite</label>
                    <input 
                      type="date"
                      value={actionDeadline}
                      onChange={e => setActionDeadline(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem' }}>
                <button type="button" onClick={() => setTab('list')} className="btn btn-secondary" style={{ flex: 1 }}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>
                  <Send size={16} /> Guardar Lección y Plan de Acción
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
