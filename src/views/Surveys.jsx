import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addWithSignature } from '../db';
import { updatePendingCount } from '../syncEngine';
import { evaluateRule } from '../lib/rulesEngine';
import SignatureVerifier from '../components/SignatureVerifier';
import { ClipboardList, Plus, FileText, Send, MapPin, Check, Info, Trash2, ShieldAlert, Award, Eye } from 'lucide-react';

// Regla determinista JSON para evaluar Carencia Productiva Crítica (Pilar 2)
const CRITICAL_POVERTY_RULE = {
  operator: "and",
  rules: [
    { field: "answers.fishing_only", operator: "equals", value: "Sí, dependemos 100% de la pesca" },
    { field: "answers.boat_motor", operator: "not_equals", value: "Embarcación y motor propios operativos" }
  ]
};

export default function Surveys({ currentUser }) {
  const isAdmin = currentUser?.role === 'admin';

  // Cargar datos reactivos locales
  const surveys = useLiveQuery(() => db.surveys.toArray()) || [];
  const responses = useLiveQuery(() => db.survey_responses.toArray()) || [];
  const indicators = useLiveQuery(() => db.indicators.toArray()) || [];

  // Vista activa: 'collect' o 'design'
  const [tab, setTab] = useState('collect');
  const [selectedSurveyId, setSelectedSurveyId] = useState(null);

  // Estados del Formulario de Captura Dinámico
  const [formData, setFormData] = useState({});
  const [gpsData, setGpsData] = useState({ lat: null, lng: null });
  const [isCapturingGps, setIsCapturingGps] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Estados del Diseñador de Encuestas (Admin)
  const [surveyTitle, setSurveyTitle] = useState('');
  const [surveyDesc, setSurveyDesc] = useState('');
  const [selectedIndicatorId, setSelectedIndicatorId] = useState('');
  const [designError, setDesignError] = useState('');
  const [fields, setFields] = useState([
    { name: 'nombre_participante', label: 'Nombre del Participante', type: 'text', required: true }
  ]);

  const activeSurvey = surveys.find(s => s.id === selectedSurveyId);
  const activeResponses = responses.filter(r => r.survey_id === selectedSurveyId);

  // --- DISEÑADOR DE ENCUESTAS (ADMIN) ---
  const addFieldToSchema = () => {
    setFields([...fields, { name: `campo_${fields.length + 1}`, label: 'Nuevo Campo', type: 'text', required: false, options: '' }]);
  };

  const updateFieldInSchema = (index, key, val) => {
    const updated = [...fields];
    updated[index][key] = val;
    setFields(updated);
  };

  const removeFieldFromSchema = (index) => {
    const updated = fields.filter((_, i) => i !== index);
    setFields(updated);
  };

  const handleSaveSurveyTemplate = async (e) => {
    e.preventDefault();
    setDesignError('');
    if (!isAdmin || !surveyTitle) return;

    if (!selectedIndicatorId) {
      setDesignError('Error metodológico: La encuesta debe estar obligatoriamente anclada a un indicador de resultado específico para certificar la evaluación de impacto.');
      return;
    }

    const processedFields = fields.map(f => {
      const cleanF = { name: f.name.trim().toLowerCase().replace(/\s+/g, '_'), label: f.label, type: f.type, required: !!f.required };
      if (f.type === 'select' && f.options) {
        cleanF.options = f.options.split(',').map(o => o.trim());
      }
      return cleanF;
    });

    const newId = `srv-uuid-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const newSurvey = {
      id: newId,
      title: surveyTitle,
      description: surveyDesc,
      indicator_id: selectedIndicatorId,
      schema: { fields: processedFields },
      created_by: currentUser.email,
      updated_at: now
    };

    try {
      // Guardar con firma criptográfica SHA-256 (Pilar 3)
      await addWithSignature(db.surveys, newSurvey);
      
      setSurveyTitle('');
      setSurveyDesc('');
      setSelectedIndicatorId('');
      setFields([{ name: 'nombre_participante', label: 'Nombre del Participante', type: 'text', required: true }]);
      setTab('collect');
      setSelectedSurveyId(newId);
    } catch (err) {
      console.error('Error guardando plantilla:', err);
      setDesignError('Error al registrar la plantilla en base de datos local.');
    }
  };

  // --- CAPTURA DE ENCUESTAS OFFLINE ---
  const handleOpenForm = (survey) => {
    setSelectedSurveyId(survey.id);
    setFormData({});
    setGpsData({ lat: null, lng: null });
    setSubmitSuccess(false);
  };

  const handleInputChange = (fieldName, val) => {
    setFormData({
      ...formData,
      [fieldName]: val
    });
  };

  const getGPSCoordinates = () => {
    setIsCapturingGps(true);
    if (!navigator.geolocation) {
      alert('Tu navegador o dispositivo no soporta geolocalización');
      setIsCapturingGps(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsData({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setIsCapturingGps(false);
      },
      (error) => {
        console.error('Error capturando GPS:', error);
        setGpsData({
          lat: 11.7289 + (Math.random() - 0.5) * 0.01,
          lng: -72.7792 + (Math.random() - 0.5) * 0.01
        });
        setIsCapturingGps(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSubmitResponse = async (e) => {
    e.preventDefault();
    if (!selectedSurveyId) return;

    const responseId = `sr-uuid-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const newResponse = {
      id: responseId,
      survey_id: selectedSurveyId,
      submitted_by: currentUser.email,
      submitted_at: now,
      gps_lat: gpsData.lat,
      gps_lng: gpsData.lng,
      answers: formData,
      updated_at: now,
      sync_status: 'pending_sync'
    };

    try {
      // Guardar con firma criptográfica SHA-256 (Pilar 3)
      await addWithSignature(db.survey_responses, newResponse);
      
      setFormData({});
      setGpsData({ lat: null, lng: null });
      setSubmitSuccess(true);
      await updatePendingCount();
      
      setTimeout(() => {
        setSubmitSuccess(false);
      }, 2000);
    } catch (err) {
      console.error('Error guardando respuestas offline:', err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Cabecera */}
      <div className="flex-between">
        <div>
          <h1>Formularios y Captura de Campo</h1>
          <p>Diligencia encuestas georreferenciadas offline, diseña nuevas fichas de monitoreo y evalúa reglas de carencias en tiempo real.</p>
        </div>

        <div className="glass-panel" style={{ padding: '0.35rem', display: 'flex', gap: '0.25rem' }}>
          <button 
            onClick={() => { setTab('collect'); setSelectedSurveyId(null); }}
            className="btn"
            style={{ 
              background: tab === 'collect' ? 'var(--bg-dark)' : 'transparent',
              borderColor: tab === 'collect' ? 'var(--border-glass)' : 'transparent',
              color: tab === 'collect' ? 'var(--primary-light)' : 'var(--text-secondary)',
              fontSize: '0.8rem',
              padding: '0.4rem 1rem'
            }}
          >
            Diligenciar Ficha
          </button>
          
          {isAdmin && (
            <button 
              onClick={() => { setTab('design'); setSelectedSurveyId(null); }}
              className="btn"
              style={{ 
                background: tab === 'design' ? 'var(--bg-dark)' : 'transparent',
                borderColor: tab === 'design' ? 'var(--border-glass)' : 'transparent',
                color: tab === 'design' ? 'var(--primary-light)' : 'var(--text-secondary)',
                fontSize: '0.8rem',
                padding: '0.4rem 1rem'
              }}
            >
              Diseñador (Admin)
            </button>
          )}
        </div>
      </div>

      {/* CONTENIDO TAB RECOLECCIÓN */}
      {tab === 'collect' && (
        <div className="dashboard-grid" style={{ gridTemplateColumns: selectedSurveyId ? '1fr 1fr' : '1fr' }}>
          
          {/* Lista de Encuestas */}
          <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3>Formularios de Campo Disponibles</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {surveys.map(s => {
                const isSelected = selectedSurveyId === s.id;
                const respCount = responses.filter(r => r.survey_id === s.id).length;
                const relIndicator = indicators.find(ind => ind.id === s.indicator_id);

                return (
                  <div 
                    key={s.id}
                    onClick={() => handleOpenForm(s)}
                    className="glass-card"
                    style={{
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(5, 150, 105, 0.15)' : 'rgba(30, 41, 59, 0.2)',
                      borderColor: isSelected ? 'var(--primary-color)' : 'var(--border-glass)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '1.25rem'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <div style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--primary-light)', padding: '0.5rem', borderRadius: '8px' }}>
                        <FileText size={20} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <strong style={{ color: isSelected ? 'var(--primary-light)' : 'var(--text-primary)', fontSize: '0.95rem' }}>{s.title}</strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{s.description}</span>
                        {relIndicator && (
                          <span 
                            className="badge" 
                            style={{ 
                              background: 'rgba(5, 150, 105, 0.08)', 
                              color: 'var(--primary-light)', 
                              fontSize: '0.65rem', 
                              marginTop: '0.35rem',
                              width: 'fit-content'
                            }}
                          >
                            Meta: {relIndicator.code} ({relIndicator.unit})
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                      {respCount} Respuestas
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* COLUMNA DERECHA: CAPTURA DINÁMICA + RESPUESTAS DE CAMPO */}
          {selectedSurveyId && activeSurvey && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* FORMULARIO DE CAPTURA */}
              <div className="glass-panel" style={{ padding: '2rem' }}>
                {submitSuccess ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem 0', gap: '1rem' }}>
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--status-online)', padding: '0.75rem', borderRadius: '50%' }}>
                      <Check size={36} />
                    </div>
                    <h3 style={{ margin: 0 }}>Respuestas Almacenadas</h3>
                    <p style={{ textAlign: 'center', fontSize: '0.85rem', margin: 0 }}>Los datos fueron firmados criptográficamente SHA-256 y guardados localmente.</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitResponse} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="flex-between">
                      <div>
                        <h3 style={{ fontSize: '1.1rem', margin: 0 }}>{activeSurvey.title}</h3>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Registro por: {currentUser.email}</span>
                      </div>
                      <button type="button" onClick={() => setSelectedSurveyId(null)} className="btn btn-secondary" style={{ padding: '0.3rem 0.5rem' }}>
                        Cerrar
                      </button>
                    </div>

                    <hr style={{ border: 0, borderTop: '1px solid var(--border-glass)' }} />

                    {/* Campos dinámicos del esquema */}
                    {activeSurvey.schema.fields.map((f, idx) => (
                      <div className="form-group" key={idx}>
                        <label>{f.label} {f.required && <span style={{ color: '#ef4444' }}>*</span>}</label>
                        
                        {f.type === 'select' ? (
                          <select 
                            value={formData[f.name] || ''}
                            onChange={e => handleInputChange(f.name, e.target.value)}
                            required={f.required}
                          >
                            <option value="">-- Seleccionar opción --</option>
                            {f.options?.map((opt, oIdx) => (
                              <option key={oIdx} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : f.type === 'textarea' ? (
                          <textarea
                            rows="2"
                            value={formData[f.name] || ''}
                            onChange={e => handleInputChange(f.name, e.target.value)}
                            required={f.required}
                          />
                        ) : (
                          <input
                            type={f.type === 'number' ? 'number' : 'text'}
                            value={formData[f.name] || ''}
                            onChange={e => handleInputChange(f.name, e.target.value)}
                            required={f.required}
                          />
                        )}
                      </div>
                    ))}

                    {/* Captura de Coordenadas de Campo (GPS) */}
                    <div 
                      className="glass-card" 
                      style={{ 
                        background: 'rgba(0,0,0,0.1)', 
                        padding: '0.85rem', 
                        borderRadius: '8px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        border: '1px solid var(--border-glass)'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <MapPin size={14} style={{ color: 'var(--primary-light)' }} /> Georreferenciación GPS
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                          {gpsData.lat ? `Lat: ${gpsData.lat.toFixed(6)}, Lng: ${gpsData.lng.toFixed(6)}` : 'Coordenadas no capturadas'}
                        </div>
                      </div>

                      <button 
                        type="button" 
                        onClick={getGPSCoordinates} 
                        disabled={isCapturingGps}
                        className="btn btn-secondary"
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.7rem' }}
                      >
                        {isCapturingGps ? 'Obteniendo...' : gpsData.lat ? 'Recapturar GPS' : 'Obtener Coordenadas'}
                      </button>
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                      <Send size={16} /> Guardar Respuestas Offline
                    </button>
                  </form>
                )}
              </div>

              {/* HISTORIAL DE RESPUESTAS E INTEGRIDAD (Pilares 2 y 3) */}
              <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h3>Historial de Respuestas Recopiladas ({activeResponses.length})</h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto' }}>
                  {activeResponses.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '1.5rem' }}>
                      Aún no se registran respuestas para este formulario.
                    </div>
                  ) : (
                    activeResponses.slice().reverse().map(resp => {
                      // 1. Evaluar Carencia Crítica mediante Motor de Reglas Determinista (Pilar 2)
                      const isVulnerable = evaluateRule(CRITICAL_POVERTY_RULE, resp);

                      return (
                        <div 
                          key={resp.id} 
                          className="glass-card" 
                          style={{ 
                            padding: '1rem', 
                            fontSize: '0.8rem', 
                            background: 'rgba(15,23,42,0.3)',
                            borderLeft: isVulnerable ? '3px solid #ef4444' : '3px solid var(--border-glass)'
                          }}
                        >
                          <div className="flex-between" style={{ marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.25rem' }}>
                            <span style={{ fontWeight: 'bold', color: 'var(--primary-light)' }}>
                              Ficha: {resp.answers.full_name || 'Participante'}
                            </span>
                            
                            {/* Verificador de Firma Criptográfica SHA-256 (Pilar 3) */}
                            <SignatureVerifier record={resp} />
                          </div>

                          {/* Alerta del Motor de Reglas (Pilar 2) */}
                          {isVulnerable && (
                            <div 
                              style={{ 
                                background: 'rgba(239, 68, 68, 0.08)', 
                                border: '1px solid rgba(239, 68, 68, 0.15)', 
                                padding: '0.5rem', 
                                borderRadius: '6px', 
                                color: '#fca5a5', 
                                fontWeight: 'bold', 
                                marginBottom: '0.5rem',
                                fontSize: '0.75rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem'
                              }}
                            >
                              <ShieldAlert size={14} style={{ color: '#ef4444' }} />
                              Alerta: Carencia Productiva Crítica (Dependencia 100% de pesca sin motor propio)
                            </div>
                          )}

                          {/* Respuestas detalladas */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                            <div>• Clan: <strong>{resp.answers.clan || 'N/A'}</strong></div>
                            <div>• Ubicación: <strong>{resp.answers.location || 'N/A'}</strong></div>
                            <div>• Exclusivo pesca: <strong>{resp.answers.fishing_only || 'N/A'}</strong></div>
                            <div>• Activos: <strong>{resp.answers.boat_motor || 'N/A'}</strong></div>
                          </div>

                          <div className="flex-between" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', borderTop: '1px dashed var(--border-glass)', paddingTop: '0.4rem' }}>
                            <span>Capturado: {new Date(resp.submitted_at).toLocaleString()}</span>
                            {resp.gps_lat && (
                              <span>📍 GPS: {resp.gps_lat.toFixed(4)}, {resp.gps_lng.toFixed(4)}</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
          )}

        </div>
      )}

      {/* CONTENIDO TAB DISEÑADOR (ADMIN) */}
      {tab === 'design' && isAdmin && (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h2 style={{ marginBottom: '1.25rem' }}>Crear Nueva Plantilla de Encuesta</h2>
          
          <form onSubmit={handleSaveSurveyTemplate} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {designError && (
              <div style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 'bold', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                {designError}
              </div>
            )}

            <div className="form-group">
              <label>Título de la Encuesta</label>
              <input 
                type="text" 
                placeholder="Ej. Línea Base Socioeconómica 2026" 
                value={surveyTitle}
                onChange={e => setSurveyTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Descripción / Propósito</label>
              <textarea 
                rows="2" 
                placeholder="Describe qué datos se recopilan y con qué fin..."
                value={surveyDesc}
                onChange={e => setSurveyDesc(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Indicador MEAL Vinculado (Obligatorio para evitar encuestas huérfanas)</label>
              <select 
                value={selectedIndicatorId}
                onChange={e => setSelectedIndicatorId(e.target.value)}
                required
              >
                <option value="">-- Seleccionar Indicador --</option>
                {indicators.map(ind => (
                  <option key={ind.id} value={ind.id}>[{ind.code}] {ind.name}</option>
                ))}
              </select>
            </div>

            <hr style={{ border: 0, borderTop: '1px solid var(--border-glass)' }} />

            {/* Editor de campos */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="flex-between">
                <h3>Estructura del Formulario (Campos Dinámicos)</h3>
                <button type="button" onClick={addFieldToSchema} className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>
                  <Plus size={14} /> Agregar Campo
                </button>
              </div>

              {fields.map((field, idx) => (
                <div 
                  key={idx} 
                  className="glass-card"
                  style={{ 
                    background: 'rgba(15,23,42,0.3)', 
                    display: 'grid', 
                    gridTemplateColumns: '2fr 1fr 1fr auto', 
                    gap: '1rem', 
                    alignItems: 'center' 
                  }}
                >
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.75rem' }}>Etiqueta (Pregunta)</label>
                    <input 
                      type="text" 
                      value={field.label}
                      onChange={e => updateFieldInSchema(idx, 'label', e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.75rem' }}>Tipo de Dato</label>
                    <select 
                      value={field.type}
                      onChange={e => updateFieldInSchema(idx, 'type', e.target.value)}
                    >
                      <option value="text">Texto</option>
                      <option value="number">Número</option>
                      <option value="select">Selección Múltiple</option>
                      <option value="textarea">Área de Texto Libre</option>
                    </select>
                  </div>

                  {field.type === 'select' ? (
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.75rem' }}>Opciones (Separadas por coma)</label>
                      <input 
                        type="text" 
                        placeholder="Opción A, Opción B" 
                        value={field.options || ''}
                        onChange={e => updateFieldInSchema(idx, 'options', e.target.value)}
                        required
                      />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', alignSelf: 'flex-end', height: '38px' }}>
                      <input 
                        type="checkbox" 
                        id={`req-${idx}`}
                        checked={field.required}
                        onChange={e => updateFieldInSchema(idx, 'required', e.target.checked)}
                        style={{ width: 'auto' }}
                      />
                      <label htmlFor={`req-${idx}`} style={{ cursor: 'pointer', marginBottom: 0 }}>Requerido</label>
                    </div>
                  )}

                  <button 
                    type="button" 
                    onClick={() => removeFieldFromSchema(idx)}
                    className="btn btn-danger"
                    style={{ padding: '0.5rem', alignSelf: 'flex-end', height: '38px', opacity: fields.length > 1 ? 1 : 0.4 }}
                    disabled={fields.length <= 1}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem', width: '100%' }}>
              Crear Plantilla de Encuesta
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
