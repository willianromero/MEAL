import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { updatePendingCount } from '../syncEngine';
import { ClipboardList, Plus, FileText, Send, MapPin, Check, Info, Trash2 } from 'lucide-react';

export default function Surveys({ currentUser }) {
  const isAdmin = currentUser?.role === 'admin';

  // Cargar datos reactivos locales
  const surveys = useLiveQuery(() => db.surveys.toArray()) || [];
  const responses = useLiveQuery(() => db.survey_responses.toArray()) || [];

  // Vista activa: 'collect' (llenar encuestas) o 'design' (diseñar plantillas)
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
  const [fields, setFields] = useState([
    { name: 'nombre_participante', label: 'Nombre del Participante', type: 'text', required: true }
  ]);

  const activeSurvey = surveys.find(s => s.id === selectedSurveyId);

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
    if (!isAdmin || !surveyTitle) return;

    // Procesar campos select que tengan opciones
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
      schema: { fields: processedFields },
      created_by: currentUser.email,
      updated_at: now
    };

    try {
      await db.surveys.add(newSurvey);
      setSurveyTitle('');
      setSurveyDesc('');
      setFields([{ name: 'nombre_participante', label: 'Nombre del Participante', type: 'text', required: true }]);
      setTab('collect');
      setSelectedSurveyId(newId);
    } catch (err) {
      console.error('Error guardando plantilla:', err);
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

  const handleGetLocation = () => {
    setIsCapturingGps(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGpsData({
            lat: parseFloat(position.coords.latitude.toFixed(6)),
            lng: parseFloat(position.coords.longitude.toFixed(6))
          });
          setIsCapturingGps(false);
        },
        (error) => {
          console.warn('Geolocalización denegada o no disponible, simulando coordenadas en terreno...');
          simulateGps();
        },
        { timeout: 8000 }
      );
    } else {
      simulateGps();
    }
  };

  const simulateGps = () => {
    // Simular ubicación en alguna zona de intervención de ejemplo
    const randomLat = (13.6929 + (Math.random() - 0.5) * 0.1).toFixed(6);
    const randomLng = (-89.2182 + (Math.random() - 0.5) * 0.1).toFixed(6);
    setGpsData({
      lat: parseFloat(randomLat),
      lng: parseFloat(randomLng)
    });
    setIsCapturingGps(false);
  };

  const handleSubmitResponse = async (e) => {
    e.preventDefault();
    if (!activeSurvey) return;

    const newResponseId = `resp-uuid-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const newResponse = {
      id: newResponseId,
      survey_id: activeSurvey.id,
      submitted_by: currentUser.email || 'anonimo@meal.org',
      data: formData,
      gps_lat: gpsData.lat,
      gps_lng: gpsData.lng,
      submitted_at: now,
      updated_at: now,
      sync_status: 'pending_sync' // Guardar offline listo para subir
    };

    try {
      await db.survey_responses.add(newResponse);
      setSubmitSuccess(true);
      setFormData({});
      setGpsData({ lat: null, lng: null });
      await updatePendingCount();
      
      // Salir del formulario en 2 segundos
      setTimeout(() => {
        setSelectedSurveyId(null);
        setSubmitSuccess(false);
      }, 2000);
    } catch (err) {
      console.error('Error al registrar respuesta de encuesta:', err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Cabecera */}
      <div className="flex-between">
        <div>
          <h1>Formularios y Captura de Datos</h1>
          <p>Llena encuestas en comunidades sin conexión a red o diseña nuevas plantillas dinámicas.</p>
        </div>
      </div>

      {/* Tabs superiores */}
      <div className="glass-panel" style={{ padding: '0.5rem', display: 'flex', gap: '0.5rem' }}>
        <button 
          onClick={() => setTab('collect')}
          className="btn"
          style={{ 
            flex: 1, 
            background: tab === 'collect' ? 'var(--bg-dark)' : 'transparent',
            borderColor: tab === 'collect' ? 'var(--border-glass)' : 'transparent',
            color: tab === 'collect' ? 'var(--primary-light)' : 'var(--text-secondary)'
          }}
        >
          Recolección de Campo
        </button>
        
        {isAdmin ? (
          <button 
            onClick={() => setTab('design')}
            className="btn"
            style={{ 
              flex: 1, 
              background: tab === 'design' ? 'var(--bg-dark)' : 'transparent',
              borderColor: tab === 'design' ? 'var(--border-glass)' : 'transparent',
              color: tab === 'design' ? 'var(--primary-light)' : 'var(--text-secondary)'
            }}
          >
            Diseñador de Encuestas (Admin)
          </button>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <Info size={14} style={{ marginRight: '4px' }} /> Diseñador restringido a administradores
          </div>
        )}
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
                      justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <div style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--primary-light)', padding: '0.5rem', borderRadius: '8px' }}>
                        <FileText size={20} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <strong style={{ color: isSelected ? 'var(--primary-light)' : 'var(--text-primary)' }}>{s.title}</strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{s.description}</span>
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

          {/* Formulario Dinámico Activo */}
          {activeSurvey && (
            <div className="glass-panel" style={{ padding: '2rem' }}>
              {submitSuccess ? (
                /* Éxito al enviar */
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem', padding: '3rem 0' }}>
                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--status-online)', padding: '1rem', borderRadius: '50%' }}>
                    <Check size={48} />
                  </div>
                  <h2>¡Guardado Offline Exitosamente!</h2>
                  <p style={{ textAlign: 'center' }}>La encuesta se guardó localmente en IndexedDB. Se sincronizará automáticamente al detectar conexión.</p>
                </div>
              ) : (
                /* Formulario Real */
                <form onSubmit={handleSubmitResponse} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div>
                    <span className="badge badge-success" style={{ fontSize: '0.65rem', marginBottom: '0.5rem' }}>Llenando Encuesta</span>
                    <h2>{activeSurvey.title}</h2>
                    <p style={{ fontSize: '0.85rem' }}>{activeSurvey.description}</p>
                  </div>
                  
                  <hr style={{ border: 0, borderTop: '1px solid var(--border-glass)' }} />

                  {/* Renderizado Dinámico de Campos */}
                  {activeSurvey.schema?.fields?.map((field) => {
                    return (
                      <div key={field.name} className="form-group">
                        <label>
                          {field.label} {field.required && <span style={{ color: '#ef4444' }}>*</span>}
                        </label>
                        
                        {field.type === 'text' && (
                          <input 
                            type="text" 
                            required={field.required}
                            value={formData[field.name] || ''}
                            onChange={(e) => handleInputChange(field.name, e.target.value)}
                            placeholder="Escribe aquí..."
                          />
                        )}

                        {field.type === 'number' && (
                          <input 
                            type="number" 
                            required={field.required}
                            value={formData[field.name] || ''}
                            onChange={(e) => handleInputChange(field.name, e.target.value)}
                            placeholder="0"
                          />
                        )}

                        {field.type === 'select' && (
                          <select
                            required={field.required}
                            value={formData[field.name] || ''}
                            onChange={(e) => handleInputChange(field.name, e.target.value)}
                          >
                            <option value="">-- Seleccionar --</option>
                            {field.options?.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        )}

                        {field.type === 'textarea' && (
                          <textarea
                            rows="3"
                            required={field.required}
                            value={formData[field.name] || ''}
                            onChange={(e) => handleInputChange(field.name, e.target.value)}
                            placeholder="Detalles adicionales..."
                          />
                        )}
                      </div>
                    );
                  })}

                  {/* Captura de Coordenadas GPS */}
                  <div style={{ background: 'rgba(255,255,255,0.01)', padding: '1rem', border: '1px solid var(--border-glass)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div className="flex-between">
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <MapPin size={16} /> Geolocalización del Reporte
                      </span>
                      <button 
                        type="button" 
                        onClick={handleGetLocation} 
                        disabled={isCapturingGps}
                        className="btn btn-secondary"
                        style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
                      >
                        {isCapturingGps ? 'Obteniendo...' : gpsData.lat ? 'Recapturar' : 'Obtener GPS'}
                      </button>
                    </div>

                    {gpsData.lat ? (
                      <div style={{ fontSize: '0.8rem', color: 'var(--primary-light)' }}>
                        Coordenadas: Latitud <strong>{gpsData.lat}</strong>, Longitud <strong>{gpsData.lng}</strong> (Simulado/Capturado)
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        No se han registrado coordenadas geográficas para este reporte.
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                    <button type="button" onClick={() => setSelectedSurveyId(null)} className="btn btn-secondary" style={{ flex: 1 }}>
                      Cerrar
                    </button>
                    <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>
                      <Send size={16} /> Guardar Respuestas
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {/* CONTENIDO TAB DISEÑADOR (ADMIN) */}
      {tab === 'design' && isAdmin && (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h2 style={{ marginBottom: '1.25rem' }}>Crear Nueva Plantilla de Encuesta</h2>
          
          <form onSubmit={handleSaveSurveyTemplate} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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
