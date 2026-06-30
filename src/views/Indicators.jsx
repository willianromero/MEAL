import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { updatePendingCount } from '../syncEngine';
import { BarChart3, Edit, Save, CheckCircle, Info, RefreshCw, X } from 'lucide-react';

export default function Indicators({ currentUser }) {
  const isViewer = currentUser?.role === 'viewer';

  // Cargar datos reactivos locales
  const projects = useLiveQuery(() => db.projects.toArray()) || [];
  const indicators = useLiveQuery(() => db.indicators.toArray()) || [];

  // Filtros
  const [selectedProjectId, setSelectedProjectId] = useState('all');

  // Estados de edición del indicador
  const [editingId, setEditingId] = useState(null);
  const [newActualVal, setNewActualVal] = useState('');

  const filteredIndicators = selectedProjectId === 'all'
    ? indicators
    : indicators.filter(ind => ind.project_id === selectedProjectId);

  const handleStartEdit = (ind) => {
    if (isViewer) return;
    setEditingId(ind.id);
    setNewActualVal(ind.actual.toString());
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setNewActualVal('');
  };

  const handleSaveActual = async (indId) => {
    const val = parseFloat(newActualVal);
    if (isNaN(val)) return;

    try {
      // Actualizar localmente en Dexie
      await db.indicators.update(indId, {
        actual: val,
        updated_at: new Date().toISOString(),
        sync_status: 'pending_sync' // Marcar para subir
      });

      setEditingId(null);
      setNewActualVal('');
      await updatePendingCount(); // Avisar del cambio al SyncEngine
    } catch (err) {
      console.error('Error actualizando avance:', err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Cabecera */}
      <div>
        <h1>Indicadores de Monitoreo</h1>
        <p>Registra y supervisa los logros y metas físicas de los proyectos directamente en campo.</p>
      </div>

      {/* Barra de Filtros */}
      <div className="glass-panel" style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>Filtrar por Proyecto:</label>
          <select 
            value={selectedProjectId} 
            onChange={(e) => setSelectedProjectId(e.target.value)}
            style={{ width: 'auto', padding: '0.4rem 1.5rem 0.4rem 1rem' }}
          >
            <option value="all">Ver Todos los Proyectos</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {isViewer && (
          <div className="badge badge-info" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Info size={14} /> Modo Lectura: No puedes editar valores logrados.
          </div>
        )}
      </div>

      {/* Lista de Indicadores */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {filteredIndicators.length === 0 ? (
          <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No se encontraron indicadores correspondientes al filtro seleccionado.
          </div>
        ) : (
          filteredIndicators.map(ind => {
            const project = projects.find(p => p.id === ind.project_id);
            const isEditing = editingId === ind.id;
            const isSynced = ind.sync_status !== 'pending_sync';

            // Porcentaje de avance
            const rawPct = ind.target > 0 ? (ind.actual / ind.target) * 100 : 0;
            const pct = Math.round(rawPct);
            const barPct = rawPct > 100 ? 100 : rawPct; // cap al 100% para la barra visual

            return (
              <div 
                key={ind.id} 
                className="glass-panel" 
                style={{ 
                  padding: '1.5rem', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '1rem',
                  borderLeft: isEditing ? '4px solid var(--primary-light)' : '1px solid var(--border-glass)'
                }}
              >
                {/* Cabecera de la Tarjeta del Indicador */}
                <div className="flex-between" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxWidth: '75%' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Proyecto: {project ? project.name : 'Cargando...'}
                    </span>
                    <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="badge badge-info" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)' }}>{ind.code}</span>
                      {ind.name}
                    </h3>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span className={`badge ${isSynced ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>
                      {isSynced ? 'Sincronizado' : 'Pendiente Sincro'}
                    </span>
                    <span style={{ color: 'var(--primary-light)', fontSize: '1.25rem', fontWeight: 800 }}>{pct}%</span>
                  </div>
                </div>

                {/* Barra de progreso visual */}
                <div>
                  <div className="progress-bar-bg" style={{ height: '12px' }}>
                    <div className="progress-bar-fill" style={{ width: `${barPct}%` }}></div>
                  </div>
                </div>

                {/* Datos numéricos y Formulario de Edición */}
                <div className="flex-between" style={{ flexWrap: 'wrap', gap: '1rem', background: 'rgba(255,255,255,0.01)', padding: '0.75rem', borderRadius: '8px' }}>
                  {/* Valores base */}
                  <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <div>Línea Base: <strong style={{ color: 'var(--text-primary)' }}>{ind.baseline}</strong></div>
                    <div>Meta Física: <strong style={{ color: 'var(--text-primary)' }}>{ind.target} {ind.unit}</strong></div>
                  </div>

                  {/* Valor Actual y control de edición */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {isEditing ? (
                      /* Formulario de Edición Activo */
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Logro Actual:</label>
                        <input
                          type="number"
                          step="any"
                          value={newActualVal}
                          onChange={(e) => setNewActualVal(e.target.value)}
                          style={{ width: '90px', padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                          autoFocus
                        />
                        <button 
                          onClick={() => handleSaveActual(ind.id)}
                          className="btn btn-primary"
                          style={{ padding: '0.25rem 0.5rem', borderRadius: '4px' }}
                          title="Guardar localmente"
                        >
                          <Save size={14} />
                        </button>
                        <button 
                          onClick={handleCancelEdit}
                          className="btn btn-secondary"
                          style={{ padding: '0.25rem 0.5rem', borderRadius: '4px' }}
                          title="Cancelar"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      /* Vista del Valor Actual */
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '0.9rem' }}>
                          Logrado: <strong style={{ color: 'var(--text-primary)', fontSize: '1.1rem' }}>{ind.actual}</strong> {ind.unit}
                        </span>
                        
                        {!isViewer && (
                          <button
                            onClick={() => handleStartEdit(ind)}
                            className="btn btn-secondary"
                            style={{ padding: '0.3rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}
                          >
                            <Edit size={12} /> Registrar Avance
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
