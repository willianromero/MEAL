import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addWithSignature, putWithSignature, logAudit } from '../db';
import { updatePendingCount } from '../syncEngine';
import { useTenant } from '../context/TenantContext';
import { CAP, can } from '../lib/roles';
import { FIELD_TYPES } from '../lib/formEngine';
import { hardDelete } from '../lib/configActions';
import { FileCog, Plus, Save, Trash2, Power, Info } from 'lucide-react';

// Constructor de formularios configurables (DRT M2, HU-09): permite crear y
// editar formularios sin recompilar la app. La app los descarga en la sync.
export default function FormBuilder({ currentUser }) {
  const { activeTenantId, activeTenant, capabilities } = useTenant();
  const canEdit = can(capabilities, CAP.EDIT_CATALOG);
  const canDelete = can(capabilities, CAP.DELETE_CONFIG);
  const ctx = { tenantId: activeTenantId, userId: currentUser?.id, userEmail: currentUser?.email };
  const [delMsg, setDelMsg] = useState('');
  const delForm = async (f) => {
    if (!confirm(`¿Eliminar definitivamente el formulario "${f.nombre}"?`)) return;
    try { await hardDelete('forms', db.forms, f, ctx); } catch (e) { setDelMsg(e.message); }
  };

  const byTenant = (store) => () =>
    activeTenantId ? store.where('tenant_id').equals(activeTenantId).toArray() : Promise.resolve([]);
  const forms = useLiveQuery(byTenant(db.forms), [activeTenantId]) || [];
  const lines = useLiveQuery(byTenant(db.program_lines), [activeTenantId]) || [];

  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [lineaId, setLineaId] = useState('');
  const [campos, setCampos] = useState([
    { name: 'campo_1', etiqueta_es: 'Nuevo campo', tipo: 'texto', obligatorio: true, opciones: '' }
  ]);
  const [msg, setMsg] = useState('');

  if (!canEdit) {
    return (
      <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <Info size={28} style={{ marginBottom: '0.5rem' }} />
        <p>Solo roles administrativos del proyecto pueden diseñar formularios.</p>
      </div>
    );
  }

  const addCampo = () => setCampos([...campos, { name: `campo_${campos.length + 1}`, etiqueta_es: 'Nuevo campo', tipo: 'texto', obligatorio: false, opciones: '' }]);
  const updCampo = (i, k, v) => { const c = [...campos]; c[i][k] = v; setCampos(c); };
  const delCampo = (i) => setCampos(campos.filter((_, idx) => idx !== i));

  const save = async (e) => {
    e.preventDefault();
    if (!nombre || !codigo) return;
    const now = new Date().toISOString();
    const id = `frm-${activeTenantId}-${Math.random().toString(36).slice(2, 7)}`;
    const processed = campos.map((c, idx) => ({
      name: (c.name || `campo_${idx + 1}`).trim().toLowerCase().replace(/\s+/g, '_'),
      etiqueta_es: c.etiqueta_es,
      etiqueta_way: c.etiqueta_way || null,
      tipo: c.tipo,
      obligatorio: !!c.obligatorio,
      reglas_validacion: null,
      ...(c.tipo === 'select' ? { opciones: (c.opciones || '').split(',').map(o => o.trim()).filter(Boolean) } : {})
    }));
    const form = {
      id, tenant_id: activeTenantId, codigo, nombre, version: 1,
      linea_id: lineaId || null, activo: true, campos: processed,
      updated_at: now, sync_status: 'pending_sync'
    };
    await addWithSignature(db.forms, form);
    await logAudit({ tenantId: activeTenantId, actorId: currentUser?.id, actorEmail: currentUser?.email, accion: 'crear', entidad: 'forms', entidadId: id, despues: { codigo, nombre } });
    await updatePendingCount();
    setMsg(`Formulario "${nombre}" publicado. Disponible en la captura tras la próxima sincronización de catálogos (HU-09).`);
    setCodigo(''); setNombre(''); setLineaId('');
    setCampos([{ name: 'campo_1', etiqueta_es: 'Nuevo campo', tipo: 'texto', obligatorio: true, opciones: '' }]);
  };

  const toggleActivo = async (f) => {
    await putWithSignature(db.forms, { ...f, activo: !(f.activo !== false), updated_at: new Date().toISOString(), sync_status: 'pending_sync' });
    await updatePendingCount();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><FileCog size={26} /> Constructor de Formularios</h1>
        <p>Crea y administra formularios de captura de <strong style={{ color: 'var(--primary-light)' }}>{activeTenant?.nombre}</strong> sin recompilar la app.</p>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Lista de formularios existentes */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <h3>Formularios del proyecto ({forms.length})</h3>
          {forms.map(f => (
            <div key={f.id} className="glass-card" style={{ padding: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{f.nombre}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{f.codigo} · {(f.campos || []).length} campos · {f.activo !== false ? 'activo' : 'inactivo'}</div>
              </div>
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                <button onClick={() => toggleActivo(f)} className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem' }} title={f.activo !== false ? 'Archivar (desactivar)' : 'Restaurar (activar)'}>
                  <Power size={12} /> {f.activo !== false ? 'Archivar' : 'Restaurar'}
                </button>
                {canDelete && (
                  <button onClick={() => delForm(f)} className="btn btn-danger" style={{ padding: '0.3rem 0.5rem', fontSize: '0.72rem' }} title="Eliminar definitivo"><Trash2 size={12} /></button>
                )}
              </div>
            </div>
          ))}
          {delMsg && <div className="badge badge-info" style={{ display: 'block', padding: '0.5rem', fontSize: '0.72rem', whiteSpace: 'normal' }}>{delMsg}</div>}
        </div>

        {/* Constructor */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Nuevo formulario</h3>
          {msg && <div className="badge badge-success" style={{ display: 'block', padding: '0.5rem', marginBottom: '0.85rem', fontSize: '0.72rem', whiteSpace: 'normal' }}>{msg}</div>}
          <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
              <div className="form-group"><label>Código *</label><input value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="F-XXX" required /></div>
              <div className="form-group"><label>Nombre *</label><input value={nombre} onChange={e => setNombre(e.target.value)} required /></div>
            </div>
            <div className="form-group">
              <label>Línea programática (opcional)</label>
              <select value={lineaId} onChange={e => setLineaId(e.target.value)}>
                <option value="">— Sin línea —</option>
                {lines.map(l => <option key={l.id} value={l.id}>{l.codigo} · {l.nombre}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div className="flex-between"><strong style={{ fontSize: '0.85rem' }}>Campos</strong>
                <button type="button" onClick={addCampo} className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem' }}><Plus size={12} /> Campo</button>
              </div>
              {campos.map((c, i) => (
                <div key={i} className="glass-card" style={{ padding: '0.75rem', display: 'grid', gridTemplateColumns: '2fr 1.2fr auto auto', gap: '0.5rem', alignItems: 'end', background: 'rgba(15,23,42,0.3)' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.7rem' }}>Etiqueta</label>
                    <input value={c.etiqueta_es} onChange={e => updCampo(i, 'etiqueta_es', e.target.value)} required />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.7rem' }}>Tipo</label>
                    <select value={c.tipo} onChange={e => updCampo(i, 'tipo', e.target.value)}>
                      {Object.entries(FIELD_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', height: '38px' }}>
                    <input type="checkbox" checked={c.obligatorio} onChange={e => updCampo(i, 'obligatorio', e.target.checked)} style={{ width: 'auto' }} />
                    <label style={{ fontSize: '0.68rem', marginBottom: 0 }}>Oblig.</label>
                  </div>
                  <button type="button" onClick={() => delCampo(i)} className="btn btn-danger" style={{ padding: '0.4rem', height: '38px' }} disabled={campos.length <= 1}><Trash2 size={14} /></button>
                  {c.tipo === 'select' && (
                    <div className="form-group" style={{ gridColumn: 'span 4', marginBottom: 0 }}>
                      <label style={{ fontSize: '0.7rem' }}>Opciones (separadas por coma)</label>
                      <input value={c.opciones || ''} onChange={e => updCampo(i, 'opciones', e.target.value)} placeholder="Opción A, Opción B" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button type="submit" className="btn btn-primary"><Save size={14} /> Publicar formulario</button>
          </form>
        </div>
      </div>
    </div>
  );
}
