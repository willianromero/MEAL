import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, putWithSignature, logAudit } from '../db';
import { updatePendingCount } from '../syncEngine';
import { useTenant } from '../context/TenantContext';
import { CAP, can } from '../lib/roles';
import { detectDuplicates } from '../lib/indicatorEngine';
import SignatureVerifier from '../components/SignatureVerifier';
import { ClipboardCheck, Check, X, AlertTriangle, Info, Copy, MapPin } from 'lucide-react';

// Cola de validación / calidad del dato (DRT M6, RF-CAL-3, HU-03).
// El Coordinador valida o rechaza registros; la separación de funciones impide
// validar el dato propio (se refuerza también con trigger en el backend).
export default function Validation({ currentUser }) {
  const { activeTenantId, capabilities } = useTenant();
  const canValidate = can(capabilities, CAP.VALIDATE);

  const byTenant = (store) => () =>
    activeTenantId ? store.where('tenant_id').equals(activeTenantId).toArray() : Promise.resolve([]);
  const records = useLiveQuery(byTenant(db.field_records), [activeTenantId]) || [];
  const forms = useLiveQuery(byTenant(db.forms), [activeTenantId]) || [];
  const units = useLiveQuery(byTenant(db.units), [activeTenantId]) || [];

  const [motivos, setMotivos] = useState({});
  const [filter, setFilter] = useState('pendiente');

  const duplicados = detectDuplicates(records);
  const formName = (id) => forms.find(f => f.id === id)?.nombre || id;
  const unitName = (id) => units.find(u => u.id === id)?.nombre || '—';

  const pendientes = records.filter(r => r.estado_validacion === 'pendiente');
  const filtered = records.filter(r => filter === 'all' ? true : r.estado_validacion === filter);

  // Reporte de calidad (RF-CAL-4)
  const total = records.length;
  const rechazados = records.filter(r => r.estado_validacion === 'rechazado').length;
  const validados = records.filter(r => r.estado_validacion === 'validado').length;
  const tasaRechazo = total ? Math.round((rechazados / total) * 100) : 0;

  const doValidate = async (r, aprobar) => {
    if (!canValidate) return;
    // Separación de funciones (DRT 11.3): el autor no valida su propio dato
    if (r.autor_id === currentUser?.id) return;
    const motivo = motivos[r.id] || '';
    if (!aprobar && !motivo.trim()) return; // rechazar exige motivo

    const now = new Date().toISOString();
    await putWithSignature(db.field_records, {
      ...r,
      estado_validacion: aprobar ? 'validado' : 'rechazado',
      motivo_rechazo: aprobar ? null : motivo,
      validado_por: currentUser?.id,
      validado_at: now,
      updated_at: now,
      sync_status: 'pending_sync'
    });
    await logAudit({
      tenantId: activeTenantId, actorId: currentUser?.id, actorEmail: currentUser?.email,
      accion: aprobar ? 'validar' : 'rechazar', entidad: 'field_records', entidadId: r.id,
      antes: { estado: 'pendiente' }, despues: { estado: aprobar ? 'validado' : 'rechazado', motivo: aprobar ? null : motivo }
    });
    setMotivos(prev => { const n = { ...prev }; delete n[r.id]; return n; });
    await updatePendingCount();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><ClipboardCheck size={26} /> Cola de Validación</h1>
        <p>Control de calidad del dato: valida o rechaza los registros antes de que alimenten los indicadores (HU-03).</p>
      </div>

      {/* Reporte de calidad (RF-CAL-4) */}
      <div className="metrics-grid">
        {[
          { label: 'Pendientes', val: pendientes.length, color: '#fef08a' },
          { label: 'Validados', val: validados, color: '#a7f3d0' },
          { label: 'Rechazados', val: rechazados, color: '#fca5a5' },
          { label: 'Tasa de rechazo', val: `${tasaRechazo}%`, color: '#e0f2fe' },
          { label: 'Posibles duplicados', val: duplicados.size, color: '#fca5a5' }
        ].map(m => (
          <div key={m.label} className="glass-card" style={{ padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{m.label}</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: m.color }}>{m.val}</div>
          </div>
        ))}
      </div>

      {!canValidate && (
        <div className="badge badge-info" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', width: 'fit-content' }}>
          <Info size={14} /> Tu rol consulta la cola pero no valida (solo el Coordinador valida).
        </div>
      )}

      {/* Filtro de estado */}
      <div className="glass-panel" style={{ padding: '0.5rem', display: 'flex', gap: '0.5rem', width: 'fit-content' }}>
        {[['pendiente', 'Pendientes'], ['validado', 'Validados'], ['rechazado', 'Rechazados'], ['all', 'Todos']].map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)} className="btn"
            style={{ background: filter === id ? 'var(--bg-dark)' : 'transparent', borderColor: filter === id ? 'var(--border-glass)' : 'transparent', color: filter === id ? 'var(--primary-light)' : 'var(--text-secondary)', fontSize: '0.8rem', padding: '0.4rem 1rem' }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {filtered.length === 0 && (
          <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No hay registros en este estado.
          </div>
        )}
        {filtered.slice().reverse().map(r => {
          const esPropio = r.autor_id === currentUser?.id;
          const esDup = duplicados.has(r.id);
          const b = r.estado_validacion;
          return (
            <div key={r.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', borderLeft: `4px solid ${b === 'validado' ? '#10b981' : b === 'rechazado' ? '#ef4444' : '#eab308'}` }}>
              <div className="flex-between" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <strong style={{ color: 'var(--primary-light)' }}>{formName(r.formulario_id)}</strong>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Unidad: {unitName(r.unidad_id)} · Autor: {r.autor_id} · {new Date(r.capturado_at).toLocaleString()}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  {esDup && <span className="badge badge-danger" style={{ fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}><Copy size={11} /> Posible duplicado</span>}
                  <SignatureVerifier record={r} />
                  <span className={`badge ${b === 'validado' ? 'badge-success' : b === 'rechazado' ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>{b}</span>
                </div>
              </div>

              {/* Datos capturados */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.4rem', fontSize: '0.78rem', background: 'rgba(0,0,0,0.12)', padding: '0.75rem', borderRadius: '6px' }}>
                {Object.entries(r.datos || {}).filter(([k]) => k !== 'geopunto').map(([k, v]) => (
                  <div key={k}><span style={{ color: 'var(--text-muted)' }}>{k}:</span> <strong>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</strong></div>
                ))}
                {r.geopunto && <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: 'var(--text-muted)' }}><MapPin size={11} /> {r.geopunto.lat?.toFixed(4)}, {r.geopunto.lng?.toFixed(4)}</div>}
              </div>

              {r.motivo_rechazo && <div style={{ color: '#fca5a5', fontSize: '0.8rem' }}>Motivo de rechazo: {r.motivo_rechazo}</div>}

              {/* Acciones de validación */}
              {canValidate && b === 'pendiente' && (
                esPropio ? (
                  <div className="badge badge-warning" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: 'fit-content', fontSize: '0.72rem' }}>
                    <AlertTriangle size={13} /> Segregación de funciones: no puedes validar un registro que capturaste tú.
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                      placeholder="Motivo (obligatorio para rechazar)"
                      value={motivos[r.id] || ''}
                      onChange={e => setMotivos({ ...motivos, [r.id]: e.target.value })}
                      style={{ flex: 1, minWidth: '220px', padding: '0.4rem 0.6rem' }}
                    />
                    <button onClick={() => doValidate(r, true)} className="btn btn-primary" style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }}><Check size={14} /> Validar</button>
                    <button onClick={() => doValidate(r, false)} className="btn btn-danger" style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }}><X size={14} /> Rechazar</button>
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
