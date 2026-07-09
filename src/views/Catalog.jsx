import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addWithSignature, putWithSignature, logAudit } from '../db';
import { updatePendingCount } from '../syncEngine';
import { useTenant } from '../context/TenantContext';
import { CAP, can } from '../lib/roles';
import { archiveRecord, restoreRecord, hardDelete, isArchived } from '../lib/configActions';
import { MapPin, Layers, Plus, Save, Trash2, Info, Building2, Hash, Archive, RotateCcw, FilePen } from 'lucide-react';

// Catálogo maestro por tenant (RF-CAT-1, RF-CAT-2): unidades de análisis y
// líneas programáticas. La unidad se llama según unidad_analisis_default del tenant.
export default function Catalog({ currentUser }) {
  const { activeTenantId, activeTenant, capabilities } = useTenant();
  const canEdit = can(capabilities, CAP.EDIT_CATALOG);
  const canDelete = can(capabilities, CAP.DELETE_CONFIG);
  const ctx = { tenantId: activeTenantId, userId: currentUser?.id, userEmail: currentUser?.email };

  const byTenant = (store) => () =>
    activeTenantId ? store.where('tenant_id').equals(activeTenantId).toArray() : Promise.resolve([]);
  const allUnits = useLiveQuery(byTenant(db.units), [activeTenantId]) || [];
  const allLines = useLiveQuery(byTenant(db.program_lines), [activeTenantId]) || [];

  const [showArchived, setShowArchived] = useState(false);
  const [editUnit, setEditUnit] = useState(null);   // {id, nombre, municipio}
  const [editLine, setEditLine] = useState(null);   // {id, codigo, nombre}
  const [actionMsg, setActionMsg] = useState('');
  const units = allUnits.filter(u => showArchived ? isArchived('units', u) : !isArchived('units', u));
  const lines = allLines.filter(l => showArchived ? isArchived('program_lines', l) : !isArchived('program_lines', l));

  const delUnit = async (u) => { if (!confirm(`¿Eliminar definitivamente la unidad "${u.nombre}"?`)) return; try { await hardDelete('units', db.units, u, ctx); } catch (e) { setActionMsg(e.message); } };
  const delLine = async (l) => { if (!confirm(`¿Eliminar definitivamente la línea "${l.nombre}"?`)) return; try { await hardDelete('program_lines', db.program_lines, l, ctx); } catch (e) { setActionMsg(e.message); } };
  const saveUnitEdit = async () => { const u = allUnits.find(x => x.id === editUnit.id); await putWithSignature(db.units, { ...u, nombre: editUnit.nombre, municipio: editUnit.municipio, updated_at: new Date().toISOString(), sync_status: 'pending_sync' }); await logAudit({ tenantId: activeTenantId, actorId: currentUser?.id, actorEmail: currentUser?.email, accion: 'editar', entidad: 'units', entidadId: u.id }); await updatePendingCount(); setEditUnit(null); };
  const saveLineEdit = async () => { const l = allLines.find(x => x.id === editLine.id); await putWithSignature(db.program_lines, { ...l, codigo: editLine.codigo, nombre: editLine.nombre, updated_at: new Date().toISOString(), sync_status: 'pending_sync' }); await logAudit({ tenantId: activeTenantId, actorId: currentUser?.id, actorEmail: currentUser?.email, accion: 'editar', entidad: 'program_lines', entidadId: l.id }); await updatePendingCount(); setEditLine(null); };

  const [tab, setTab] = useState('units');

  // Formulario de unidad
  const [uName, setUName] = useState('');
  const [uMunicipio, setUMunicipio] = useState('');
  const [uLat, setULat] = useState('');
  const [uLng, setULng] = useState('');
  const [uPob, setUPob] = useState('');

  // Formulario de línea
  const [lCodigo, setLCodigo] = useState('');
  const [lNombre, setLNombre] = useState('');
  const [lTipo, setLTipo] = useState('estructurada');

  const unidadLabel = {
    comunidad: 'Comunidad', vereda: 'Vereda', organizacion: 'Organización', individuo: 'Individuo'
  }[activeTenant?.unidad_analisis_default] || 'Unidad de análisis';

  const handleAddUnit = async (e) => {
    e.preventDefault();
    if (!canEdit || !uName) return;
    const now = new Date().toISOString();
    const record = {
      id: `unit-${activeTenantId}-${Math.random().toString(36).slice(2, 8)}`,
      tenant_id: activeTenantId,
      nombre: uName,
      municipio: uMunicipio || null,
      estado_reconocimiento: 'en_proceso',
      autoridad_tradicional: null,
      geopunto: (uLat && uLng) ? { lat: Number(uLat), lng: Number(uLng) } : null,
      poblacion_estimada: uPob ? Number(uPob) : null,
      atributos: {},
      updated_at: now,
      sync_status: 'pending_sync'
    };
    await addWithSignature(db.units, record);
    await logAudit({ tenantId: activeTenantId, actorId: currentUser?.id, actorEmail: currentUser?.email, accion: 'crear', entidad: 'units', entidadId: record.id, despues: { nombre: uName } });
    setUName(''); setUMunicipio(''); setULat(''); setULng(''); setUPob('');
    await updatePendingCount();
  };

  const handleAddLine = async (e) => {
    e.preventDefault();
    if (!canEdit || !lNombre || !lCodigo) return;
    const now = new Date().toISOString();
    const record = {
      id: `line-${activeTenantId}-${Math.random().toString(36).slice(2, 8)}`,
      tenant_id: activeTenantId,
      codigo: lCodigo,
      nombre: lNombre,
      tipo: lTipo,
      orden: lines.length + 1,
      fases: [],
      updated_at: now,
      sync_status: 'pending_sync'
    };
    await addWithSignature(db.program_lines, record);
    await logAudit({ tenantId: activeTenantId, actorId: currentUser?.id, actorEmail: currentUser?.email, accion: 'crear', entidad: 'program_lines', entidadId: record.id, despues: { codigo: lCodigo, nombre: lNombre } });
    setLCodigo(''); setLNombre(''); setLTipo('estructurada');
    await updatePendingCount();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1>Catálogo Maestro</h1>
        <p>
          Configuración del proyecto <strong style={{ color: 'var(--primary-light)' }}>{activeTenant?.nombre || '—'}</strong>:
          {' '}unidades de análisis y líneas programáticas. Alta por configuración, sin desarrollo.
        </p>
      </div>

      {!canEdit && (
        <div className="badge badge-info" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', width: 'fit-content' }}>
          <Info size={14} /> Modo consulta: solo roles administrativos editan el catálogo.
        </div>
      )}

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="glass-panel" style={{ padding: '0.5rem', display: 'flex', gap: '0.5rem', width: 'fit-content' }}>
          {[['units', `${unidadLabel}s`], ['lines', 'Líneas programáticas']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className="btn"
              style={{ background: tab === id ? 'var(--bg-dark)' : 'transparent', borderColor: tab === id ? 'var(--border-glass)' : 'transparent', color: tab === id ? 'var(--primary-light)' : 'var(--text-secondary)', fontSize: '0.85rem', padding: '0.4rem 1rem' }}>
              {label}
            </button>
          ))}
        </div>
        {canEdit && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} style={{ width: 'auto' }} />
            <Archive size={14} /> Ver archivados
          </label>
        )}
      </div>
      {actionMsg && <div className="badge badge-info" style={{ display: 'block', padding: '0.6rem 1rem', fontSize: '0.8rem', whiteSpace: 'normal', width: 'fit-content' }}>{actionMsg}</div>}

      {/* UNIDADES DE ANÁLISIS */}
      {tab === 'units' && (
        <div className="dashboard-grid" style={{ gridTemplateColumns: canEdit ? '2fr 1fr' : '1fr' }}>
          <div className="glass-panel" style={{ padding: '1.5rem', overflowX: 'auto' }}>
            <h3 style={{ marginBottom: '1rem' }}>{unidadLabel}s registradas ({units.length})</h3>
            <table className="table" style={{ width: '100%', minWidth: '560px' }}>
              <thead><tr><th>Nombre</th><th>Municipio</th><th>Geopunto</th><th>Estado</th>{canEdit && <th style={{ textAlign: 'right' }}>Acciones</th>}</tr></thead>
              <tbody>
                {units.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>
                      {editUnit?.id === u.id
                        ? <input value={editUnit.nombre} onChange={e => setEditUnit({ ...editUnit, nombre: e.target.value })} style={{ padding: '0.2rem 0.4rem' }} />
                        : u.nombre}
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>
                      {editUnit?.id === u.id
                        ? <input value={editUnit.municipio} onChange={e => setEditUnit({ ...editUnit, municipio: e.target.value })} style={{ padding: '0.2rem 0.4rem', width: '100px' }} />
                        : (u.municipio || '—')}
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {u.geopunto ? `${u.geopunto.lat.toFixed(4)}, ${u.geopunto.lng.toFixed(4)}` : 'Sin coordenadas'}
                    </td>
                    <td>
                      <span className="badge" style={{ fontSize: '0.65rem', background: u.estado_reconocimiento === 'legalizada' ? 'rgba(5,150,105,0.12)' : 'rgba(234,179,8,0.12)', color: u.estado_reconocimiento === 'legalizada' ? '#a7f3d0' : '#fef08a' }}>
                        {u.estado_reconocimiento === 'legalizada' ? 'Legalizada' : 'En proceso'}
                      </span>
                    </td>
                    {canEdit && (
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {editUnit?.id === u.id ? (
                          <>
                            <button onClick={saveUnitEdit} className="btn btn-primary" style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem' }}><Save size={11} /></button>
                            <button onClick={() => setEditUnit(null)} className="btn btn-secondary" style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem', marginLeft: '0.25rem' }}>✕</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => setEditUnit({ id: u.id, nombre: u.nombre, municipio: u.municipio || '' })} className="btn btn-secondary" style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem' }} title="Editar"><FilePen size={11} /></button>
                            {isArchived('units', u)
                              ? <button onClick={() => restoreRecord('units', db.units, u, ctx)} className="btn btn-secondary" style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem', marginLeft: '0.25rem' }} title="Restaurar"><RotateCcw size={11} /></button>
                              : <button onClick={() => archiveRecord('units', db.units, u, ctx)} className="btn btn-secondary" style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem', marginLeft: '0.25rem' }} title="Archivar"><Archive size={11} /></button>}
                            {canDelete && <button onClick={() => delUnit(u)} className="btn btn-danger" style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem', marginLeft: '0.25rem' }} title="Eliminar"><Trash2 size={11} /></button>}
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {canEdit && (
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Plus size={18} /> Nueva {unidadLabel}</h3>
              <form onSubmit={handleAddUnit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div className="form-group"><label>Nombre *</label><input value={uName} onChange={e => setUName(e.target.value)} required /></div>
                <div className="form-group"><label>Municipio</label><input value={uMunicipio} onChange={e => setUMunicipio(e.target.value)} placeholder="Ej. Riohacha" /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group"><label>Latitud</label><input type="number" step="any" value={uLat} onChange={e => setULat(e.target.value)} /></div>
                  <div className="form-group"><label>Longitud</label><input type="number" step="any" value={uLng} onChange={e => setULng(e.target.value)} /></div>
                </div>
                <div className="form-group"><label>Población estimada</label><input type="number" min="0" value={uPob} onChange={e => setUPob(e.target.value)} /></div>
                <button type="submit" className="btn btn-primary"><Save size={14} /> Guardar</button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* LÍNEAS PROGRAMÁTICAS */}
      {tab === 'lines' && (
        <div className="dashboard-grid" style={{ gridTemplateColumns: canEdit ? '2fr 1fr' : '1fr' }}>
          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h3 style={{ marginBottom: '0.5rem' }}>Líneas programáticas ({lines.length})</h3>
            {lines.sort((a, b) => a.orden - b.orden).map(l => (
              <div key={l.id} className="glass-card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span className="badge" style={{ background: 'rgba(5,150,105,0.12)', color: '#a7f3d0', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Hash size={12} />
                  {editLine?.id === l.id ? <input value={editLine.codigo} onChange={e => setEditLine({ ...editLine, codigo: e.target.value })} style={{ width: '60px', padding: '0.1rem 0.3rem' }} /> : l.codigo}
                </span>
                <div style={{ flex: 1 }}>
                  {editLine?.id === l.id
                    ? <input value={editLine.nombre} onChange={e => setEditLine({ ...editLine, nombre: e.target.value })} style={{ width: '100%', padding: '0.2rem 0.4rem' }} />
                    : <div style={{ fontWeight: 600 }}>{l.nombre}</div>}
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Tipo: {l.tipo}{l.fases?.length ? ` · ${l.fases.length} fases` : ''}
                  </div>
                </div>
                {canEdit && (
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    {editLine?.id === l.id ? (
                      <>
                        <button onClick={saveLineEdit} className="btn btn-primary" style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem' }}><Save size={11} /></button>
                        <button onClick={() => setEditLine(null)} className="btn btn-secondary" style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem' }}>✕</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => setEditLine({ id: l.id, codigo: l.codigo, nombre: l.nombre })} className="btn btn-secondary" style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem' }} title="Editar"><FilePen size={11} /></button>
                        {isArchived('program_lines', l)
                          ? <button onClick={() => restoreRecord('program_lines', db.program_lines, l, ctx)} className="btn btn-secondary" style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem' }} title="Restaurar"><RotateCcw size={11} /></button>
                          : <button onClick={() => archiveRecord('program_lines', db.program_lines, l, ctx)} className="btn btn-secondary" style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem' }} title="Archivar"><Archive size={11} /></button>}
                        {canDelete && <button onClick={() => delLine(l)} className="btn btn-danger" style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem' }} title="Eliminar"><Trash2 size={11} /></button>}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {canEdit && (
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Layers size={18} /> Nueva línea</h3>
              <form onSubmit={handleAddLine} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div className="form-group"><label>Código *</label><input value={lCodigo} onChange={e => setLCodigo(e.target.value)} placeholder="Ej. L6" required /></div>
                <div className="form-group"><label>Nombre *</label><input value={lNombre} onChange={e => setLNombre(e.target.value)} required /></div>
                <div className="form-group">
                  <label>Tipo</label>
                  <select value={lTipo} onChange={e => setLTipo(e.target.value)}>
                    <option value="estructurada">Estructurada (con fases)</option>
                    <option value="flexible">Flexible (según priorización)</option>
                    <option value="transversal">Transversal</option>
                  </select>
                </div>
                <button type="submit" className="btn btn-primary"><Save size={14} /> Guardar</button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
