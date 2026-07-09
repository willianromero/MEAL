import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useTenant } from '../context/TenantContext';
import { CAP, can } from '../lib/roles';
import SignatureVerifier from '../components/SignatureVerifier';
import { exportToCsv } from '../lib/exportCsv';
import { ScrollText, Download, Info, Lock } from 'lucide-react';

// Bitácora de auditoría inmutable (DRT M13, RF-SEG-2). Solo lectura: registra
// quién hizo qué y cuándo sobre operaciones sensibles. Append-only por diseño
// (en el backend, RLS revoca UPDATE/DELETE sobre audit_log).
export default function AuditLog() {
  const { activeTenantId, capabilities } = useTenant();
  const canView = can(capabilities, CAP.VIEW_AUDIT);

  const entries = useLiveQuery(
    () => (activeTenantId ? db.audit_log.where('tenant_id').equals(activeTenantId).toArray() : Promise.resolve([])),
    [activeTenantId], []
  );
  const [filtro, setFiltro] = useState('all');

  if (!canView) {
    return (
      <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <Lock size={28} style={{ marginBottom: '0.5rem' }} /><p>Tu rol no tiene acceso a la bitácora de auditoría.</p>
      </div>
    );
  }

  const acciones = Array.from(new Set(entries.map(e => e.accion)));
  const filtered = (filtro === 'all' ? entries : entries.filter(e => e.accion === filtro))
    .slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const exportAudit = () => exportToCsv(`bitacora_${activeTenantId}`,
    filtered.map(e => ({ fecha: e.created_at, actor: e.actor_email || e.actor_id, accion: e.accion, entidad: e.entidad, entidad_id: e.entidad_id })));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="flex-between" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><ScrollText size={26} /> Bitácora de Auditoría</h1>
          <p>Registro inmutable de operaciones sensibles (append-only). Trazabilidad quién / qué / cuándo.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <select value={filtro} onChange={e => setFiltro(e.target.value)} style={{ padding: '0.45rem 1rem', width: 'auto' }}>
            <option value="all">Todas las acciones</option>
            {acciones.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <button onClick={exportAudit} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Download size={15} /> CSV</button>
        </div>
      </div>

      <div className="badge badge-info" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: 'fit-content', fontSize: '0.72rem' }}>
        <Info size={13} /> {entries.length} eventos registrados. Cada entrada lleva firma SHA-256 verificable.
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem', overflowX: 'auto' }}>
        <table className="table" style={{ width: '100%', minWidth: '640px' }}>
          <thead><tr><th>Fecha</th><th>Actor</th><th>Acción</th><th>Entidad</th><th>Integridad</th></tr></thead>
          <tbody>
            {filtered.map(e => (
              <tr key={e.id}>
                <td style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{new Date(e.created_at).toLocaleString()}</td>
                <td style={{ fontSize: '0.8rem' }}>{e.actor_email || e.actor_id || 'sistema'}</td>
                <td><span className="badge" style={{ fontSize: '0.65rem', background: 'rgba(5,150,105,0.12)', color: '#a7f3d0' }}>{e.accion}</span></td>
                <td style={{ fontSize: '0.78rem' }}>{e.entidad} <span style={{ color: 'var(--text-muted)' }}>#{(e.entidad_id || '').slice(0, 12)}</span></td>
                <td><SignatureVerifier record={e} /></td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>Sin eventos para este filtro.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
