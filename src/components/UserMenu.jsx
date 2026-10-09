import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, UserCircle2 } from 'lucide-react';
import { useTenant } from '../context/TenantContext';
import { roleLabel } from '../lib/roles';

// Menú de usuario siempre visible (barra superior en escritorio y en móvil):
// quién tiene la sesión abierta, "Mi cuenta" y "Cerrar sesión".
export default function UserMenu({ currentUser, onOpenAccount, onLogout, compact = false }) {
  const { isPlatform, platformRole, tenantRole, tenantConfig } = useTenant();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const email = currentUser?.email || '';
  const role = isPlatform ? roleLabel(platformRole) : (tenantRole ? roleLabel(tenantRole, tenantConfig) : 'Sin rol asignado');
  const initial = (email[0] || '?').toUpperCase();

  const item = {
    display: 'flex', alignItems: 'center', gap: '0.6rem', width: '100%',
    padding: '0.65rem 0.85rem', background: 'transparent', border: 0, borderRadius: '8px',
    color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.875rem', textAlign: 'left'
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`${email} · ${role}`}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: compact ? '0.25rem' : '0.35rem 0.6rem 0.35rem 0.35rem',
          background: compact ? 'transparent' : 'var(--bg-card)',
          border: compact ? 0 : '1px solid var(--border-glass)',
          borderRadius: '999px', cursor: 'pointer', color: 'var(--text-primary)', minHeight: '40px'
        }}
      >
        <span style={{
          width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%)',
          color: 'white', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          {initial}
        </span>
        {!compact && (
          <>
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.2, maxWidth: '200px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{role}</span>
            </span>
            <ChevronDown size={16} style={{ color: 'var(--text-secondary)' }} />
          </>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="glass-panel"
          style={{
            position: 'absolute', right: 0, top: 'calc(100% + 0.5rem)', zIndex: 200,
            minWidth: '240px', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.15rem'
          }}
        >
          <div style={{ padding: '0.5rem 0.85rem 0.65rem', borderBottom: '1px solid var(--border-glass)', marginBottom: '0.25rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, overflowWrap: 'anywhere' }}>{email}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{role}</div>
          </div>
          <button type="button" role="menuitem" style={item} onClick={() => { setOpen(false); onOpenAccount(); }}>
            <UserCircle2 size={18} /> Mi cuenta
          </button>
          <button type="button" role="menuitem" style={{ ...item, color: '#f87171' }} onClick={() => { setOpen(false); onLogout(); }}>
            <LogOut size={18} /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
