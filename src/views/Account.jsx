import React, { useState } from 'react';
import { UserCircle2, KeyRound, LogOut, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { isBackendConfigured, backendKind, changePassword, friendlyAuthError } from '../backendClient';
import { useTenant } from '../context/TenantContext';
import { roleLabel } from '../lib/roles';

const MIN_PASSWORD = 8;

// "Mi cuenta": quién soy, con qué rol, cambiar contraseña y cerrar sesión.
export default function Account({ currentUser, onLogout }) {
  const { activeTenant, tenantRole, platformRole, isPlatform, tenantConfig } = useTenant();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setMessage(null);
    if (newPassword.length < MIN_PASSWORD) {
      setMessage({ text: `La contraseña nueva debe tener al menos ${MIN_PASSWORD} caracteres.`, error: true });
      return;
    }
    if (newPassword !== confirm) {
      setMessage({ text: 'Las dos contraseñas nuevas no coinciden.', error: true });
      return;
    }
    setSaving(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setMessage({ text: 'Contraseña actualizada.', error: false });
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
    } catch (err) {
      setMessage({ text: friendlyAuthError(err), error: true });
    } finally {
      setSaving(false);
    }
  };

  const rows = [
    ['Correo', currentUser?.email],
    isPlatform && ['Rol en la plataforma', roleLabel(platformRole)],
    activeTenant && ['Proyecto', activeTenant.nombre],
    activeTenant && tenantRole && ['Rol en el proyecto', roleLabel(tenantRole, tenantConfig)]
  ].filter(Boolean);

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h1>Mi cuenta</h1>
        <p>Tus datos de acceso y tu rol en la plataforma.</p>
      </div>

      <div className="glass-panel" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <UserCircle2 size={40} style={{ color: 'var(--primary-light)' }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentUser?.email}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Sesión iniciada en este dispositivo</div>
          </div>
        </div>
        <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, auto) 1fr', gap: '0.5rem 1rem', margin: 0, fontSize: '0.875rem' }}>
          {rows.map(([k, v]) => (
            <React.Fragment key={k}>
              <dt style={{ color: 'var(--text-secondary)' }}>{k}</dt>
              <dd style={{ margin: 0, fontWeight: 600, overflowWrap: 'anywhere' }}>{v}</dd>
            </React.Fragment>
          ))}
        </dl>
      </div>

      {isBackendConfigured && (
        <div className="glass-panel" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.05rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <KeyRound size={18} style={{ color: 'var(--primary-light)' }} /> Cambiar contraseña
          </h2>

          {message && (
            <div
              role={message.error ? 'alert' : 'status'}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem',
                color: message.error ? '#f87171' : 'var(--primary-light)'
              }}
            >
              {message.error ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />} {message.text}
            </div>
          )}

          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }} noValidate>
            {backendKind === 'neon' && (
              <div className="form-group">
                <label htmlFor="acc-current">Contraseña actual</label>
                <input id="acc-current" type={show ? 'text' : 'password'} autoComplete="current-password"
                  value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} disabled={saving} />
              </div>
            )}
            <div className="form-group">
              <label htmlFor="acc-new">Contraseña nueva</label>
              <input id="acc-new" type={show ? 'text' : 'password'} autoComplete="new-password"
                placeholder={`Mínimo ${MIN_PASSWORD} caracteres`}
                value={newPassword} onChange={e => setNewPassword(e.target.value)} disabled={saving} />
            </div>
            <div className="form-group">
              <label htmlFor="acc-confirm">Repite la contraseña nueva</label>
              <input id="acc-confirm" type={show ? 'text' : 'password'} autoComplete="new-password"
                value={confirm} onChange={e => setConfirm(e.target.value)} disabled={saving} />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="submit" className="btn btn-primary" disabled={saving || !newPassword}>
                {saving ? 'Guardando…' : 'Guardar contraseña'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShow(s => !s)}>
                {show ? <><EyeOff size={16} /> Ocultar</> : <><Eye size={16} /> Mostrar</>}
              </button>
            </div>
          </form>
        </div>
      )}

      <button type="button" className="btn btn-danger" onClick={onLogout} style={{ alignSelf: 'flex-start' }}>
        <LogOut size={16} /> Cerrar sesión
      </button>
    </div>
  );
}
