import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addWithSignature } from '../db';
import { updatePendingCount } from '../syncEngine';
import { useTenant } from '../context/TenantContext';
import { CAP, can } from '../lib/roles';
import { validateForm, isFieldVisible, fieldLabel } from '../lib/formEngine';
import { buildEvidence } from '../lib/evidence';
import SignatureVerifier from '../components/SignatureVerifier';
import { ClipboardList, FileText, MapPin, Camera, Send, Check, Info, Trash2, Clock, CheckCircle2, XCircle } from 'lucide-react';

// Captura de campo offline (DRT M2/M3/M4/M5, HU-01/HU-02). Renderiza formularios
// configurables, captura geopunto y fotos, valida y guarda registros inmutables.
export default function FieldCapture({ currentUser }) {
  const { activeTenantId, activeTenant, capabilities, tenantRole } = useTenant();
  const canCapture = can(capabilities, CAP.CAPTURE);
  const idioma = (activeTenant?.config?.idiomas?.[0]) || 'es';

  const byTenant = (store) => () =>
    activeTenantId ? store.where('tenant_id').equals(activeTenantId).toArray() : Promise.resolve([]);
  const forms = (useLiveQuery(byTenant(db.forms), [activeTenantId]) || []).filter(f => f.activo !== false);
  const units = (useLiveQuery(byTenant(db.units), [activeTenantId]) || []).filter(u => !u.archivado);
  const records = useLiveQuery(byTenant(db.field_records), [activeTenantId]) || [];

  const [selectedFormId, setSelectedFormId] = useState(null);
  const [datos, setDatos] = useState({});
  const [unidadId, setUnidadId] = useState('');
  const [geopunto, setGeopunto] = useState(null);
  const [capturingGps, setCapturingGps] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState([]); // {name, file}
  const [errores, setErrores] = useState({});
  const [success, setSuccess] = useState(false);

  const activeForm = forms.find(f => f.id === selectedFormId);
  const formRecords = records.filter(r => r.formulario_id === selectedFormId);

  const openForm = (form) => {
    setSelectedFormId(form.id);
    setDatos({}); setUnidadId(''); setGeopunto(null); setPendingPhotos([]); setErrores({}); setSuccess(false);
  };

  const setField = (name, val) => setDatos(prev => ({ ...prev, [name]: val }));

  const captureGps = (targetField = null) => {
    setCapturingGps(true);
    if (!navigator.geolocation) { setCapturingGps(false); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const punto = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, timestamp: new Date().toISOString() };
        if (targetField) setField(targetField, punto); else setGeopunto(punto);
        setCapturingGps(false);
      },
      () => { setCapturingGps(false); },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const addPhoto = (fieldName, file, tipoEvidencia = 'foto') => {
    if (!file) return;
    setPendingPhotos(prev => [...prev.filter(p => p.name !== fieldName), { name: fieldName, file, tipo: tipoEvidencia }]);
    setField(fieldName, `[${tipoEvidencia}:${file.name}]`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canCapture || !activeForm) return;

    const { valido, errores: errs } = validateForm(activeForm, datos);
    setErrores(errs);
    if (!valido) return;

    const recordId = globalThis.crypto.randomUUID();
    const now = new Date().toISOString();
    const record = {
      id: recordId,
      tenant_id: activeTenantId,
      formulario_id: activeForm.id,
      formulario_version: activeForm.version || 1,
      unidad_id: unidadId || null,
      proyecto_id: null,
      autor_id: currentUser?.id || 'anon',
      autor_rol: tenantRole,
      datos,
      geopunto: geopunto || datos.geopunto || null,
      capturado_at: now,
      estado_validacion: 'pendiente', // entra a la cola de validación (RF-CAL-3)
      motivo_rechazo: null,
      corrige_registro_id: null,
      updated_at: now,
      sync_status: 'pending_sync'
    };

    try {
      await addWithSignature(db.field_records, record);
      // Evidencias: las fotos se comprimen, los documentos se suben tal cual (8.3)
      for (const { file, tipo } of pendingPhotos) {
        const ev = await buildEvidence({ tenantId: activeTenantId, registroId: recordId, file, tipo, geopunto: geopunto || null });
        await addWithSignature(db.evidences, ev);
      }
      setSuccess(true);
      setDatos({}); setUnidadId(''); setGeopunto(null); setPendingPhotos([]); setErrores({});
      await updatePendingCount();
      setTimeout(() => setSuccess(false), 2200);
    } catch (err) {
      console.error('Error guardando registro de campo:', err);
    }
  };

  const renderField = (campo) => {
    if (!isFieldVisible(campo, datos)) return null;
    const val = datos[campo.name] ?? '';
    const label = fieldLabel(campo, idioma);
    const req = campo.obligatorio && <span style={{ color: '#ef4444' }}> *</span>;
    const err = errores[campo.name];

    let control;
    switch (campo.tipo) {
      case 'select':
        control = (
          <select value={val} onChange={e => setField(campo.name, e.target.value)}>
            <option value="">-- Seleccionar --</option>
            {(campo.opciones || []).map((o, i) => <option key={i} value={o}>{o}</option>)}
          </select>
        );
        break;
      case 'bool':
        control = (
          <select value={val} onChange={e => setField(campo.name, e.target.value)}>
            <option value="">-- Seleccionar --</option>
            <option value="si">Sí</option>
            <option value="no">No</option>
          </select>
        );
        break;
      case 'num':
        control = <input type="number" value={val} onChange={e => setField(campo.name, e.target.value)} />;
        break;
      case 'escala':
        control = <input type="number" min="1" max="5" value={val} onChange={e => setField(campo.name, e.target.value)} placeholder="1 a 5" />;
        break;
      case 'fecha':
        control = <input type="date" value={val} onChange={e => setField(campo.name, e.target.value)} />;
        break;
      case 'geo':
        control = (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', flex: 1 }}>
              {val && val.lat ? `Lat ${val.lat.toFixed(5)}, Lng ${val.lng.toFixed(5)}` : 'Sin capturar'}
            </span>
            <button type="button" className="btn btn-secondary" style={{ padding: '0.35rem 0.7rem', fontSize: '0.72rem' }} onClick={() => captureGps(campo.name)} disabled={capturingGps}>
              <MapPin size={13} /> {capturingGps ? 'Obteniendo...' : 'Capturar GPS'}
            </button>
          </div>
        );
        break;
      case 'foto':
        control = (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input type="file" accept="image/*" capture="environment" onChange={e => addPhoto(campo.name, e.target.files?.[0], 'foto')} style={{ fontSize: '0.8rem' }} />
            {pendingPhotos.find(p => p.name === campo.name) && <Check size={16} style={{ color: 'var(--primary-light)' }} />}
          </div>
        );
        break;
      case 'documento':
        control = (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input type="file" accept="application/pdf,image/*" onChange={e => addPhoto(campo.name, e.target.files?.[0], 'documento')} style={{ fontSize: '0.8rem' }} />
            {pendingPhotos.find(p => p.name === campo.name) && <Check size={16} style={{ color: 'var(--primary-light)' }} />}
          </div>
        );
        break;
      case 'firma':
        control = <input type="text" value={val} onChange={e => setField(campo.name, e.target.value)} placeholder="Nombre de quien firma (firma digital simple)" />;
        break;
      case 'checklist': {
        const seleccion = Array.isArray(val) ? val : [];
        const toggle = (opcion) => {
          const next = seleccion.includes(opcion) ? seleccion.filter(o => o !== opcion) : [...seleccion, opcion];
          setField(campo.name, next);
        };
        control = (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {(campo.opciones || []).map((op, i) => (
              <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={seleccion.includes(op)} onChange={() => toggle(op)} style={{ width: 'auto' }} />
                {op}
              </label>
            ))}
            {(!campo.opciones || campo.opciones.length === 0) && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Este campo no tiene opciones configuradas.</span>}
          </div>
        );
        break;
      }
      default:
        control = <input type="text" value={val} onChange={e => setField(campo.name, e.target.value)} />;
    }

    return (
      <div className="form-group" key={campo.name}>
        <label>{label}{req}</label>
        {control}
        {err && <div style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: '0.2rem' }}>{err}</div>}
      </div>
    );
  };

  const estadoBadge = (estado) => {
    if (estado === 'validado') return { icon: <CheckCircle2 size={12} />, cls: 'badge-success', text: 'Validado' };
    if (estado === 'rechazado') return { icon: <XCircle size={12} />, cls: 'badge-danger', text: 'Rechazado' };
    return { icon: <Clock size={12} />, cls: 'badge-warning', text: 'Pendiente' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1>Captura de Campo Offline</h1>
        <p>Diligencia formularios configurables sin conexión, con geopunto y evidencia fotográfica. Los registros entran a la cola de validación.</p>
      </div>

      {!canCapture ? (
        <div className="badge badge-info" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', width: 'fit-content' }}>
          <Info size={14} /> Tu rol no captura datos de campo.
        </div>
      ) : (
        <div className="dashboard-grid" style={{ gridTemplateColumns: selectedFormId ? '1fr 1fr' : '1fr' }}>
          {/* Lista de formularios */}
          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h3>Formularios disponibles ({forms.length})</h3>
            {forms.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1rem' }}>Este proyecto no tiene formularios configurados.</div>}
            {forms.map(f => {
              const isSel = selectedFormId === f.id;
              const count = records.filter(r => r.formulario_id === f.id).length;
              return (
                <div key={f.id} onClick={() => openForm(f)} className="glass-card"
                  style={{ cursor: 'pointer', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isSel ? 'rgba(5,150,105,0.15)' : 'rgba(30,41,59,0.2)', borderColor: isSel ? 'var(--primary-color)' : 'var(--border-glass)' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <FileText size={18} style={{ color: 'var(--primary-light)' }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{f.nombre}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{f.codigo} · v{f.version} · {(f.campos || []).length} campos</div>
                    </div>
                  </div>
                  <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>{count} registros</span>
                </div>
              );
            })}
          </div>

          {/* Formulario de captura + registros */}
          {activeForm && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="glass-panel" style={{ padding: '2rem' }}>
                {success ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1.5rem 0', gap: '0.75rem' }}>
                    <div style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--status-online)', padding: '0.75rem', borderRadius: '50%' }}><Check size={34} /></div>
                    <h3 style={{ margin: 0 }}>Registro guardado</h3>
                    <p style={{ textAlign: 'center', fontSize: '0.85rem', margin: 0 }}>Firmado SHA-256 y en cola de sincronización. Entró como "pendiente" de validación.</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="flex-between">
                      <h3 style={{ margin: 0 }}>{activeForm.nombre}</h3>
                      <button type="button" className="btn btn-secondary" style={{ padding: '0.3rem 0.5rem' }} onClick={() => setSelectedFormId(null)}>Cerrar</button>
                    </div>

                    <div className="form-group">
                      <label>Unidad de análisis</label>
                      <select value={unidadId} onChange={e => setUnidadId(e.target.value)}>
                        <option value="">-- Seleccionar --</option>
                        {units.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                      </select>
                    </div>

                    {(activeForm.campos || []).map(renderField)}

                    {/* Geopunto general del registro si el formulario no lleva campo geo propio */}
                    {!(activeForm.campos || []).some(c => c.tipo === 'geo') && (
                      <div className="glass-card" style={{ padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.1)' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          <MapPin size={13} style={{ verticalAlign: 'middle', color: 'var(--primary-light)' }} /> {geopunto ? `Lat ${geopunto.lat.toFixed(5)}, Lng ${geopunto.lng.toFixed(5)}` : 'Ubicación del registro no capturada'}
                        </span>
                        <button type="button" className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem' }} onClick={() => captureGps()} disabled={capturingGps}>
                          {capturingGps ? 'Obteniendo...' : 'Capturar GPS'}
                        </button>
                      </div>
                    )}

                    <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}><Send size={15} /> Guardar registro offline</button>
                  </form>
                )}
              </div>

              {/* Registros recientes de este formulario */}
              <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <h3>Registros capturados ({formRecords.length})</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '360px', overflowY: 'auto' }}>
                  {formRecords.slice().reverse().map(r => {
                    const b = estadoBadge(r.estado_validacion);
                    const unidad = units.find(u => u.id === r.unidad_id);
                    return (
                      <div key={r.id} className="glass-card" style={{ padding: '0.85rem', fontSize: '0.8rem', background: 'rgba(15,23,42,0.3)' }}>
                        <div className="flex-between" style={{ marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.25rem' }}>
                          <span style={{ fontWeight: 600, color: 'var(--primary-light)' }}>{unidad?.nombre || 'Sin unidad'}</span>
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            <SignatureVerifier record={r} />
                            <span className={`badge ${b.cls}`} style={{ fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>{b.icon} {b.text}</span>
                          </div>
                        </div>
                        <div className="flex-between" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          <span>Capturado: {new Date(r.capturado_at).toLocaleString()}</span>
                          {r.geopunto && <span>📍 {r.geopunto.lat.toFixed(4)}, {r.geopunto.lng.toFixed(4)}</span>}
                        </div>
                        {r.motivo_rechazo && <div style={{ marginTop: '0.3rem', color: '#fca5a5', fontSize: '0.72rem' }}>Motivo de rechazo: {r.motivo_rechazo}</div>}
                      </div>
                    );
                  })}
                  {formRecords.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '1rem', textAlign: 'center' }}>Aún no hay registros para este formulario.</div>}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
