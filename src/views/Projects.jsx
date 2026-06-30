import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { updatePendingCount } from '../syncEngine';
import { Briefcase, Calendar, FolderPlus, Layers, Plus, ChevronRight, Info } from 'lucide-react';

export default function Projects({ currentUser }) {
  const isAdmin = currentUser?.role === 'admin';

  // Obtener datos reactivos locales
  const projects = useLiveQuery(() => db.projects.toArray()) || [];
  const logframes = useLiveQuery(() => db.logframes.toArray()) || [];
  const indicators = useLiveQuery(() => db.indicators.toArray()) || [];

  // Estados de vista
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Formulario nuevo proyecto
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const activeProject = projects.find(p => p.id === selectedProjectId) || projects[0];

  const handleAddProject = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!name || !startDate || !endDate) return;

    const newId = `proj-uuid-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const newProject = {
      id: newId,
      name,
      description,
      start_date: startDate,
      end_date: endDate,
      status: 'planning',
      updated_at: now
    };

    try {
      await db.projects.add(newProject);
      
      // Auto crear un resultado por defecto (LogFrame) para este proyecto
      const lfId = `lf-uuid-${Math.random().toString(36).substr(2, 9)}`;
      await db.logframes.add({
        id: lfId,
        project_id: newId,
        type: 'outcome',
        code: 'R-1',
        description: 'Resultado inicial del proyecto (editar en base de datos).',
        parent_id: null,
        updated_at: now
      });

      // Resetear formulario
      setName('');
      setDescription('');
      setStartDate('');
      setEndDate('');
      setShowAddForm(false);
      setSelectedProjectId(newId);
      await updatePendingCount();
    } catch (err) {
      console.error('Error guardando proyecto:', err);
    }
  };

  // Filtrar marco lógico del proyecto activo
  const projectLogframes = activeProject 
    ? logframes.filter(lf => lf.project_id === activeProject.id)
    : [];

  const outcomes = projectLogframes.filter(lf => lf.type === 'outcome');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Cabecera */}
      <div className="flex-between">
        <div>
          <h1>Proyectos y Marcos Lógicos</h1>
          <p>Define la estructura del proyecto y su matriz de resultados / actividades.</p>
        </div>
        
        {isAdmin ? (
          <button onClick={() => setShowAddForm(!showAddForm)} className="btn btn-primary">
            <FolderPlus size={18} />
            {showAddForm ? 'Cancelar' : 'Nuevo Proyecto'}
          </button>
        ) : (
          <div className="badge badge-info" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem' }}>
            <Info size={14} /> Solo Administradores pueden crear proyectos
          </div>
        )}
      </div>

      {/* Formulario Crear Proyecto (Visible solo si Admin y toggle activado) */}
      {showAddForm && isAdmin && (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h2 style={{ marginBottom: '1.25rem' }}>Agregar Nuevo Proyecto</h2>
          <form onSubmit={handleAddProject} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Nombre del Proyecto</label>
              <input 
                type="text" 
                placeholder="Ej. Reducción de la brecha digital rural" 
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>
            
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Descripción / Objetivo General</label>
              <textarea 
                rows="3" 
                placeholder="Escribe brevemente el fin último del proyecto..."
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Fecha de Inicio</label>
              <input 
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Fecha de Finalización</label>
              <input 
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                required
              />
            </div>

            <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
              <button type="button" onClick={() => setShowAddForm(false)} className="btn btn-secondary">
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary">
                Guardar Proyecto
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Grid Principal: Lista + LogFrame */}
      <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 2fr' }}>
        {/* Columna Izquierda: Lista de Proyectos */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3>Lista de Proyectos</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {projects.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No hay proyectos registrados localmente.
              </div>
            ) : (
              projects.map(proj => {
                const isSelected = activeProject?.id === proj.id;
                return (
                  <div
                    key={proj.id}
                    onClick={() => setSelectedProjectId(proj.id)}
                    className="glass-card"
                    style={{
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(5, 150, 105, 0.15)' : 'rgba(30, 41, 59, 0.2)',
                      borderColor: isSelected ? 'var(--primary-color)' : 'var(--border-glass)',
                      padding: '1.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxWidth: '85%' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '0.95rem', color: isSelected ? 'var(--primary-light)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {proj.name}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Calendar size={12} /> {proj.start_date} al {proj.end_date}
                      </span>
                    </div>
                    <ChevronRight size={18} color={isSelected ? 'var(--primary-color)' : 'var(--text-muted)'} />
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Columna Derecha: Detalles del Proyecto y LogFrame */}
        {activeProject ? (
          <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Detalles del proyecto */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                  {activeProject.status === 'active' ? 'Activo' : activeProject.status === 'planning' ? 'Planificación' : 'Completado'}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ID: {activeProject.id}</span>
              </div>
              <h2>{activeProject.name}</h2>
              <p style={{ fontSize: '0.95rem' }}>{activeProject.description}</p>
            </div>

            <hr style={{ border: 0, borderTop: '1px solid var(--border-glass)' }} />

            {/* Matriz del Marco Lógico (LogFrame) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={20} className="text-primary" style={{ color: 'var(--primary-light)' }} />
                <h3>Estructura del Marco Lógico (LogFrame)</h3>
              </div>

              {outcomes.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                  Este proyecto no posee una matriz de marco lógico cargada.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {outcomes.map(out => {
                    // Obtener actividades del resultado
                    const activities = projectLogframes.filter(lf => lf.type === 'activity' && lf.parent_id === out.id);
                    
                    // Obtener indicadores asociados a este resultado
                    const outcomeIndicators = indicators.filter(ind => ind.logframe_id === out.id);

                    return (
                      <div key={out.id} className="glass-card" style={{ background: 'rgba(15, 23, 42, 0.4)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {/* Resultado (Outcome) */}
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <span className="badge badge-info" style={{ alignSelf: 'flex-start', padding: '0.15rem 0.5rem' }}>{out.code}</span>
                          <div>
                            <strong style={{ color: 'var(--text-primary)' }}>Resultado: </strong>
                            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{out.description}</span>
                          </div>
                        </div>

                        {/* Indicadores del Resultado */}
                        {outcomeIndicators.length > 0 && (
                          <div style={{ marginLeft: '1.5rem', background: 'rgba(5, 150, 105, 0.05)', padding: '0.75rem', borderRadius: '8px', borderLeft: '3px solid var(--primary-color)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--primary-light)' }}>Indicadores de Resultado:</div>
                            {outcomeIndicators.map(ind => (
                              <div key={ind.id} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                • <strong>{ind.code}</strong>: {ind.name} (Meta: {ind.target} {ind.unit} / Logro: {ind.actual} {ind.unit})
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Actividades Hijas (Activities) */}
                        {activities.length > 0 && (
                          <div style={{ marginLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Actividades Habilitadoras:</div>
                            
                            {activities.map(act => {
                              // Indicadores asociados a la actividad
                              const actIndicators = indicators.filter(ind => ind.logframe_id === act.id);

                              return (
                                <div key={act.id} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <span className="badge" style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-primary)', padding: '0.1rem 0.4rem', fontSize: '0.7rem' }}>{act.code}</span>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{act.description}</span>
                                  </div>
                                  
                                  {actIndicators.map(ind => (
                                    <div key={ind.id} style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '1rem', borderLeft: '2px dashed var(--border-glass)', paddingLeft: '0.5rem' }}>
                                      Indicador {ind.code}: {ind.name} (Meta: {ind.target} {ind.unit} / Logrado: {ind.actual})
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Selecciona un proyecto para inspeccionar su marco lógico.
          </div>
        )}
      </div>
    </div>
  );
}
