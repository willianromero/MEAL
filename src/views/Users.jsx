import React, { useState } from 'react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { triggerSync } from '../syncEngine';
import { Users as UsersIcon, ShieldAlert, CheckCircle, RefreshCw, UserCheck, AlertTriangle } from 'lucide-react';

export default function Users() {
  const [selectedUser, setSelectedUser] = useState(null);
  const [newRole, setNewRole] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Cargar perfiles de Dexie de forma reactiva
  const profiles = useLiveQuery(() => db.profiles.toArray());

  const handleRoleChange = async (userId, email, currentRole) => {
    setSelectedUser({ id: userId, email });
    setNewRole(currentRole);
  };

  const saveRole = async () => {
    if (!selectedUser) return;
    setIsSaving(true);
    setStatusMessage('');

    try {
      // Guardar el rol modificado en la base de datos local Dexie
      await db.profiles.update(selectedUser.id, {
        role: newRole,
        updated_at: new Date().toISOString(),
        sync_status: 'pending_sync'
      });

      setStatusMessage(`Rol de ${selectedUser.email} actualizado localmente.`);
      
      // Lanzar sincronización en segundo plano inmediatamente
      triggerSync();

      setTimeout(() => {
        setSelectedUser(null);
        setStatusMessage('');
      }, 2000);
    } catch (err) {
      console.error(err);
      setStatusMessage('Error al actualizar el rol localmente.');
    } finally {
      setIsSaving(false);
    }
  };

  const forceSync = () => {
    triggerSync();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Cabecera */}
      <div className="flex-between" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <UsersIcon size={28} className="text-primary" />
            Control de Usuarios
          </h1>
          <p>Asigna y gestiona los roles y permisos del personal del proyecto Guardianes del Mar Wayuu.</p>
        </div>

        <button 
          onClick={forceSync} 
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <RefreshCw size={16} />
          Sincronizar Lista
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedUser ? '1fr 300px' : '1fr', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* LISTADO DE USUARIOS */}
        <div className="glass-panel" style={{ padding: '2rem', overflowX: 'auto' }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Personal Registrado</h2>
          
          {!profiles || profiles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              <AlertTriangle size={32} style={{ marginBottom: '0.75rem', color: 'var(--secondary-light)' }} />
              <p>No hay perfiles almacenados localmente.</p>
              <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                Presiona <strong>Sincronizar Lista</strong> para descargar los perfiles desde Supabase central.
              </p>
            </div>
          ) : (
            <table className="table" style={{ width: '100%', minWidth: '500px' }}>
              <thead>
                <tr>
                  <th>Email / Cuenta</th>
                  <th>Rol de Acceso</th>
                  <th>Última Modificación</th>
                  <th>Sincronización</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile) => (
                  <tr key={profile.id}>
                    <td>
                      <div style={{ fontWeight: '600' }}>{profile.email}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ID: {profile.id}</div>
                    </td>
                    <td>
                      <span 
                        className="badge"
                        style={{
                          background: profile.role === 'admin' ? 'rgba(239, 68, 68, 0.1)' : profile.role === 'officer' ? 'rgba(5, 150, 105, 0.1)' : 'rgba(14, 165, 233, 0.1)',
                          color: profile.role === 'admin' ? '#fca5a5' : profile.role === 'officer' ? '#a7f3d0' : '#e0f2fe',
                          border: `1px solid ${profile.role === 'admin' ? 'rgba(239, 68, 68, 0.2)' : profile.role === 'officer' ? 'rgba(5, 150, 105, 0.2)' : 'rgba(14, 165, 233, 0.2)'}`,
                          fontSize: '0.75rem',
                          padding: '0.2rem 0.5rem'
                        }}
                      >
                        {profile.role === 'admin' ? 'Administrador' : profile.role === 'officer' ? 'Oficial de Campo' : 'Visualizador'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {profile.updated_at ? new Date(profile.updated_at).toLocaleString() : 'Desconocida'}
                    </td>
                    <td>
                      {profile.sync_status === 'pending_sync' ? (
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
                      <button
                        onClick={() => handleRoleChange(profile.id, profile.email, profile.role)}
                        className="btn btn-secondary"
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                      >
                        Editar Rol
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* PANEL LATERAL DE EDICIÓN */}
        {selectedUser && (
          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <UserCheck size={20} style={{ color: 'var(--primary-light)' }} />
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Modificar Rol</h3>
            </div>
            
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Usuario: <strong style={{ color: 'var(--text-primary)' }}>{selectedUser.email}</strong>
            </div>

            <div className="form-group">
              <label>Selecciona el nuevo rol:</label>
              <select 
                value={newRole} 
                onChange={(e) => setNewRole(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)'
                }}
              >
                <option value="admin" style={{ background: '#1e293b' }}>Administrador</option>
                <option value="officer" style={{ background: '#1e293b' }}>Oficial de Campo</option>
                <option value="viewer" style={{ background: '#1e293b' }}>Visualizador</option>
              </select>
            </div>

            {statusMessage && (
              <div style={{ fontSize: '0.8rem', padding: '0.5rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: 'var(--primary-light)' }}>
                {statusMessage}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button 
                onClick={saveRole} 
                className="btn btn-primary" 
                style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem' }}
                disabled={isSaving}
              >
                {isSaving ? 'Guardando...' : 'Confirmar'}
              </button>
              <button 
                onClick={() => setSelectedUser(null)} 
                className="btn btn-secondary"
                style={{ padding: '0.5rem', fontSize: '0.8rem' }}
                disabled={isSaving}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
