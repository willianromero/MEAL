import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addWithSignature, putWithSignature, logAudit } from '../db';
import { updatePendingCount } from '../syncEngine';
import { useTenant } from '../context/TenantContext';
import { CAP, can } from '../lib/roles';
import { DEFAULT_PQRS_LEVELS } from '../seeds/seedEngine';
import SignatureVerifier from '../components/SignatureVerifier';
import { MessageSquare, Send, CheckCircle2, AlertCircle, Info, Clock, EyeOff, ShieldAlert } from 'lucide-react';

// PQRS / alertas tempranas (DRT M10, RF-PQR-1..5, Anexo B, HU-06).
// Niveles Verde/Amarillo/Naranja/Rojo con SLA configurable por tenant y flujo
// de estados recibida→clasificada→asignada→en_atencion→escalada→cerrada→retroalimentada.
const ESTADOS = ['recibida', 'clasificada', 'asignada', 'en_atencion', 'escalada', 'cerrada', 'retroalimentada'];
const NIVEL_COLOR = { verde: '#10b981', amarillo: '#eab308', naranja: '#f97316', rojo: '#ef4444' };

export default function Feedback({ currentUser }) {
  const { activeTenantId, activeTenant, capabilities } = useTenant();
  const canManage = can(capabilities, CAP.MANAGE_PQRS);
  const canSeeIdentity = can(capabilities, CAP.VIEW_PQRS_IDENTITY);
  const niveles = activeTenant?.config?.pqrs_niveles || DEFAULT_PQRS_LEVELS;

  const byTenant = (store) => () =>
    activeTenantId ? store.where('tenant_id').equals(activeTenantId).toArray() : Promise.resolve([]);
  const feedbacks = useLiveQuery(byTenant(db.feedbacks), [activeTenantId]) || [];
  const units = useLiveQuery(byTenant(db.units), [activeTenantId]) || [];

  const [tab, setTab] = useState('inbox');
  const [canal, setCanal] = useState('presencial');
  const [unidadId, setUnidadId] = useState('');
  const [nivel, setNivel] = useState('verde');
  const [details, setDetails] = useState('');
  const [reportante, setReportante] = useState('');
  const [anonimo, setAnonimo] = useState(false);
  const [ok, setOk] = useState(false);
  const [respMap, setRespMap] = useState({});

  const slaHoras = (n) => (niveles.find(x => x.nivel === n)?.sla_horas ?? 72);

  const submit = async (e) => {
    e.preventDefault();
    if (!details) return;
    const now = new Date();
    const nowIso = now.toISOString();
    const horas = slaHoras(nivel);
    const slaLimite = new Date(now.getTime() + horas * 3600 * 1000).toISOString();
    const id = `pqrs-${activeTenantId}-${Math.random().toString(36).slice(2, 8)}`;

    await addWithSignature(db.feedbacks, {
      id, tenant_id: activeTenantId, project_id: null, unidad_id: unidadId || null,
      category: 'pqrs', canal, nivel, details,
      contact_info: anonimo ? null : (reportante || null),
      reportante_reservado: true,
      is_confidential: anonimo,
      responsable_id: null,
      sla_limite: slaLimite,
      estado: 'recibida',
      status: 'pending',
      response_text: null,
      historial: [{ estado: 'recibida', at: nowIso, por: currentUser?.email || 'anon' }],
      created_at: nowIso, updated_at: nowIso, sync_status: 'pending_sync'
    });
    await logAudit({ tenantId: activeTenantId, actorId: currentUser?.id, actorEmail: currentUser?.email, accion: 'crear', entidad: 'feedbacks', entidadId: id, despues: { nivel } });
    await updatePendingCount();
    setDetails(''); setReportante(''); setAnonimo(false); setNivel('verde'); setCanal('presencial'); setUnidadId('');
    setOk(true); setTimeout(() => { setOk(false); setTab('inbox'); }, 1800);
  };

  const advance = async (fb, nuevoEstado) => {
    if (!canManage) return;
    const now = new Date().toISOString();
    const historial = [...(fb.historial || []), { estado: nuevoEstado, at: now, por: currentUser?.email || 'anon' }];
    await putWithSignature(db.feedbacks, {
      ...fb, estado: nuevoEstado, historial,
      responsable_id: nuevoEstado === 'asignada' ? (currentUser?.id || fb.responsable_id) : fb.responsable_id,
      response_text: respMap[fb.id] != null ? respMap[fb.id] : fb.response_text,
      updated_at: now, sync_status: 'pending_sync'
    });
    await logAudit({ tenantId: activeTenantId, actorId: currentUser?.id, actorEmail: currentUser?.email, accion: 'pqrs_estado', entidad: 'feedbacks', entidadId: fb.id, antes: { estado: fb.estado }, despues: { estado: nuevoEstado } });
    await updatePendingCount();
  };

  const slaInfo = (fb) => {
    if (['cerrada', 'retroalimentada'].includes(fb.estado)) return { txt: 'Cerrada', cls: 'badge-success', icon: <CheckCircle2 size={11} /> };
    if (!fb.sla_limite) return { txt: 'Sin SLA', cls: 'badge-info', icon: <Clock size={11} /> };
    const rem = new Date(fb.sla_limite).getTime() - Date.now();
    const hrs = Math.round(rem / 3600000);
    if (rem < 0) return { txt: `Vencido (${Math.abs(hrs)}h)`, cls: 'badge-danger', icon: <AlertCircle size={11} /> };
    return { txt: `${hrs}h restantes`, cls: hrs <= 12 ? 'badge-warning' : 'badge-success', icon: <Clock size={11} /> };
  };

  // Indicadores PQRS (RF-PQR-5)
  const total = feedbacks.length;
  const cerradas = feedbacks.filter(f => ['cerrada', 'retroalimentada'].includes(f.estado)).length;
  const enTiempo = feedbacks.filter(f => f.sla_limite && (['cerrada', 'retroalimentada'].includes(f.estado) || new Date(f.sla_limite) > new Date())).length;
  const pctCerradas = total ? Math.round((cerradas / total) * 100) : 0;
  const pctEnTiempo = total ? Math.round((enTiempo / total) * 100) : 0;

  const unitName = (id) => units.find(u => u.id === id)?.nombre || '—';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><MessageSquare size={26} /> PQRS y Alertas Tempranas</h1>
        <p>Mecanismo de quejas, reclamos y alertas clasificadas por nivel con SLA y flujo de atención (Anexo B).</p>
      </div>

      {/* Indicadores PQRS */}
      <div className="metrics-grid">
        {[['Total', total], ['% cerradas', `${pctCerradas}%`], ['% en tiempo', `${pctEnTiempo}%`], ['Abiertas', total - cerradas]].map(([l, v]) => (
          <div key={l} className="glass-card" style={{ padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{l}</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>{v}</div>
          </div>
        ))}
      </div>

      <div className="glass-panel" style={{ padding: '0.5rem', display: 'flex', gap: '0.5rem', width: 'fit-content' }}>
        {[['inbox', 'Bandeja'], ['report', 'Registrar PQRS']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className="btn"
            style={{ background: tab === id ? 'var(--bg-dark)' : 'transparent', borderColor: tab === id ? 'var(--border-glass)' : 'transparent', color: tab === id ? 'var(--primary-light)' : 'var(--text-secondary)', fontSize: '0.82rem', padding: '0.4rem 1rem' }}>
            {label}
          </button>
        ))}
      </div>

      {/* REGISTRAR */}
      {tab === 'report' && (
        <div className="glass-panel" style={{ padding: '2rem', maxWidth: '760px' }}>
          {ok ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem 0', gap: '0.75rem' }}>
              <div style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--status-online)', padding: '1rem', borderRadius: '50%' }}><CheckCircle2 size={40} /></div>
              <h3 style={{ margin: 0 }}>PQRS registrada</h3>
              <p style={{ fontSize: '0.85rem', margin: 0 }}>SLA calculado según el nivel. Identidad del reportante reservada.</p>
            </div>
          ) : (
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group"><label>Canal</label>
                  <select value={canal} onChange={e => setCanal(e.target.value)}>
                    {['telefono', 'whatsapp', 'presencial', 'autoridad', 'correo', 'buzon', 'anonimo'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Unidad / Comunidad</label>
                  <select value={unidadId} onChange={e => setUnidadId(e.target.value)}>
                    <option value="">-- Seleccionar --</option>
                    {units.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group"><label>Nivel de la alerta (define el SLA)</label>
                <select value={nivel} onChange={e => setNivel(e.target.value)}>
                  {niveles.map(n => <option key={n.nivel} value={n.nivel}>{n.nivel.toUpperCase()} — SLA {n.sla_horas === 0 ? 'inmediato' : `${n.sla_horas}h`} · {n.descripcion}</option>)}
                </select>
              </div>

              <div className="form-group"><label>Descripción del caso</label>
                <textarea rows="4" value={details} onChange={e => setDetails(e.target.value)} required placeholder="Describe la situación..." />
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-glass)', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}><label>Reportante (opcional)</label>
                  <input value={reportante} onChange={e => setReportante(e.target.value)} disabled={anonimo} placeholder="Nombre y contacto o dejar vacío" />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--secondary-light)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={anonimo} onChange={e => setAnonimo(e.target.checked)} style={{ width: 'auto' }} />
                  <EyeOff size={14} /> Reporte anónimo / identidad reservada
                </label>
              </div>

              <button type="submit" className="btn btn-primary"><Send size={15} /> Registrar PQRS</button>
            </form>
          )}
        </div>
      )}

      {/* BANDEJA */}
      {tab === 'inbox' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {!canManage && (
            <div className="badge badge-info" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: 'fit-content', padding: '0.5rem 1rem' }}>
              <Info size={14} /> Consulta de PQRS. La gestión y respuesta la realizan los roles responsables.
            </div>
          )}
          {feedbacks.length === 0 && <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No hay PQRS registradas.</div>}
          {feedbacks.slice().reverse().map(fb => {
            const sla = slaInfo(fb);
            const color = NIVEL_COLOR[fb.nivel] || '#64748b';
            const maskContact = fb.is_confidential && !canSeeIdentity;
            return (
              <div key={fb.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', borderLeft: `4px solid ${color}` }}>
                <div className="flex-between" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="badge" style={{ background: `${color}22`, color, textTransform: 'uppercase', fontSize: '0.65rem' }}>{fb.nivel}</span>
                    <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>{fb.canal}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Unidad: {unitName(fb.unidad_id)}</span>
                    <SignatureVerifier record={fb} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <span className={`badge ${sla.cls}`} style={{ fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>{sla.icon} {sla.txt}</span>
                    <span className="badge" style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.06)' }}>{fb.estado}</span>
                  </div>
                </div>

                <p style={{ fontSize: '0.9rem', margin: 0, background: 'rgba(0,0,0,0.12)', padding: '0.75rem 1rem', borderRadius: '6px' }}>{fb.details}</p>

                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <span>Reportante: <strong>{maskContact ? '[RESERVADO]' : (fb.contact_info || 'Anónimo')}</strong>{fb.is_confidential && <EyeOff size={12} style={{ verticalAlign: 'middle', marginLeft: '0.2rem', color: 'var(--secondary-light)' }} />}</span>
                  <span>Registrada: {new Date(fb.created_at).toLocaleString()}</span>
                </div>

                {fb.response_text && (
                  <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '6px', fontSize: '0.82rem' }}>
                    <strong style={{ color: '#a7f3d0' }}>Retroalimentación:</strong> {fb.response_text}
                  </div>
                )}

                {/* Flujo de estados y respuesta (roles responsables) */}
                {canManage && !['retroalimentada'].includes(fb.estado) && (
                  <div style={{ borderTop: '1px dashed var(--border-glass)', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {['cerrada', 'retroalimentada'].includes(fb.estado) === false && (
                      <textarea placeholder="Nota de atención / retroalimentación al reportante..." rows="2" value={respMap[fb.id] ?? ''} onChange={e => setRespMap({ ...respMap, [fb.id]: e.target.value })} style={{ fontSize: '0.82rem' }} />
                    )}
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Avanzar a:</span>
                      {ESTADOS.slice(ESTADOS.indexOf(fb.estado) + 1).map(es => (
                        <button key={es} onClick={() => advance(fb, es)} className="btn btn-secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.7rem' }}>
                          {es === 'escalada' && <ShieldAlert size={11} style={{ marginRight: '0.2rem' }} />}{es}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
