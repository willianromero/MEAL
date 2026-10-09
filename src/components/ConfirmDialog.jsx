import React, { useEffect } from 'react';

// Diálogo de confirmación modal (p. ej. cerrar sesión con cambios sin enviar).
export default function ConfirmDialog({ title, children, confirmLabel, cancelLabel = 'Cancelar', danger = false, onConfirm, onCancel }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      role="presentation"
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0, 0, 0, 0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="glass-panel"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: '420px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--bg-container)' }}
      >
        <h2 id="confirm-title" style={{ fontSize: '1.1rem', margin: 0 }}>{title}</h2>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{children}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={onCancel} autoFocus>{cancelLabel}</button>
          <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
