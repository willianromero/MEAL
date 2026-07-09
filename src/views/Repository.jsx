import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useTenant } from '../context/TenantContext';
import { CAP, can } from '../lib/roles';
import { FolderOpen, FileText, Image, MapPin, ShieldCheck, Search, Info } from 'lucide-react';

// Repositorio documental (DRT M11, RF-DOC-1..3). Evidencias organizadas por
// línea / unidad / período, cada una enlazada a su registro → indicador →
// responsable, con metadatos y hash de integridad.
export default function Repository() {
  const { activeTenantId, capabilities } = useTenant();
  const canView = can(capabilities, CAP.VIEW_CATALOG);

  const byTenant = (store) => () =>
    activeTenantId ? store.where('tenant_id').equals(activeTenantId).toArray() : Promise.resolve([]);
  const evidences = useLiveQuery(byTenant(db.evidences), [activeTenantId]) || [];
  const records = useLiveQuery(byTenant(db.field_records), [activeTenantId]) || [];
  const forms = useLiveQuery(byTenant(db.forms), [activeTenantId]) || [];
  const units = useLiveQuery(byTenant(db.units), [activeTenantId]) || [];
  const lines = useLiveQuery(byTenant(db.program_lines), [activeTenantId]) || [];

  const [q, setQ] = useState('');
  const [groupBy, setGroupBy] = useState('unidad');

  const recordById = useMemo(() => Object.fromEntries(records.map(r => [r.id, r])), [records]);
  const formById = useMemo(() => Object.fromEntries(forms.map(f => [f.id, f])), [forms]);
  const unitName = (id) => units.find(u => u.id === id)?.nombre || 'Sin unidad';
  const lineName = (id) => lines.find(l => l.id === id)?.nombre || 'Sin línea';

  // Enriquecer cada evidencia con su trazabilidad (RF-DOC-2)
  const items = useMemo(() => evidences.map(ev => {
    const rec = recordById[ev.registro_id];
    const form = rec ? formById[rec.formulario_id] : null;
    const unidad = rec?.unidad_id;
    const linea = form?.linea_id;
    const periodo = (rec?.capturado_at || ev.tomada_at || '').slice(0, 7);
    return { ...ev, rec, form, unidad, linea, periodo, autor: rec?.autor_id };
  }), [evidences, recordById, formById]);

  const filtered = items.filter(it => {
    if (!q) return true;
    const hay = `${it.nombre_archivo} ${unitName(it.unidad)} ${lineName(it.linea)} ${it.form?.nombre || ''}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  const groups = useMemo(() => {
    const g = {};
    for (const it of filtered) {
      const key = groupBy === 'unidad' ? unitName(it.unidad) : groupBy === 'linea' ? lineName(it.linea) : (it.periodo || 'Sin período');
      (g[key] = g[key] || []).push(it);
    }
    return g;
  }, [filtered, groupBy]);

  if (!canView) {
    return <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}><Info size={26} /><p>Sin acceso al repositorio.</p></div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><FolderOpen size={26} /> Repositorio Documental</h1>
        <p>Banco de evidencias trazable: cada archivo enlazado a su registro, formulario, unidad y responsable.</p>
      </div>

      <div className="glass-panel" style={{ padding: '1rem 1.5rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <Search size={15} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por unidad, línea, formulario..." style={{ paddingLeft: '2rem', width: '100%' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Agrupar por:</span>
          <select value={groupBy} onChange={e => setGroupBy(e.target.value)} style={{ padding: '0.4rem 1rem', width: 'auto' }}>
            <option value="unidad">Unidad</option><option value="linea">Línea</option><option value="periodo">Período</option>
          </select>
        </div>
      </div>

      {evidences.length === 0 && (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Aún no hay evidencias en el repositorio. Se registran al adjuntar fotos/documentos en la captura de campo.
        </div>
      )}

      {Object.entries(groups).map(([grupo, its]) => (
        <div key={grupo} className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>{grupo} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>· {its.length} evidencias</span></h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
            {its.map(it => (
              <div key={it.id} className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {it.tipo === 'foto' ? <Image size={16} style={{ color: 'var(--primary-light)' }} /> : <FileText size={16} style={{ color: 'var(--primary-light)' }} />}
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.nombre_archivo}</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <span>Formulario: {it.form?.nombre || '—'}</span>
                  <span>Unidad: {unitName(it.unidad)}</span>
                  <span>Responsable: {it.autor || '—'}</span>
                  {it.geopunto && <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}><MapPin size={10} /> {it.geopunto.lat?.toFixed(4)}, {it.geopunto.lng?.toFixed(4)}</span>}
                  <span>Período: {it.periodo || '—'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.65rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-glass)', paddingTop: '0.4rem' }}>
                  <ShieldCheck size={11} style={{ color: 'var(--primary-light)' }} /> hash {(it.hash || '').slice(0, 16)}…
                  <span style={{ marginLeft: 'auto' }} className={`badge ${it.sync_status === 'synced' ? 'badge-success' : 'badge-warning'}`}>{it.url_objeto ? 'en almacén' : 'local'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
