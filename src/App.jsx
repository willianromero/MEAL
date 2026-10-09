import React, { useState, useEffect, useCallback } from 'react';
import { seedLocalData } from './db';
import Sidebar from './components/Sidebar';
import SyncIndicator from './components/SyncIndicator';
import TenantSelector from './components/TenantSelector';
import UserMenu from './components/UserMenu';
import ConfirmDialog from './components/ConfirmDialog';
import { TenantProvider, useTenant } from './context/TenantContext';
import { Menu, Sun, Moon, RotateCw, Building2, LogOut, WifiOff } from 'lucide-react';
import { backend, isBackendConfigured, PASSWORD_RESET_PARAM } from './backendClient';
import { triggerSync, subscribeToSyncState } from './syncEngine';

// Importar Vistas
import Dashboard from './views/Dashboard';
import Projects from './views/Projects';
import Indicators from './views/Indicators';
import Surveys from './views/Surveys';
import Feedback from './views/Feedback';
import Lessons from './views/Lessons';
import Login from './views/Login';
import Account from './views/Account';
import Users from './views/Users'; // Panel administrativo de usuarios
import Catalog from './views/Catalog';
import TenantAdmin from './views/TenantAdmin';
import FieldCapture from './views/FieldCapture';
import FormBuilder from './views/FormBuilder';
import Validation from './views/Validation';
import Beneficiaries from './views/Beneficiaries';
import AuditLog from './views/AuditLog';
import Repository from './views/Repository';
import Reports from './views/Reports';

// Sesión recordada en el dispositivo. Permite abrir la app sin señal (campo):
// el servidor la valida en segundo plano cuando hay conexión.
const SESSION_KEY = 'meal_user_session';

function readSavedUser() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

function saveUser(user) {
  if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  else localStorage.removeItem(SESSION_KEY);
}

// Rol de plataforma según `profiles` (cada quien lee su propio perfil por RLS).
// Sin perfil todavía = 'user': entra, pero no ve proyectos hasta que el
// administrador le asigne uno.
async function loadSessionUser(authUser) {
  const { data, error } = await backend.from('profiles').select('role').eq('id', authUser.id).limit(1);
  if (error) throw error;
  return { id: authUser.id, email: authUser.email, role: data?.[0]?.role || 'user' };
}

// Enlace del correo "restablecer contraseña": /?restablecer=1&token=… (o &error=…)
function readPasswordResetLink() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has(PASSWORD_RESET_PARAM)) return null;
  return { token: params.get('token'), error: params.get('error') };
}

function clearUrlParams() {
  window.history.replaceState({}, '', window.location.pathname);
}

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('meal_theme') || 'dark');
  const [currentUser, setCurrentUser] = useState(readSavedUser);
  const [notice, setNotice] = useState(null);
  const [resetLink, setResetLink] = useState(readPasswordResetLink);

  // Aplicar tema dinámicamente
  useEffect(() => {
    document.body.classList.toggle('theme-light', theme === 'light');
    localStorage.setItem('meal_theme', theme);
  }, [theme]);

  // Sembrar base de datos local
  useEffect(() => {
    seedLocalData();
  }, []);

  const endSession = useCallback((message) => {
    saveUser(null);
    setCurrentUser(null);
    setNotice(message || null);
  }, []);

  // Validación de la sesión recordada contra el servidor (en segundo plano).
  useEffect(() => {
    if (!isBackendConfigured) return undefined;
    let cancelled = false;

    (async () => {
      const saved = readSavedUser();
      let session;
      try {
        const { data, error } = await backend.auth.getSession();
        if (error) throw error;
        session = data?.session || null;
      } catch (err) {
        // Sin conexión no se puede verificar: se conserva la sesión del
        // dispositivo y se sincroniza cuando vuelva la señal.
        console.warn('No se pudo verificar la sesión (¿sin conexión?):', err?.message || err);
        return;
      }
      if (cancelled) return;

      if (!saved) {
        // Cerró sesión en este dispositivo (quizá sin señal): no se reabre sola.
        if (session) backend.auth.signOut().catch(() => {});
        return;
      }
      if (!session?.user || session.user.id !== saved.id) {
        endSession('Tu sesión expiró. Ingresa de nuevo.');
        return;
      }
      try {
        const user = await loadSessionUser(session.user);
        if (cancelled) return;
        saveUser(user);
        setCurrentUser(user);
      } catch (err) {
        console.warn('No se pudo actualizar el perfil:', err?.message || err);
      }
      triggerSync();
    })();

    // Cierres de sesión hechos desde otra pestaña o por el servidor
    const { data: { subscription } } = backend.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && readSavedUser()) endSession('Se cerró tu sesión.');
    });

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, [endSession]);

  const handleSignedIn = async (authUser) => {
    const user = await loadSessionUser(authUser);
    saveUser(user);
    setNotice(null);
    setCurrentUser(user);
    triggerSync(); // descarga de inmediato el proyecto y la configuración
  };

  const handleLogout = async () => {
    try {
      if (isBackendConfigured) await backend.auth.signOut();
    } catch (e) {
      // Sin señal no se puede avisar al servidor; la sesión local se cierra
      // igual y la del servidor se cierra al volver a abrir la app con red.
      console.warn('Cierre de sesión solo local:', e?.message || e);
    }
    endSession('Cerraste sesión.');
  };

  if (!currentUser) {
    return (
      <Login
        notice={notice}
        resetToken={resetLink?.token || null}
        resetError={resetLink?.error || null}
        onResetDone={() => { setResetLink(null); clearUrlParams(); }}
        onSignedIn={handleSignedIn}
        onEnterLocalMode={() => {
          const local = { id: 'local-user', email: 'local@dispositivo', role: 'platform_admin' };
          saveUser(local);
          setCurrentUser(local);
        }}
      />
    );
  }

  return (
    <TenantProvider currentUser={currentUser}>
      <Shell
        currentUser={currentUser}
        theme={theme}
        onToggleTheme={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
        onLogout={handleLogout}
      />
    </TenantProvider>
  );
}

// Aplicación con sesión iniciada.
function Shell({ currentUser, theme, onToggleTheme, onLogout }) {
  const { tenants, suspendedMemberTenants, isPlatform } = useTenant();
  const [currentView, setCurrentView] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [sync, setSync] = useState({ pendingCount: 0, isSyncing: false, isOnline: true, lastSyncedAt: 'Nunca', error: null });

  useEffect(() => subscribeToSyncState(setSync), []);

  const goTo = (view) => {
    setCurrentView(view);
    setIsMobileMenuOpen(false);
  };
  const requestLogout = () => setConfirmLogout(true);

  const themeButton = (
    <button
      onClick={onToggleTheme}
      className="btn btn-secondary"
      style={{ padding: '0.6rem', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '42px', width: '42px' }}
      title={theme === 'dark' ? 'Modo claro (exterior / sol)' : 'Modo oscuro (interior)'}
      aria-label="Cambiar tema"
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );

  // Sin proyecto: cuenta nueva aún sin asignar, o primera descarga en curso.
  const noProject = !isPlatform && tenants.length === 0;

  const renderView = () => {
    if (currentView === 'account') return <Account currentUser={currentUser} onLogout={requestLogout} />;
    if (noProject) {
      return (
        <NoProject
          sync={sync}
          suspended={suspendedMemberTenants}
          onRetry={() => triggerSync()}
          onLogout={requestLogout}
        />
      );
    }
    switch (currentView) {
      case 'dashboard':
        return <Dashboard setCurrentView={goTo} />;
      case 'projects':
        return <Projects currentUser={currentUser} />;
      case 'catalog':
        return <Catalog currentUser={currentUser} />;
      case 'tenants':
        return <TenantAdmin currentUser={currentUser} />;
      case 'indicators':
        return <Indicators currentUser={currentUser} />;
      case 'capture':
        return <FieldCapture currentUser={currentUser} />;
      case 'formbuilder':
        return <FormBuilder currentUser={currentUser} />;
      case 'validation':
        return <Validation currentUser={currentUser} />;
      case 'beneficiaries':
        return <Beneficiaries currentUser={currentUser} />;
      case 'audit':
        return <AuditLog />;
      case 'repository':
        return <Repository />;
      case 'reports':
        return <Reports currentUser={currentUser} />;
      case 'surveys':
        return <Surveys currentUser={currentUser} />;
      case 'feedback':
        return <Feedback currentUser={currentUser} />;
      case 'lessons':
        return <Lessons currentUser={currentUser} />;
      case 'users':
        // El acceso real lo gobierna la capacidad MANAGE_USERS en el Sidebar y
        // las políticas RLS del backend; aquí solo enrutamos.
        return <Users />;
      default:
        return <Dashboard setCurrentView={goTo} />;
    }
  };

  return (
    <div className="app-container">
      {/* 1. Barra superior para móviles */}
      <div className="mobile-topbar">
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          aria-label="Abrir menú"
          style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        >
          <Menu size={24} />
        </button>

        <span style={{ fontWeight: 800, fontSize: '1.1rem', background: 'linear-gradient(135deg, #10b981 0%, #0d9488 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Plataforma MEAL
        </span>

        <UserMenu currentUser={currentUser} onOpenAccount={() => goTo('account')} onLogout={requestLogout} compact />
      </div>

      {/* 2. Overlay móvil */}
      {isMobileMenuOpen && (
        <div className="sidebar-overlay" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* 3. Barra Lateral (Sidebar responsive) */}
      <Sidebar
        currentView={currentView}
        setCurrentView={goTo}
        currentUser={currentUser}
        isMobileOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        onLogout={requestLogout}
        hideNavigation={noProject}
      />

      {/* 4. Contenido Principal */}
      <main className="main-content">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%', flexWrap: 'wrap' }}>
          <TenantSelector />
          <div style={{ flex: 1, minWidth: '200px' }}>
            <SyncIndicator />
          </div>
          {themeButton}
          <div className="desktop-only">
            <UserMenu currentUser={currentUser} onOpenAccount={() => goTo('account')} onLogout={requestLogout} />
          </div>
        </div>

        {/* Vista activa */}
        <div style={{ minHeight: '80vh' }}>
          {renderView()}
        </div>
      </main>

      {confirmLogout && (
        <ConfirmDialog
          title="¿Cerrar sesión?"
          confirmLabel="Cerrar sesión"
          danger
          onCancel={() => setConfirmLogout(false)}
          onConfirm={() => { setConfirmLogout(false); onLogout(); }}
        >
          {sync.pendingCount > 0 ? (
            <p>
              Hay <strong>{sync.pendingCount}</strong> cambio(s) de este dispositivo que aún no se han enviado al servidor.
              No se pierden: quedan guardados aquí y se envían cuando vuelvas a ingresar con conexión.
            </p>
          ) : (
            <p>Para volver a entrar necesitarás tu correo y contraseña.</p>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}

function NoProject({ sync, suspended, onRetry, onLogout }) {
  const firstDownload = sync.lastSyncedAt === 'Nunca';
  let title = 'Tu cuenta aún no tiene un proyecto asignado';
  let body = 'Pide al administrador de la plataforma que te asigne un proyecto y un rol. Cuando lo haga, pulsa "Volver a intentar".';
  let icon = <Building2 size={36} />;

  if (suspended?.length > 0) {
    title = 'Tu proyecto está suspendido';
    body = `${suspended.map(t => t.nombre).join(', ')}: contacta al administrador de la plataforma para reactivarlo.`;
  } else if (!sync.isOnline && firstDownload) {
    title = 'Conéctate a internet';
    body = 'La primera vez que ingresas en este dispositivo hay que descargar tu proyecto. Hazlo con señal; después podrás trabajar sin conexión.';
    icon = <WifiOff size={36} />;
  } else if (sync.error && firstDownload && !sync.isSyncing) {
    title = 'No se pudo descargar tu proyecto';
    body = `El servidor respondió: ${sync.error}. Revisa la conexión y vuelve a intentar.`;
  } else if (sync.isSyncing || firstDownload) {
    title = 'Descargando tu proyecto…';
    body = 'Un momento: estamos preparando la información de tu proyecto en este dispositivo.';
    icon = <RotateCw size={36} className="animate-spin" />;
  }

  return (
    <div className="glass-panel" style={{ maxWidth: '560px', margin: '3rem auto 0', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', textAlign: 'center' }}>
      <span style={{ color: 'var(--primary-light)' }}>{icon}</span>
      <h2 style={{ margin: 0 }}>{title}</h2>
      <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{body}</p>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button type="button" className="btn btn-primary" onClick={onRetry} disabled={sync.isSyncing || !sync.isOnline}>
          <RotateCw size={16} /> Volver a intentar
        </button>
        <button type="button" className="btn btn-secondary" onClick={onLogout}>
          <LogOut size={16} /> Cerrar sesión
        </button>
      </div>
    </div>
  );
}
