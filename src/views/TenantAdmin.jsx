import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addWithSignature, putWithSignature, bulkPutWithSignature, logAudit } from '../db';
import { updatePendingCount } from '../syncEngine';
import { useTenant } from '../context/TenantContext';
import { CAP, can } from '../lib/roles';
import { Building2, Plus, Save, Power, Copy, ShieldCheck, Info } from 'lucide-react';

// Consola de administración de tenants (S0, RF-TEN-5/6): alta, suspensión y
// clonación de proyectos. Solo para el Administrador de Plataforma.
export default function TenantAdmin({ currentUser }) {
  const { capabilities, setActiveTenant } = useTenant();
  const canManage = can(capabilities, CAP.MANAGE_TENANTS);

  const tenants = useLiveQuery(() => db.tenants.toArray(), [], []) || [];

  const [nombre, setNombre] = useState('');
  const [financiador, setFinanciador] = useState('');
  const [unidad, setUnidad] = useState('comunidad');
  const [cloneFrom, setCloneFrom] = useState('');
  const [msg, setMsg] = useState('');

  if (!canManage) {
    return (
      <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <ShieldCheck size={32} style={{ marginBottom: '0.5rem', color: 'var(--secondary-light)' }} />
        <p>Esta consola es exclusiva del Administrador de Plataforma.</p>
      </div>
    );
  }

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!nombre) return;
    const now = new Date().toISOString();
    const id = `ten-${Math.random().toString(36).slice(2, 8)}`;
    const base = {
      id,
      nombre,
      financiador: financiador || null,
      entidad_ejecutora: 'Fundación Guajira Competitiva',
      unidad_analisis_default: unidad,
      moneda: 'COP',
      vigencia_inicio: now.slice(0, 10),
      vigencia_fin: null,
      estado: 'activo',
      config: { roles_nombres: {}, idiomas: ['es'] },
      updated_at: now,
      sync_status: 'pending_sync'
    };
    await addWithSignature(db.tenants, base);

    let clonedCount = 0;
    // RF-TEN-6: clonar configuración (líneas, formularios, indicadores) de una
    // plantilla existente. Los datos operativos NO se copian, solo la config.
    if (cloneFrom) {
      const src = { ...base }; // hereda config del tenant fuente
      const srcTenant = await db.tenants.get(cloneFrom);
      if (srcTenant) {
        await putWithSignature(db.tenants, { ...base, config: srcTenant.config, unidad_analisis_default: srcTenant.unidad_analisis_default });
      }
      for (const tableName of ['program_lines', 'forms', 'indicators']) {
        const rows = await db[tableName].where('tenant_id').equals(cloneFrom).toArray();
        const cloned = rows.map(r => ({
          ...r,
          id: `${r.id}--${id}`,
          tenant_id: id,
          project_id: null,
          logframe_id: null,
          actual: 0,
          linea_base_valor: null,
          linea_base_congelada: false,
          updated_at: now,
          sync_status: 'pending_sync'
        }));
        if (cloned.length) { await bulkPutWithSignature(db[tableName], cloned); clonedCount += cloned.length; }
      }
    }

    await logAudit({ actorId: currentUser?.id, actorEmail: currentUser?.email, accion: 'crear_tenant', entidad: 'tenants', entidadId: id, despues: { nombre, clonadoDesde: cloneFrom || null } });
    await updatePendingCount();
    setMsg(`Tenant "${nombre}" creado${cloneFrom ? ` (clonados ${clonedCount} elementos de configuración)` : ''}. Operativo sin desplegar código.`);
    setNombre(''); setFinanciador(''); setUnidad('comunidad'); setCloneFrom('');
    setActiveTenant(id);
  };

  const toggleEstado = async (t) => {
    const nuevo = t.estado === 'activo' ? 'suspendido' : 'activo';
    if (nuevo === 'suspendido') {
      const ok = confirm(
        `¿Suspender "${t.nombre}"?\n\nSus miembros (gestores, coordinadores, etc.) perderán acceso ` +
        `inmediato a los datos de este proyecto: no podrán ver ni capturar información hasta que lo ` +
        `reactives. Solo el Administrador de Plataforma puede reactivarlo.`
      );
      if (!ok) return;
    }
    await putWithSignature(db.tenants, { ...t, estado: nuevo, updated_at: new Date().toISOString(), sync_status: 'pending_sync' });
    await logAudit({ actorId: currentUser?.id, actorEmail: currentUser?.email, accion: 'cambio_estado_tenant', entidad: 'tenants', entidadId: t.id, antes: { estado: t.estado }, despues: { estado: nuevo } });
    await updatePendingCount();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Building2 size={26} /> Consola de Proyectos (Tenants)</h1>
        <p>Administración de plataforma: da de alta un proyecto nuevo por configuración, sin desarrollo (HU-12).</p>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div className="glass-panel" style={{ padding: '1.5rem', overflowX: 'auto' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>Proyectos en la plataforma ({tenants.length})</h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            "Suspender" bloquea de inmediato el acceso de los miembros del proyecto a todos sus datos
            (indicadores, registros, catálogo, PQRS…), tanto en la app como en el servidor. El proyecto
            deja de aparecer en su selector; solo tú puedes reactivarlo.
          </p>
          <table className="table" style={{ width: '100%', minWidth: '520px' }}>
            <thead><tr><th>Proyecto</th><th>Financiador</th><th>Unidad</th><th>Estado</th><th style={{ textAlign: 'right' }}>Acción</th></tr></thead>
            <tbody>
              {tenants.map(t => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600 }}>{t.nombre}</td>
                  <td style={{ fontSize: '0.82rem' }}>{t.financiador || '—'}</td>
                  <td style={{ fontSize: '0.78rem', textTransform: 'capitalize' }}>{t.unidad_analisis_default}</td>
                  <td>
                    <span className="badge" style={{ fontSize: '0.65rem', background: t.estado === 'activo' ? 'rgba(5,150,105,0.12)' : 'rgba(239,68,68,0.12)', color: t.estado === 'activo' ? '#a7f3d0' : '#fca5a5' }}>
                      {t.estado}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button onClick={() => toggleEstado(t)} className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Power size={12} /> {t.estado === 'activo' ? 'Suspender' : 'Reactivar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Plus size={18} /> Nuevo proyecto</h3>
          {msg && <div className="badge badge-success" style={{ display: 'block', padding: '0.5rem', marginBottom: '0.85rem', fontSize: '0.72rem', whiteSpace: 'normal' }}>{msg}</div>}
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div className="form-group"><label>Nombre del proyecto *</label><input value={nombre} onChange={e => setNombre(e.target.value)} required /></div>
            <div className="form-group"><label>Financiador</label><input value={financiador} onChange={e => setFinanciador(e.target.value)} /></div>
            <div className="form-group">
              <label>Unidad de análisis por defecto</label>
              <select value={unidad} onChange={e => setUnidad(e.target.value)}>
                <option value="comunidad">Comunidad</option>
                <option value="vereda">Vereda</option>
                <option value="organizacion">Organización</option>
                <option value="individuo">Individuo</option>
              </select>
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Copy size={13} /> Clonar configuración de (opcional)</label>
              <select value={cloneFrom} onChange={e => setCloneFrom(e.target.value)}>
                <option value="">— Partir de cero —</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </div>
            <button type="submit" className="btn btn-primary"><Save size={14} /> Crear proyecto</button>
          </form>
        </div>
      </div>
    </div>
  );
}
