import React, { useState } from 'react';
import { Globe, Eye, EyeOff, LogIn, UserPlus, KeyRound, AlertCircle, CheckCircle2, RotateCw } from 'lucide-react';
import {
  backend,
  isBackendConfigured,
  friendlyAuthError,
  requestPasswordReset,
  completePasswordReset
} from '../backendClient';

const MIN_PASSWORD = 8;

// Pantalla de ingreso a pantalla completa. Sin sesión no se muestra nada de
// la plataforma (ni menú, ni sincronización, ni proyectos).
// Modos: ingresar · crear cuenta (queda sin acceso hasta que el administrador
// le asigne proyecto y rol) · olvidé mi contraseña · nueva contraseña (cuando
// se llega desde el enlace del correo, con `resetToken`).
export default function Login({ onSignedIn, notice, resetToken, resetError, onResetDone, onEnterLocalMode }) {
  const [mode, setMode] = useState(resetToken ? 'reset' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(
    resetError ? { text: friendlyAuthError(resetError), error: true }
      : notice ? { text: notice, error: false }
        : null
  );

  const switchMode = (next) => {
    setMode(next);
    setPassword('');
    setConfirm('');
    setMessage(null);
  };

  const run = async (fn) => {
    setLoading(true);
    setMessage(null);
    try {
      await fn();
    } catch (err) {
      console.error(err);
      setMessage({ text: friendlyAuthError(err), error: true });
    } finally {
      setLoading(false);
    }
  };

  const checkNewPassword = () => {
    if (password.length < MIN_PASSWORD) throw new Error(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
    if (password !== confirm) throw new Error('Las dos contraseñas no coinciden.');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();

    if (mode === 'login') {
      run(async () => {
        if (!cleanEmail || !password) throw new Error('Escribe tu correo y tu contraseña.');
        const { data, error } = await backend.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) throw error;
        await onSignedIn(data.user);
      });
    } else if (mode === 'signup') {
      run(async () => {
        if (!cleanEmail) throw new Error('Escribe tu correo.');
        checkNewPassword();
        const { error } = await backend.auth.signUp({ email: cleanEmail, password });
        if (error) throw error;
        // La cuenta nueva aún no tiene proyecto ni rol: se cierra la sesión que
        // abre el registro y se explica el siguiente paso.
        await backend.auth.signOut().catch(() => {});
        switchMode('login');
        setMessage({ text: `Cuenta creada para ${cleanEmail}. Pide al administrador que te asigne un proyecto y un rol; después ingresa aquí.`, error: false });
      });
    } else if (mode === 'forgot') {
      run(async () => {
        if (!cleanEmail) throw new Error('Escribe el correo de tu cuenta.');
        await requestPasswordReset(cleanEmail);
        setMessage({ text: `Si ${cleanEmail} tiene una cuenta, te llegará un correo con un enlace para crear una contraseña nueva. Revisa también la carpeta de spam.`, error: false });
      });
    } else if (mode === 'reset') {
      run(async () => {
        checkNewPassword();
        await completePasswordReset({ token: resetToken, newPassword: password });
        onResetDone?.();
        switchMode('login');
        setMessage({ text: 'Contraseña actualizada. Ya puedes ingresar con la nueva.', error: false });
      });
    }
  };

  const titles = {
    login: { icon: <LogIn size={20} />, title: 'Ingresar', button: 'Ingresar', hint: 'Usa el correo y la contraseña de tu cuenta de la plataforma.' },
    signup: { icon: <UserPlus size={20} />, title: 'Crear cuenta', button: 'Crear cuenta', hint: 'Tu cuenta quedará sin acceso hasta que el administrador te asigne un proyecto y un rol.' },
    forgot: { icon: <KeyRound size={20} />, title: 'Recuperar contraseña', button: 'Enviar enlace', hint: 'Te enviaremos un correo con un enlace para crear una contraseña nueva.' },
    reset: { icon: <KeyRound size={20} />, title: 'Nueva contraseña', button: 'Guardar contraseña', hint: 'Escribe tu nueva contraseña dos veces.' }
  }[mode];

  const needsEmail = mode !== 'reset';
  const needsPassword = mode !== 'forgot';
  const needsConfirm = mode === 'signup' || mode === 'reset';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem 1rem' }}>
      <div style={{ width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Marca */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', textAlign: 'center' }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%)',
            width: '56px', height: '56px', borderRadius: '14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 16px rgba(5,150,105,0.3)'
          }}>
            <Globe size={30} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Plataforma MEAL</h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>Fundación Guajira Competitiva</p>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {!isBackendConfigured ? (
            // Solo en desarrollo: sin servidor configurado no hay cuentas reales.
            <>
              <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Modo local (sin servidor)</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                Esta instalación no tiene servidor configurado, así que no hay cuentas ni sincronización.
                Solo sirve para desarrollo.
              </p>
              <button type="button" className="btn btn-primary" onClick={onEnterLocalMode} style={{ width: '100%' }}>
                Entrar en modo local
              </button>
            </>
          ) : (
            <>
              <div>
                <h2 style={{ fontSize: '1.15rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: 'var(--primary-light)', display: 'flex' }}>{titles.icon}</span> {titles.title}
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.35rem 0 0' }}>{titles.hint}</p>
              </div>

              {message && (
                <div
                  role={message.error ? 'alert' : 'status'}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
                    padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem',
                    border: `1px solid ${message.error ? 'rgba(239, 68, 68, 0.35)' : 'rgba(16, 185, 129, 0.35)'}`,
                    background: message.error ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                    color: message.error ? '#f87171' : 'var(--primary-light)'
                  }}
                >
                  {message.error ? <AlertCircle size={18} style={{ flexShrink: 0 }} /> : <CheckCircle2 size={18} style={{ flexShrink: 0 }} />}
                  <span>{message.text}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} noValidate>
                {needsEmail && (
                  <div className="form-group">
                    <label htmlFor="login-email">Correo electrónico</label>
                    <input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      placeholder="nombre@fundacionguajiracompetitiva.org"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      autoFocus
                    />
                  </div>
                )}

                {needsPassword && (
                  <div className="form-group">
                    <label htmlFor="login-password">{mode === 'login' ? 'Contraseña' : 'Contraseña nueva'}</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                        placeholder={mode === 'login' ? '••••••••' : `Mínimo ${MIN_PASSWORD} caracteres`}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                        style={{ paddingRight: '2.75rem' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        style={{
                          position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)',
                          background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--text-secondary)',
                          display: 'flex', padding: '0.25rem'
                        }}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                )}

                {needsConfirm && (
                  <div className="form-group">
                    <label htmlFor="login-confirm">Repite la contraseña</label>
                    <input
                      id="login-confirm"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                )}

                <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', marginTop: '0.25rem' }}>
                  {loading ? <><RotateCw size={16} className="animate-spin" /> Un momento…</> : titles.button}
                </button>
              </form>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center', fontSize: '0.85rem' }}>
                {mode === 'login' && (
                  <>
                    <LinkButton onClick={() => switchMode('forgot')} disabled={loading}>¿Olvidaste tu contraseña?</LinkButton>
                    <LinkButton onClick={() => switchMode('signup')} disabled={loading}>¿Primera vez? Crear cuenta</LinkButton>
                  </>
                )}
                {mode !== 'login' && (
                  <LinkButton onClick={() => switchMode('login')} disabled={loading}>Volver a ingresar</LinkButton>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function LinkButton({ children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      style={{ background: 'transparent', border: 0, color: 'var(--primary-light)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, padding: '0.15rem' }}
    >
      {children}
    </button>
  );
}
