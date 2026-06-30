import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addWithSignature } from '../db';
import { updatePendingCount } from '../syncEngine';
import { BarChart3, Edit, Save, CheckCircle, Info, RefreshCw, X, AlertTriangle, ChevronDown, ChevronUp, Eye, Plus } from 'lucide-react';

export default function Indicators({ currentUser }) {
  const isViewer = currentUser?.role === 'viewer';
  const isAdmin = currentUser?.role === 'admin';

  // Cargar datos reactivos locales
  const projects = useLiveQuery(() => db.projects.toArray()) || [];
  const logframes = useLiveQuery(() => db.logframes.toArray()) || [];
  const indicators = useLiveQuery(() => db.indicators.toArray()) || [];

  // Filtros
  const [selectedProjectId, setSelectedProjectId] = useState('all');

  // Estados de edición e ingreso desagregado
  const [editingId, setEditingId] = useState(null);
  const [expandedDesgloseId, setExpandedDesgloseId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Campos de desagregación del formulario activo
  const [gMale, setGMale] = useState(0);
  const [gFemale, setGFemale] = useState(0);
  const [gOther, setGOther] = useState(0);

  const [aChildren, setAChildren] = useState(0);
  const [aYouth, setAYouth] = useState(0);
  const [aAdult, setAAdult] = useState(0);
  const [aElder, setAElder] = useState(0);

  const [eWayuu, setEWayuu] = useState(0);
  const [eAfro, setEAfro] = useState(0);
  const [eLocal, setELocal] = useState(0);

  const [lMayapo, setLMayapo] = useState(0);
  const [lElPajaro, setLElPajaro] = useState(0);

  const [formError, setFormError] = useState('');

  // Formulario nuevo indicador (Pilar 1 - Monitoreo)
  const [newIndProjectId, setNewIndProjectId] = useState('');
  const [newIndLogframeId, setNewIndLogframeId] = useState('');
  const [newIndCode, setNewIndCode] = useState('');
  const [newIndName, setNewIndName] = useState('');
  const [newIndUnit, setNewIndUnit] = useState('Participantes');
  const [newIndBaseline, setNewIndBaseline] = useState(0);
  const [newIndTarget, setNewIndTarget] = useState(10);
  const [newIndError, setNewIndError] = useState('');

  const filteredIndicators = selectedProjectId === 'all'
    ? indicators
    : indicators.filter(ind => ind.project_id === selectedProjectId);

  // Filtrar componentes del marco lógico según el proyecto del nuevo indicador
  const filteredLogframesForNewInd = newIndProjectId
    ? logframes.filter(lf => lf.project_id === newIndProjectId)
    : [];

  const handleStartEdit = (ind) => {
    if (isViewer) return;
    setEditingId(ind.id);
    setFormError('');

    const des = ind.disaggregated_data || {};
    setGMale(des.gender?.male || 0);
    setGFemale(des.gender?.female || 0);
    setGOther(des.gender?.other || 0);

    setAChildren(des.age?.children || 0);
    setAYouth(des.age?.youth || 0);
    setAAdult(des.age?.adult || 0);
    setAElder(des.age?.elder || 0);

    setEWayuu(des.ethnicity?.indigenous || 0);
    setEAfro(des.ethnicity?.afrodescendant || 0);
    setELocal(des.ethnicity?.local || 0);

    setLMayapo(des.location?.Mayapo || 0);
    setLElPajaro(des.location?.ElPajaro || 0);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormError('');
  };

  const calculatedTotal = gMale + gFemale + gOther;

  const handleSaveActual = async (indId) => {
    setFormError('');

    const sumAge = aChildren + aYouth + aAdult + aElder;
    const sumEthnicity = eWayuu + eAfro + eLocal;
    const sumLocation = lMayapo + lElPajaro;

    if (calculatedTotal > 0) {
      if (sumAge !== calculatedTotal) {
        setFormError(`Coherencia de Edad fallida: la suma (${sumAge}) debe ser igual al total del avance (${calculatedTotal}).`);
        return;
      }
      if (sumEthnicity !== calculatedTotal) {
        setFormError(`Coherencia Étnica fallida: la suma (${sumEthnicity}) debe ser igual al total del avance (${calculatedTotal}).`);
        return;
      }
      if (sumLocation !== calculatedTotal) {
        setFormError(`Coherencia Territorial fallida: la suma (${sumLocation}) debe ser igual al total del avance (${calculatedTotal}).`);
        return;
      }
    }

    const updatedData = {
      actual: calculatedTotal,
      disaggregated_data: {
        gender: { male: gMale, female: gFemale, other: gOther },
        age: { children: aChildren, youth: aYouth, adult: aAdult, elder: aElder },
        ethnicity: { indigenous: eWayuu, afrodescendant: eAfro, local: eLocal },
        location: { Mayapo: lMayapo, ElPajaro: lElPajaro }
      },
      updated_at: new Date().toISOString(),
      sync_status: 'pending_sync'
    };

    try {
      const currentRecord = await db.indicators.get(indId);
      if (currentRecord) {
        const merged = { ...currentRecord, ...updatedData };
        // Guardar actualizando firma (Pilar 3)
        await db.indicators.put(merged);
        // Actualizar firma del registro en IndexedDB
        const keys = Object.keys(merged).sort();
        const sorted = {};
        keys.forEach(k => { if (k !== 'signature' && k !== 'sync_status') sorted[k] = merged[k]; });
        const hash = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(sorted)));
        const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
        
        await db.indicators.update(indId, { ...updatedData, signature: hashHex });
        setEditingId(null);
        await updatePendingCount();
      }
    } catch (err) {
      console.error('Error actualizando avance:', err);
      setFormError('Error al guardar en base de datos local.');
    }
  };

  // Crear nuevo indicador (Pilar 1 - Monitoreo)
  const handleCreateIndicator = async (e) => {
    e.preventDefault();
    setNewIndError('');

    if (!newIndProjectId || !newIndLogframeId || !newIndCode || !newIndName) {
      setNewIndError('Todos los campos con asterisco son obligatorios.');
      return;
    }

    const newId = `ind-uuid-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const newIndicator = {
      id: newId,
      project_id: newIndProjectId,
      logframe_id: newIndLogframeId,
      code: newIndCode,
      name: newIndName,
      unit: newIndUnit,
      baseline: Number(newIndBaseline) || 0,
      target: Number(newIndTarget) || 0,
      actual: 0,
      disaggregated_data: {
        gender: { male: 0, female: 0, other: 0 },
        age: { children: 0, youth: 0, adult: 0, elder: 0 },
        ethnicity: { indigenous: 0, afrodescendant: 0, local: 0 },
        location: { Mayapo: 0, ElPajaro: 0 }
      },
      updated_at: now
    };

    try {
      // Guardar indicador con firma criptográfica SHA-256 (Pilar 3)
      await addWithSignature(db.indicators, newIndicator);
      
      setNewIndCode('');
      setNewIndName('');
      setNewIndUnit('Participantes');
      setNewIndBaseline(0);
      setNewIndTarget(10);
      setShowAddForm(false);
      await updatePendingCount();
    } catch (err) {
      console.error('Error creando indicador:', err);
      setNewIndError('Error al guardar el indicador localmente.');
    }
  };

  const toggleDesglose = (indId) => {
    setExpandedDesgloseId(expandedDesgloseId === indId ? null : indId);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Cabecera */}
      <div className="flex-between">
        <div>
          <h1>Indicadores de Monitoreo Territorial</h1>
          <p>Registra y supervisa los logros físicos con desglose multidimensional y alertas automáticas de estancamiento.</p>
        </div>

        {isAdmin ? (
          <button 
            onClick={() => setShowAddForm(!showAddForm)} 
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
          >
            <Plus size={16} /> Nuevo Indicador
          </button>
        ) : null}
      </div>

      {/* Formulario Agregar Indicador (Pilar 1) */}
      {showAddForm && isAdmin && (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h2 style={{ marginBottom: '1.25rem' }}>Definir Nuevo Indicador MEAL</h2>
          
          {newIndError && (
            <div style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 'bold', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.15)', marginBottom: '1rem' }}>
              {newIndError}
            </div>
          )}

          <form onSubmit={handleCreateIndicator} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <div className="form-group">
              <label>Proyecto MEAL *</label>
              <select 
                value={newIndProjectId} 
                onChange={(e) => {
                  setNewIndProjectId(e.target.value);
                  setNewIndLogframeId(''); // resetear nodo del marco lógico
                }}
                required
              >
                <option value="">-- Seleccionar Proyecto --</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Componente del Marco Lógico (Objetivo/Actividad) *</label>
              <select 
                value={newIndLogframeId} 
                onChange={(e) => setNewIndLogframeId(e.target.value)}
                required
                disabled={!newIndProjectId}
              >
                <option value="">-- Seleccionar Componente --</option>
                {filteredLogframesForNewInd.map(lf => (
                  <option key={lf.id} value={lf.id}>[{lf.code}] {lf.description.substring(0, 50)}...</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Código del Indicador *</label>
              <input 
                type="text" 
                placeholder="Ej: IND-1.2, IND-3.1" 
                value={newIndCode}
                onChange={e => setNewIndCode(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Unidad de Medida *</label>
              <input 
                type="text" 
                placeholder="Ej: Personas, Asociaciones, Talleres" 
                value={newIndUnit}
                onChange={e => setNewIndUnit(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Nombre / Formulación del Indicador *</label>
              <input 
                type="text" 
                placeholder="Ej: Número de tripulaciones capacitadas en primeros auxilios..." 
                value={newIndName}
                onChange={e => setNewIndName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Línea Base (Baseline)</label>
              <input 
                type="number" 
                min="0"
                value={newIndBaseline}
                onChange={e => setNewIndBaseline(parseInt(e.target.value) || 0)}
              />
            </div>

            <div className="form-group">
              <label>Meta Objetivo (Target) *</label>
              <input 
                type="number" 
                min="1"
                value={newIndTarget}
                onChange={e => setNewIndTarget(parseInt(e.target.value) || 1)}
                required
              />
            </div>

            <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button type="button" onClick={() => setShowAddForm(false)} className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}>
                Guardar Indicador
              </button>
            </div>
          </form>
        </div>
      )}

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

            // Detección de Estancamiento
            const lastUpdated = new Date(ind.updated_at).getTime();
            const nowTime = Date.now();
            const daysSinceUpdate = Math.floor((nowTime - lastUpdated) / (1000 * 60 * 60 * 24));
            const isEstancado = ind.actual < ind.target && daysSinceUpdate > 30;

            const rawPct = ind.target > 0 ? (ind.actual / ind.target) * 100 : 0;
            const pct = Math.round(rawPct);
            const barPct = rawPct > 100 ? 100 : rawPct;

            const varianzaVal = ind.target - ind.actual;
            const pctVarianza = Math.round((varianzaVal / ind.target) * 100);

            const isDesgloseOpen = expandedDesgloseId === ind.id;
            const des = ind.disaggregated_data || {};

            return (
              <div 
                key={ind.id} 
                className="glass-panel" 
                style={{ 
                  padding: '1.75rem', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '1.25rem',
                  borderLeft: isEditing 
                    ? '4px solid var(--primary-light)' 
                    : isEstancado 
                      ? '4px solid #ef4444' 
                      : '1px solid var(--border-glass)',
                  background: isEstancado ? 'rgba(239, 68, 68, 0.01)' : 'rgba(255,255,255,0.01)'
                }}
              >
                {/* Alerta de Estancamiento */}
                {isEstancado && (
                  <div 
                    style={{ 
                      background: 'rgba(239,68,68,0.1)', 
                      border: '1px solid rgba(239,68,68,0.2)',
                      padding: '0.65rem 1rem', 
                      borderRadius: '8px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.6rem',
                      color: '#fca5a5',
                      fontSize: '0.85rem',
                      fontWeight: 'bold'
                    }}
                  >
                    <AlertTriangle size={16} className="text-danger" style={{ color: '#ef4444' }} />
                    ALERTA MEAL: Indicador estancado en campo. No registra avances en los últimos {daysSinceUpdate} días.
                  </div>
                )}

                {/* Cabecera del Indicador */}
                <div className="flex-between" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxWidth: '75%' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Proyecto: {project ? project.name : 'Cargando...'}
                    </span>
                    <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span className="badge badge-info" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)' }}>{ind.code}</span>
                      {ind.name}
                    </h3>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span className={`badge ${isSynced ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>
                      {isSynced ? 'Sincronizado' : 'Pendiente Sincro'}
                    </span>
                    <span style={{ color: pct >= 100 ? '#10b981' : 'var(--primary-light)', fontSize: '1.25rem', fontWeight: 800 }}>{pct}%</span>
                  </div>
                </div>

                {/* Barra de progreso */}
                <div>
                  <div className="progress-bar-bg" style={{ height: '10px' }}>
                    <div 
                      className="progress-bar-fill" 
                      style={{ 
                        width: `${barPct}%`,
                        background: isEstancado ? '#ef4444' : 'linear-gradient(90deg, var(--primary-color) 0%, var(--primary-light) 100%)' 
                      }}
                    ></div>
                  </div>
                </div>

                {/* Métricas y Varianza */}
                <div className="flex-between" style={{ flexWrap: 'wrap', gap: '1rem', background: 'rgba(255,255,255,0.01)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.02)' }}>
                  <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                    <div>Línea Base: <strong style={{ color: 'var(--text-primary)' }}>{ind.baseline}</strong></div>
                    <div>Meta Física: <strong style={{ color: 'var(--text-primary)' }}>{ind.target} {ind.unit}</strong></div>
                    
                    <div style={{ borderLeft: '1px solid var(--border-glass)', paddingLeft: '1.5rem' }}>
                      Varianza: {' '}
                      <strong style={{ color: varianzaVal > 0 ? 'var(--secondary-light)' : '#10b981' }}>
                        {varianzaVal > 0 
                          ? `Faltan ${varianzaVal} ${ind.unit} (${pctVarianza}% restante)` 
                          : `Meta lograda (${Math.abs(varianzaVal)} de sobrecumplimiento)`}
                      </strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button
                      onClick={() => toggleDesglose(ind.id)}
                      className="btn btn-secondary"
                      style={{ padding: '0.35rem 0.65rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem' }}
                    >
                      <Eye size={12} /> {isDesgloseOpen ? 'Ocultar Desglose' : 'Ver Desglose'}
                      {isDesgloseOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>

                    {!isViewer && !isEditing && (
                      <button
                        onClick={() => handleStartEdit(ind)}
                        className="btn btn-primary"
                        style={{ padding: '0.35rem 0.65rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem' }}
                      >
                        <Edit size={12} /> Registrar Avance
                      </button>
                    )}
                  </div>
                </div>

                {/* PANEL DE DESGLOSE DEMOGRÁFICO/TERRITORIAL */}
                {isDesgloseOpen && (
                  <div 
                    className="glass-card" 
                    style={{ 
                      background: 'rgba(0,0,0,0.15)', 
                      padding: '1.25rem', 
                      borderRadius: '8px', 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                      gap: '1.25rem',
                      fontSize: '0.8rem',
                      border: '1px dashed var(--border-glass)'
                    }}
                  >
                    <div>
                      <strong style={{ color: 'var(--primary-light)', display: 'block', marginBottom: '0.5rem' }}>👥 Desglose de Género:</strong>
                      <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <li>• Hombres: <strong style={{ color: 'var(--text-primary)' }}>{des.gender?.male || 0}</strong></li>
                        <li>• Mujeres: <strong style={{ color: 'var(--text-primary)' }}>{des.gender?.female || 0}</strong></li>
                        <li>• Otro: <strong style={{ color: 'var(--text-primary)' }}>{des.gender?.other || 0}</strong></li>
                      </ul>
                    </div>
                    <div>
                      <strong style={{ color: 'var(--primary-light)', display: 'block', marginBottom: '0.5rem' }}>🎂 Rangos de Edad:</strong>
                      <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <li>• Niños / Menores: <strong style={{ color: 'var(--text-primary)' }}>{des.age?.children || 0}</strong></li>
                        <li>• Jóvenes: <strong style={{ color: 'var(--text-primary)' }}>{des.age?.youth || 0}</strong></li>
                        <li>• Adultos: <strong style={{ color: 'var(--text-primary)' }}>{des.age?.adult || 0}</strong></li>
                        <li>• Adultos Mayores: <strong style={{ color: 'var(--text-primary)' }}>{des.age?.elder || 0}</strong></li>
                      </ul>
                    </div>
                    <div>
                      <strong style={{ color: 'var(--primary-light)', display: 'block', marginBottom: '0.5rem' }}>✊ Pertinencia Étnica:</strong>
                      <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <li>• Indígena Wayuu: <strong style={{ color: 'var(--text-primary)' }}>{des.ethnicity?.indigenous || 0}</strong></li>
                        <li>• Afrodescendiente: <strong style={{ color: 'var(--text-primary)' }}>{des.ethnicity?.afrodescendant || 0}</strong></li>
                        <li>• Comunidad / Ninguno: <strong style={{ color: 'var(--text-primary)' }}>{des.ethnicity?.local || 0}</strong></li>
                      </ul>
                    </div>
                    <div>
                      <strong style={{ color: 'var(--primary-light)', display: 'block', marginBottom: '0.5rem' }}>📍 Distribución Territorial:</strong>
                      <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <li>• Mayapo: <strong style={{ color: 'var(--text-primary)' }}>{des.location?.Mayapo || 0}</strong></li>
                        <li>• El Pájaro: <strong style={{ color: 'var(--text-primary)' }}>{des.location?.ElPajaro || 0}</strong></li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* FORMULARIO AVANZADO DE INGRESO DESAGREGADO */}
                {isEditing && (
                  <div className="glass-card" style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <h4 style={{ color: 'var(--primary-light)', margin: 0, fontSize: '0.95rem' }}>Ingreso Multidimensional Desagregado</h4>
                    
                    {formError && (
                      <div style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 'bold', padding: '0.5rem', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                        {formError}
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem' }}>
                      {/* Grupo Género */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <strong style={{ fontSize: '0.8rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.25rem' }}>👥 Género (Suma = Avance)</strong>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                          <label>Hombres</label>
                          <input type="number" min="0" value={gMale} onChange={e => setGMale(parseInt(e.target.value) || 0)} style={{ width: '60px', padding: '0.2rem' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                          <label>Mujeres</label>
                          <input type="number" min="0" value={gFemale} onChange={e => setGFemale(parseInt(e.target.value) || 0)} style={{ width: '60px', padding: '0.2rem' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                          <label>Otro</label>
                          <input type="number" min="0" value={gOther} onChange={e => setGOther(parseInt(e.target.value) || 0)} style={{ width: '60px', padding: '0.2rem' }} />
                        </div>
                      </div>

                      {/* Grupo Edad */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <strong style={{ fontSize: '0.8rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.25rem' }}>🎂 Rangos de Edad</strong>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                          <label>Menores</label>
                          <input type="number" min="0" value={aChildren} onChange={e => setAChildren(parseInt(e.target.value) || 0)} style={{ width: '60px', padding: '0.2rem' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                          <label>Jóvenes</label>
                          <input type="number" min="0" value={aYouth} onChange={e => setAYouth(parseInt(e.target.value) || 0)} style={{ width: '60px', padding: '0.2rem' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                          <label>Adultos</label>
                          <input type="number" min="0" value={aAdult} onChange={e => setAAdult(parseInt(e.target.value) || 0)} style={{ width: '60px', padding: '0.2rem' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                          <label>Mayores</label>
                          <input type="number" min="0" value={aElder} onChange={e => setAElder(parseInt(e.target.value) || 0)} style={{ width: '60px', padding: '0.2rem' }} />
                        </div>
                      </div>

                      {/* Grupo Étnico */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <strong style={{ fontSize: '0.8rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.25rem' }}>✊ Pertinencia Étnica</strong>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                          <label>Wayuu</label>
                          <input type="number" min="0" value={eWayuu} onChange={e => setEWayuu(parseInt(e.target.value) || 0)} style={{ width: '60px', padding: '0.2rem' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                          <label>Afro</label>
                          <input type="number" min="0" value={eAfro} onChange={e => setEAfro(parseInt(e.target.value) || 0)} style={{ width: '60px', padding: '0.2rem' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                          <label>Ninguno</label>
                          <input type="number" min="0" value={eLocal} onChange={e => setELocal(parseInt(e.target.value) || 0)} style={{ width: '60px', padding: '0.2rem' }} />
                        </div>
                      </div>

                      {/* Grupo Ubicación */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <strong style={{ fontSize: '0.8rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.25rem' }}>📍 Ubicación</strong>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                          <label>Mayapo</label>
                          <input type="number" min="0" value={lMayapo} onChange={e => setLMayapo(parseInt(e.target.value) || 0)} style={{ width: '60px', padding: '0.2rem' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                          <label>El Pájaro</label>
                          <input type="number" min="0" value={lElPajaro} onChange={e => setLElPajaro(parseInt(e.target.value) || 0)} style={{ width: '60px', padding: '0.2rem' }} />
                        </div>
                      </div>

                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem', borderTop: '1px solid var(--border-glass)', paddingTop: '0.75rem' }}>
                      <div style={{ fontSize: '0.9rem' }}>
                        Logro Total Calculado: <strong style={{ color: 'var(--primary-light)', fontSize: '1rem' }}>{calculatedTotal}</strong> {ind.unit}
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                          onClick={() => handleSaveActual(ind.id)}
                          className="btn btn-primary"
                          style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                          <Save size={14} /> Guardar
                        </button>
                        <button 
                          onClick={handleCancelEdit}
                          className="btn btn-secondary"
                          style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
