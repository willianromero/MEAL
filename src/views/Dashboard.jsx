import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useTenant } from '../context/TenantContext';
import { computeIndicatorValue, semaforo, progresoPct } from '../lib/indicatorEngine';
import { exportToCsv } from '../lib/exportCsv';
import {
  Briefcase, TrendingUp, ClipboardList, MessageSquare, Download,
  LayoutDashboard, Layers, MapPin, AlertTriangle, DollarSign, CheckCircle2
} from 'lucide-react';

const SEM_COLOR = { verde: '#10b981', amarillo: '#eab308', rojo: '#ef4444' };

export default function Dashboard({ setCurrentView }) {
  const { activeTenantId, activeTenant } = useTenant();
  const byTenant = (store) => () =>
    activeTenantId ? store.where('tenant_id').equals(activeTenantId).toArray() : Promise.resolve([]);

  // Se excluyen los elementos de configuración archivados de los consolidados.
  const projects = (useLiveQuery(byTenant(db.projects), [activeTenantId]) || []).filter(p => !p.archivado);
  const indicators = (useLiveQuery(byTenant(db.indicators), [activeTenantId]) || []).filter(i => !i.archivado);
  const lines = (useLiveQuery(byTenant(db.program_lines), [activeTenantId]) || []).filter(l => !l.archivado);
  const units = (useLiveQuery(byTenant(db.units), [activeTenantId]) || []).filter(u => !u.archivado);
  const records = useLiveQuery(byTenant(db.field_records), [activeTenantId]) || [];
  const feedbacks = useLiveQuery(byTenant(db.feedbacks), [activeTenantId]) || [];

  const [tab, setTab] = useState('ejecutivo');
  const [filtroLinea, setFiltroLinea] = useState('all');

  // Calcula valor + semáforo de cada indicador sobre registros validados
  const indCalc = useMemo(() => indicators.map(ind => {
    const formula = ind.formula;
    const valor = formula ? computeIndicatorValue(ind, records) : (ind.actual || 0);
    return { ...ind, valorCalc: valor, sem: semaforo(valor, ind.target), pct: progresoPct(valor, ind.target) };
  }), [indicators, records]);

  const indFiltered = filtroLinea === 'all' ? indCalc : indCalc.filter(i => i.linea_id === filtroLinea);

  const avanceFisico = indFiltered.length ? Math.round(indFiltered.reduce((a, i) => a + i.pct, 0) / indFiltered.length) : 0;
  const enRiesgo = indFiltered.filter(i => i.sem === 'rojo').length;
  const validados = records.filter(r => r.estado_validacion === 'validado').length;
  const pqrsAbiertas = feedbacks.filter(f => f.estado && f.estado !== 'cerrada' && f.estado !== 'retroalimentada').length;

  const lineName = (id) => lines.find(l => l.id === id)?.nombre || 'Sin línea';
  const unitName = (id) => units.find(u => u.id === id)?.nombre || '—';

  const TABS = [
    ['ejecutivo', 'Resumen ejecutivo', <LayoutDashboard size={15} />],
    ['linea', 'Por línea', <Layers size={15} />],
    ['comunidad', 'Por unidad', <MapPin size={15} />],
    ['solicitudes', 'Solicitudes/Apoyos', <ClipboardList size={15} />],
    ['riesgos', 'Riesgos y PQRS', <AlertTriangle size={15} />],
    ['financiero', 'Físico vs financiero', <DollarSign size={15} />]
  ];

  const exportIndicators = () => exportToCsv(`indicadores_${activeTenantId}`,
    indFiltered.map(i => ({ codigo: i.code, nombre: i.name, linea: lineName(i.linea_id), meta: i.target, valor: i.valorCalc, avance_pct: i.pct, semaforo: i.sem, linea_base: i.linea_base_valor })));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="flex-between" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>Tablero de Control MEAL</h1>
          <p>Proyecto: <strong style={{ color: 'var(--primary-light)' }}>{activeTenant?.nombre || '—'}</strong></p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={filtroLinea} onChange={e => setFiltroLinea(e.target.value)} style={{ padding: '0.45rem 1rem', width: 'auto' }}>
            <option value="all">Todas las líneas</option>
            {lines.map(l => <option key={l.id} value={l.id}>{l.codigo} · {l.nombre}</option>)}
          </select>
          <button onClick={exportIndicators} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Download size={15} /> Exportar CSV
          </button>
        </div>
      </div>

      {/* KPIs principales */}
      <div className="metrics-grid">
        <Kpi icon={<Briefcase size={22} />} label="Proyectos activos" value={`${projects.filter(p => p.status === 'active').length}/${projects.length}`} color="var(--primary-light)" />
        <Kpi icon={<TrendingUp size={22} />} label="Avance físico (filtro)" value={`${avanceFisico}%`} color="var(--secondary-light)" />
        <Kpi icon={<CheckCircle2 size={22} />} label="Registros validados" value={validados} color="#38bdf8" />
        <Kpi icon={<AlertTriangle size={22} />} label="Indicadores en rojo" value={enRiesgo} color="#fca5a5" />
        <Kpi icon={<MessageSquare size={22} />} label="PQRS abiertas" value={pqrsAbiertas} color="#fef08a" />
      </div>

      {/* Tabs de las 6 vistas mínimas (DRT 10.1) */}
      <div className="glass-panel" style={{ padding: '0.4rem', display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
        {TABS.map(([id, label, icon]) => (
          <button key={id} onClick={() => setTab(id)} className="btn"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: tab === id ? 'var(--bg-dark)' : 'transparent', borderColor: tab === id ? 'var(--border-glass)' : 'transparent', color: tab === id ? 'var(--primary-light)' : 'var(--text-secondary)', fontSize: '0.78rem', padding: '0.4rem 0.85rem' }}>
            {icon} {label}
          </button>
        ))}
      </div>

      {/* RESUMEN EJECUTIVO */}
      {tab === 'ejecutivo' && (
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3>Avance de indicadores vs meta y línea base</h3>
          {indFiltered.length === 0 && <div style={{ color: 'var(--text-muted)' }}>No hay indicadores para el filtro seleccionado.</div>}
          {indFiltered.map(i => (
            <div key={i.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div className="flex-between" style={{ fontSize: '0.85rem' }}>
                <span style={{ fontWeight: 600, maxWidth: '70%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={i.name}>
                  <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', marginRight: '0.4rem' }}>{i.code}</span>{i.name}
                </span>
                <span style={{ color: SEM_COLOR[i.sem], fontWeight: 'bold' }}>{i.pct}%</span>
              </div>
              <div className="progress-bar-bg" style={{ height: '9px' }}>
                <div className="progress-bar-fill" style={{ width: `${i.pct}%`, background: SEM_COLOR[i.sem] }}></div>
              </div>
              <div className="flex-between" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                <span>Línea base: {i.linea_base_valor ?? '—'} {i.linea_base_congelada ? '🔒' : ''}</span>
                <span>Valor: {i.valorCalc} / Meta: {i.target ?? '—'} {i.unit}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* POR LÍNEA */}
      {tab === 'linea' && (
        <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {lines.map(l => {
            const lis = indCalc.filter(i => i.linea_id === l.id);
            const avance = lis.length ? Math.round(lis.reduce((a, i) => a + i.pct, 0) / lis.length) : 0;
            const rojo = lis.filter(i => i.sem === 'rojo').length;
            return (
              <div key={l.id} className="glass-card" style={{ padding: '1.25rem' }}>
                <div className="flex-between"><strong>{l.codigo}</strong><span className="badge" style={{ fontSize: '0.62rem' }}>{l.tipo}</span></div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.35rem 0' }}>{l.nombre}</div>
                <div className="progress-bar-bg" style={{ height: '8px' }}><div className="progress-bar-fill" style={{ width: `${avance}%` }}></div></div>
                <div className="flex-between" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  <span>{lis.length} indicadores</span><span>{avance}% avance{rojo ? ` · ${rojo} en rojo` : ''}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* POR UNIDAD */}
      {tab === 'comunidad' && (
        <div className="glass-panel" style={{ padding: '1.5rem', overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', minWidth: '480px' }}>
            <thead><tr><th>Unidad</th><th>Municipio</th><th>Registros validados</th><th>Pendientes</th></tr></thead>
            <tbody>
              {units.map(u => {
                const rs = records.filter(r => r.unidad_id === u.id);
                return (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.nombre}</td>
                    <td style={{ textTransform: 'capitalize' }}>{u.municipio || '—'}</td>
                    <td>{rs.filter(r => r.estado_validacion === 'validado').length}</td>
                    <td>{rs.filter(r => r.estado_validacion === 'pendiente').length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* SOLICITUDES / APOYOS (L2–L5) */}
      {tab === 'solicitudes' && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Registros por formulario (volumen y estado)</h3>
          <RecordsByForm records={records} />
        </div>
      )}

      {/* RIESGOS Y PQRS */}
      {tab === 'riesgos' && (
        <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {['rojo', 'naranja', 'amarillo', 'verde'].map(nivel => {
            const items = feedbacks.filter(f => f.nivel === nivel);
            const color = { rojo: '#ef4444', naranja: '#f97316', amarillo: '#eab308', verde: '#10b981' }[nivel];
            return (
              <div key={nivel} className="glass-card" style={{ padding: '1.25rem', borderLeft: `4px solid ${color}` }}>
                <div style={{ textTransform: 'capitalize', fontWeight: 700, color }}>{nivel}</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{items.length}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>PQRS nivel {nivel}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* FÍSICO VS FINANCIERO */}
      {tab === 'financiero' && (
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="flex-between">
            <div><div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Avance físico global</div><div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary-light)' }}>{avanceFisico}%</div></div>
            <div><div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Avance financiero</div><div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-muted)' }}>—</div></div>
          </div>
          <div className="badge badge-info" style={{ width: 'fit-content', fontSize: '0.72rem' }}>
            El avance financiero lo alimenta el Profesional Administrativo y Financiero (módulo financiero, Fase futura).
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ icon, label, value, color }) {
  return (
    <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.1rem 1.25rem' }}>
      <div style={{ background: 'rgba(255,255,255,0.05)', color, padding: '0.65rem', borderRadius: '12px' }}>{icon}</div>
      <div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{label}</div>
        <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{value}</div>
      </div>
    </div>
  );
}

function RecordsByForm({ records }) {
  const byForm = records.reduce((acc, r) => {
    const k = r.formulario_id;
    acc[k] = acc[k] || { total: 0, validado: 0, pendiente: 0, rechazado: 0 };
    acc[k].total += 1; acc[k][r.estado_validacion] = (acc[k][r.estado_validacion] || 0) + 1;
    return acc;
  }, {});
  const rows = Object.entries(byForm);
  if (rows.length === 0) return <div style={{ color: 'var(--text-muted)' }}>Sin registros capturados aún.</div>;
  return (
    <table className="table" style={{ width: '100%' }}>
      <thead><tr><th>Formulario</th><th>Total</th><th>Validados</th><th>Pendientes</th><th>Rechazados</th></tr></thead>
      <tbody>
        {rows.map(([id, s]) => (
          <tr key={id}><td>{id}</td><td>{s.total}</td><td>{s.validado || 0}</td><td>{s.pendiente || 0}</td><td>{s.rechazado || 0}</td></tr>
        ))}
      </tbody>
    </table>
  );
}
