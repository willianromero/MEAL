import React, { useState } from 'react';
import { db, putWithSignature, logAudit } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { triggerSync } from '../syncEngine';
import { useTenant } from '../context/TenantContext';
import { TENANT_ROLES, roleLabel } from '../lib/roles';
import { Users as UsersIcon, ShieldAlert, CheckCircle, RefreshCw, UserCheck, AlertTriangle } from 'lucide-react';

// Gestión de usuarios A NIVEL TENANT (DRT 3.2 y HU-11): el Administrador de
// Tenant asigna roles únicamente dentro de SU proyecto, mediante membresías.
export default function Users() {
  const { activeTenantId, activeTenant, tenantConfig, currentUser } = useTenant();
  const [selectedMembership, setSelectedMembership] = useState(null);
  const [newRole, setNewRole] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Membresías del tenant activo (aislamiento: nunca de otro tenant)
  const memberships = useLiveQuery(
    () => (activeTenantId ? db.memberships.where('tenant_id').equals(activeTenantId).toArray() : Promise.resolve([])),
    [activeTenantId],
    []
  );
  const profiles = useLiveQuery(() => db.profiles.toArray(), [], []);

  const profileFor = (usuarioId) => (profiles || []).find(p => p.id === usuarioId);

  const startEdit = (m) => {
    setSelectedMembership(m);
    setNewRole(m.rol);
  };

  const saveRole = async () => {
    if (!selectedMembership) return;
    setIsSaving(true);
    setStatusMessage('');
    try {
      const before = { ...selectedMembership };
      await putWithSignature(db.memberships, {
        ...selectedMembership,
        rol: newRole,
        updated_at: new Date().toISOString(),
        sync_status: 'pending_sync'
      });
      // Cambiar un rol es una operación sensible: queda en la bitácora (M13)
      await logAudit({
        tenantId: activeTenantId,
        actorId: currentUser?.id,
        actorEmail: currentUser?.email,
        accion: 'cambio_rol',
        entidad: 'memberships',
        entidadId: selectedMembership.id,
        antes: { rol: before.rol },
        despues: { rol: newRole }
      });
      setStatusMessage('Rol actualizado localmente y registrado en la bitácora.');
      triggerSync();
      setTimeout(() => { setSelectedMembership(null); setStatusMessage(''); }, 2000);
    } catch (err) {
      console.error(err);
      setStatusMessage('Error al actualizar el rol localmente.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="flex-between" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <UsersIcon size={28} className="text-primary" /> Usuarios del Proyecto
          </h1>
          <p>
            Asigna roles del equipo dentro de <strong style={{ color: 'var(--primary-light)' }}>{activeTenant?.nombre || '—'}</strong>.
            Un administrador solo gestiona usuarios de su propio proyecto (HU-11).
          </p>
        </div>
        <button onClick={() => triggerSync()} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <RefreshCw size={16} /> Sincronizar
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedMembership ? '1fr 300px' : '1fr', gap: '1.5rem', alignItems: 'start' }}>
        <div className="glass-panel" style={{ padding: '2rem', overflowX: 'auto' }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Miembros del Proyecto</h2>

          {!memberships || memberships.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              <AlertTriangle size={32} style={{ marginBottom: '0.75rem', color: 'var(--secondary-light)' }} />
              <p>Este proyecto aún no tiene membresías registradas.</p>
              <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                Las membresías se crean durante el onboarding del tenant o desde la consola de plataforma.
              </p>
            </div>
          ) : (
            <table className="table" style={{ width: '100%', minWidth: '500px' }}>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Rol en el Proyecto</th>
                  <th>Estado</th>
                  <th>Sincronización</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {memberships.map((m) => {
                  const prof = profileFor(m.usuario_id);
                  return (
                    <tr key={m.id}>
                      <td>
                        <div style={{ fontWeight: '600' }}>{prof?.email || m.usuario_id}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ID: {m.usuario_id}</div>
                      </td>
                      <td>
                        <span className="badge" style={{ background: 'rgba(5, 150, 105, 0.1)', color: '#a7f3d0', border: '1px solid rgba(5, 150, 105, 0.2)', fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>
                          {roleLabel(m.rol, tenantConfig)}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {m.activo === false ? 'Inactivo' : 'Activo'}
                      </td>
                      <td>
                        {m.sync_status === 'pending_sync' ? (
                          <span style={{ fontSize: '0.8rem', color: 'var(--secondary-light)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <ShieldAlert size={14} /> Pendiente
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <CheckCircle size={14} /> Guardado
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button onClick={() => startEdit(m)} className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}>
                          Editar Rol
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {selectedMembership && (
          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <UserCheck size={20} style={{ color: 'var(--primary-light)' }} />
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Modificar Rol</h3>
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Usuario: <strong style={{ color: 'var(--text-primary)' }}>{profileFor(selectedMembership.usuario_id)?.email || selectedMembership.usuario_id}</strong>
            </div>

            <div className="form-group">
              <label>Rol dentro del proyecto:</label>
              <select value={newRole} onChange={(e) => setNewRole(e.target.value)} style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: '8px', color: 'var(--text-primary)' }}>
                {TENANT_ROLES.map(r => (
                  <option key={r} value={r} style={{ background: '#1e293b' }}>{roleLabel(r, tenantConfig)}</option>
                ))}
              </select>
            </div>

            {statusMessage && (
              <div style={{ fontSize: '0.8rem', padding: '0.5rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: 'var(--primary-light)' }}>
                {statusMessage}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button onClick={saveRole} className="btn btn-primary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem' }} disabled={isSaving}>
                {isSaving ? 'Guardando...' : 'Confirmar'}
              </button>
              <button onClick={() => setSelectedMembership(null)} className="btn btn-secondary" style={{ padding: '0.5rem', fontSize: '0.8rem' }} disabled={isSaving}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
