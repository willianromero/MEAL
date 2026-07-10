import React from 'react';
import { Building2, ChevronDown, Lock } from 'lucide-react';
import { useTenant } from '../context/TenantContext';

// Selector de tenant activo (DRT 11.0: "Sesión con tenant activo").
// Cambiar de tenant reencuadra todos los datos visibles.
export default function TenantSelector() {
  const { tenants, suspendedMemberTenants, activeTenantId, setActiveTenant, activeTenant } = useTenant();

  const suspendedBadge = suspendedMemberTenants && suspendedMemberTenants.length > 0 && (
    <span
      className="badge badge-warning"
      title={`Suspendido(s): ${suspendedMemberTenants.map(t => t.nombre).join(', ')}. Contacta al Administrador de Plataforma para reactivarlo.`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.65rem', cursor: 'help' }}
    >
      <Lock size={11} /> {suspendedMemberTenants.length} suspendido{suspendedMemberTenants.length > 1 ? 's' : ''}
    </span>
  );

  if (!tenants || tenants.length === 0) {
    // Sin proyectos operables: si es porque los suyos están suspendidos, avisar.
    if (suspendedBadge) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sin proyecto activo</span>
          {suspendedBadge}
        </div>
      );
    }
    return null;
  }

  // Con un solo tenant se muestra como etiqueta fija (sin selector)
  if (tenants.length === 1) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
        <Building2 size={16} />
        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{activeTenant?.nombre}</span>
        {suspendedBadge}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <Building2 size={16} style={{ position: 'absolute', left: '0.6rem', color: 'var(--primary-light)', pointerEvents: 'none' }} />
        <ChevronDown size={14} style={{ position: 'absolute', right: '0.6rem', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <select
          value={activeTenantId || ''}
          onChange={(e) => setActiveTenant(e.target.value)}
          title="Proyecto / tenant activo"
          style={{
            appearance: 'none',
            padding: '0.5rem 1.8rem 0.5rem 2rem',
            background: 'var(--bg-card-inner)',
            border: '1px solid var(--border-glass)',
            borderRadius: '10px',
            color: 'var(--text-primary)',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            maxWidth: '260px'
          }}
        >
          {tenants.map(t => (
            <option key={t.id} value={t.id}>{t.nombre}</option>
          ))}
        </select>
      </div>
      {suspendedBadge}
    </div>
  );
}
