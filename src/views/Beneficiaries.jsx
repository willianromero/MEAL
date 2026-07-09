import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addWithSignature, logAudit } from '../db';
import { updatePendingCount } from '../syncEngine';
import { useTenant } from '../context/TenantContext';
import { CAP, can } from '../lib/roles';
import { encryptField, decryptField, documentHash } from '../lib/crypto';
import { Users, ShieldCheck, Plus, Save, Info, Lock, Eye, EyeOff } from 'lucide-react';

// Beneficiarios + consentimiento informado (DRT M12, HU-07). Los datos personales
// se cifran en cliente (AES-GCM) antes de guardarse/sincronizar. No se puede
// registrar un beneficiario sin consentimiento otorgado (Ley 1581/2012).
export default function Beneficiaries({ currentUser }) {
  const { activeTenantId, activeTenant, capabilities } = useTenant();
  const canManage = can(capabilities, CAP.MANAGE_BENEFICIARIES);
  const finalidad = activeTenant?.config?.consentimiento?.finalidad || 'Fines del proyecto conforme a la Ley 1581 de 2012.';

  const byTenant = (store) => () =>
    activeTenantId ? store.where('tenant_id').equals(activeTenantId).toArray() : Promise.resolve([]);
  const beneficiaries = useLiveQuery(byTenant(db.beneficiaries), [activeTenantId]) || [];
  const units = useLiveQuery(byTenant(db.units), [activeTenantId]) || [];

  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [documento, setDocumento] = useState('');
  const [sexo, setSexo] = useState('sin_dato');
  const [edad, setEdad] = useState('sin_dato');
  const [unidadId, setUnidadId] = useState('');
  const [consentMedio, setConsentMedio] = useState('fisico');
  const [consentOtorgado, setConsentOtorgado] = useState(false);
  const [msg, setMsg] = useState('');
  const [revealed, setRevealed] = useState({}); // descifrado bajo demanda

  const save = async (e) => {
    e.preventDefault();
    if (!canManage) return;
    if (!consentOtorgado) { setMsg('No se puede registrar sin consentimiento otorgado (Ley 1581/2012).'); return; }
    if (!nombres || !documento) return;

    const now = new Date().toISOString();
    const benId = `ben-${activeTenantId}-${Math.random().toString(36).slice(2, 8)}`;
    const consentId = `con-${activeTenantId}-${Math.random().toString(36).slice(2, 8)}`;

    // 1. Consentimiento (debe existir y estar otorgado antes de usar el dato)
    await addWithSignature(db.consents, {
      id: consentId, tenant_id: activeTenantId, beneficiario_id: benId,
      otorgado: true, fecha: now, medio: consentMedio, finalidad,
      evidencia_id: null, updated_at: now, sync_status: 'pending_sync'
    });

    // 2. Beneficiario con campos sensibles CIFRADOS (AES-GCM) + hash de documento
    const [nomEnc, apeEnc, docEnc, docHash] = await Promise.all([
      encryptField(nombres, activeTenantId),
      encryptField(apellidos, activeTenantId),
      encryptField(documento, activeTenantId),
      documentHash(documento, activeTenantId)
    ]);
    await addWithSignature(db.beneficiaries, {
      id: benId, tenant_id: activeTenantId, unidad_id: unidadId || null,
      nombres_cifrado: nomEnc, apellidos_cifrado: apeEnc, documento_cifrado: docEnc,
      documento_hash: docHash, sexo, edad_rango: edad,
      consentimiento_id: consentId, created_by: currentUser?.id,
      updated_at: now, sync_status: 'pending_sync'
    });

    await logAudit({ tenantId: activeTenantId, actorId: currentUser?.id, actorEmail: currentUser?.email, accion: 'crear', entidad: 'beneficiaries', entidadId: benId, despues: { documento_hash: docHash, consentimiento: true } });
    await updatePendingCount();
    setMsg('Beneficiario registrado con datos cifrados y consentimiento (Habeas Data).');
    setNombres(''); setApellidos(''); setDocumento(''); setSexo('sin_dato'); setEdad('sin_dato'); setUnidadId(''); setConsentOtorgado(false);
  };

  const reveal = async (b) => {
    if (revealed[b.id]) { setRevealed(prev => { const n = { ...prev }; delete n[b.id]; return n; }); return; }
    const [nom, ape, doc] = await Promise.all([
      decryptField(b.nombres_cifrado, activeTenantId),
      decryptField(b.apellidos_cifrado, activeTenantId),
      decryptField(b.documento_cifrado, activeTenantId)
    ]);
    setRevealed(prev => ({ ...prev, [b.id]: { nom, ape, doc } }));
    // Ver un dato personal es una operación sensible → bitácora (RF-SEG-2)
    await logAudit({ tenantId: activeTenantId, actorId: currentUser?.id, actorEmail: currentUser?.email, accion: 'acceso_dato_personal', entidad: 'beneficiaries', entidadId: b.id });
  };

  const unitName = (id) => units.find(u => u.id === id)?.nombre || '—';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Users size={26} /> Beneficiarios y Habeas Data</h1>
        <p>Datos personales cifrados en el dispositivo (AES-GCM). Registro sujeto a consentimiento informado (Ley 1581/2012).</p>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: canManage ? '2fr 1fr' : '1fr' }}>
        <div className="glass-panel" style={{ padding: '1.5rem', overflowX: 'auto' }}>
          <h3 style={{ marginBottom: '1rem' }}>Beneficiarios registrados ({beneficiaries.length})</h3>
          <table className="table" style={{ width: '100%', minWidth: '520px' }}>
            <thead><tr><th>Beneficiario</th><th>Unidad</th><th>Sexo / Edad</th><th>Consentimiento</th><th style={{ textAlign: 'right' }}>Dato personal</th></tr></thead>
            <tbody>
              {beneficiaries.map(b => {
                const r = revealed[b.id];
                return (
                  <tr key={b.id}>
                    <td>
                      {r ? (
                        <div><div style={{ fontWeight: 600 }}>{r.nom} {r.ape}</div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Doc: {r.doc}</div></div>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}><Lock size={12} /> Cifrado</span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.82rem' }}>{unitName(b.unidad_id)}</td>
                    <td style={{ fontSize: '0.78rem', textTransform: 'capitalize' }}>{b.sexo} / {b.edad_rango}</td>
                    <td><span className="badge badge-success" style={{ fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: '0.2rem', width: 'fit-content' }}><ShieldCheck size={11} /> Otorgado</span></td>
                    <td style={{ textAlign: 'right' }}>
                      {canManage && (
                        <button onClick={() => reveal(b)} className="btn btn-secondary" style={{ padding: '0.3rem 0.55rem', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          {r ? <><EyeOff size={12} /> Ocultar</> : <><Eye size={12} /> Descifrar</>}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {beneficiaries.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>Sin beneficiarios registrados.</td></tr>}
            </tbody>
          </table>
        </div>

        {canManage && (
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Plus size={18} /> Nuevo beneficiario</h3>
            {msg && <div className="badge badge-info" style={{ display: 'block', padding: '0.5rem', marginBottom: '0.85rem', fontSize: '0.72rem', whiteSpace: 'normal' }}>{msg}</div>}
            <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="form-group"><label>Nombres *</label><input value={nombres} onChange={e => setNombres(e.target.value)} required /></div>
              <div className="form-group"><label>Apellidos</label><input value={apellidos} onChange={e => setApellidos(e.target.value)} /></div>
              <div className="form-group"><label>Documento *</label><input value={documento} onChange={e => setDocumento(e.target.value)} required /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                <div className="form-group"><label>Sexo</label>
                  <select value={sexo} onChange={e => setSexo(e.target.value)}>
                    <option value="sin_dato">Sin dato</option><option value="femenino">Femenino</option><option value="masculino">Masculino</option><option value="otro">Otro</option>
                  </select>
                </div>
                <div className="form-group"><label>Rango de edad</label>
                  <select value={edad} onChange={e => setEdad(e.target.value)}>
                    <option value="sin_dato">Sin dato</option><option value="ninez">Niñez</option><option value="juventud">Juventud</option><option value="adultez">Adultez</option><option value="mayor">Mayor</option>
                  </select>
                </div>
              </div>
              <div className="form-group"><label>Unidad de análisis</label>
                <select value={unidadId} onChange={e => setUnidadId(e.target.value)}>
                  <option value="">-- Seleccionar --</option>
                  {units.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                </select>
              </div>

              {/* Consentimiento informado obligatorio */}
              <div style={{ background: 'rgba(5,150,105,0.03)', border: '1px dashed var(--primary-color)', padding: '0.85rem', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}><strong>Finalidad:</strong> {finalidad}</div>
                <div className="form-group" style={{ marginBottom: 0 }}><label>Medio del consentimiento</label>
                  <select value={consentMedio} onChange={e => setConsentMedio(e.target.value)}>
                    <option value="fisico">Físico (firma en papel)</option><option value="digital">Digital</option><option value="verbal_testificado">Verbal testificado</option>
                  </select>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={consentOtorgado} onChange={e => setConsentOtorgado(e.target.checked)} style={{ width: 'auto' }} />
                  El titular otorgó su consentimiento informado
                </label>
              </div>

              <button type="submit" className="btn btn-primary" disabled={!consentOtorgado}><Save size={14} /> Registrar (cifrado)</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
