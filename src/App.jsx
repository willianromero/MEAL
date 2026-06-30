import React, { useState, useEffect } from 'react';
import { seedLocalData } from './db';
import Sidebar from './components/Sidebar';
import SyncIndicator from './components/SyncIndicator';
import { Menu, Sun, Moon } from 'lucide-react';
import { supabase, isSupabaseConfigured } from './supabaseClient';

// Importar Vistas
import Dashboard from './views/Dashboard';
import Projects from './views/Projects';
import Indicators from './views/Indicators';
import Surveys from './views/Surveys';
import Feedback from './views/Feedback';
import Lessons from './views/Lessons';
import Auth from './views/Auth';

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Estado del tema: 'dark' o 'light'
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('meal_theme');
    return savedTheme || 'dark'; // Por defecto: oscuro
  });

  // Cargar sesión inicial o iniciar con sesión nula si Supabase está configurado (forzar autenticación)
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('meal_user_session');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error cargando sesión local:', e);
      }
    }
    // Si la conexión real está configurada, obligamos a autenticar en blanco
    if (isSupabaseConfigured) {
      return null;
    }
    // Modo demo local sin conexión real: autologueamos un oficial de campo
    return {
      id: 'mock-initial-officer-id',
      email: 'campo@meal.org',
      role: 'officer'
    };
  });

  // Aplicar tema dinámicamente
  useEffect(() => {
    const bodyClass = document.body.classList;
    if (theme === 'light') {
      bodyClass.add('theme-light');
    } else {
      bodyClass.remove('theme-light');
    }
    localStorage.setItem('meal_theme', theme);
  }, [theme]);

  // Sembrar base de datos local
  useEffect(() => {
    seedLocalData();
  }, []);

  // Pilar 2 (DevSecOps): Gestión de tokens y verificación remota de roles en el arranque
  useEffect(() => {
    if (isSupabaseConfigured) {
      // 1. Validar el token y la sesión real en Supabase
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (session && session.user) {
          try {
            // Consultar el rol verídico en la tabla profiles del servidor central
            const { data: profile, error } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', session.user.id)
              .single();

            let verifiedRole = 'officer';
            if (!error && profile) {
              verifiedRole = profile.role;
            } else {
              verifiedRole = session.user.user_metadata?.role || 'officer';
            }

            const userSession = {
              id: session.user.id,
              email: session.user.email,
              role: verifiedRole
            };

            setCurrentUser(userSession);
            localStorage.setItem('meal_user_session', JSON.stringify(userSession));
          } catch (e) {
            console.error('Error al verificar perfil remoto en arranque:', e);
            // Ante falla de verificación, obligamos a desloguear por seguridad
            setCurrentUser(null);
            localStorage.removeItem('meal_user_session');
          }
        } else {
          // Si no hay sesión válida en Supabase, limpiamos cualquier residuo local
          setCurrentUser(null);
          localStorage.removeItem('meal_user_session');
        }
      });

      // 2. Escuchar cambios de estado en la autenticación (ej: cierres de sesión remotos)
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
          localStorage.removeItem('meal_user_session');
          setCurrentView('auth');
        }
      });

      return () => {
        if (subscription) subscription.unsubscribe();
      };
    }
  }, []);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Forzar visualización de Auth si no hay un usuario activo
  const activeUser = currentUser;
  const currentActiveView = activeUser ? currentView : 'auth';

  const renderView = () => {
    switch (currentActiveView) {
      case 'dashboard':
        return <Dashboard setCurrentView={setCurrentView} />;
      case 'projects':
        return <Projects currentUser={activeUser} />;
      case 'indicators':
        return <Indicators currentUser={activeUser} />;
      case 'surveys':
        return <Surveys currentUser={activeUser} />;
      case 'feedback':
        return <Feedback currentUser={activeUser} />;
      case 'lessons':
        return <Lessons currentUser={activeUser} />;
      case 'auth':
        return <Auth currentUser={activeUser} setCurrentUser={setCurrentUser} />;
      default:
        return <Dashboard setCurrentView={setCurrentView} />;
    }
  };

  return (
    <div className="app-container">
      {/* 1. Barra superior para móviles */}
      <div className="mobile-topbar">
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        >
          <Menu size={24} />
        </button>
        
        <span style={{ fontWeight: 800, fontSize: '1.1rem', background: 'linear-gradient(135deg, #10b981 0%, #0d9488 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          MEAL Guardianes
        </span>

        <button 
          onClick={toggleTheme}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          title={theme === 'dark' ? 'Cambiar a modo claro (Alta luz)' : 'Cambiar a modo oscuro (Baja luz)'}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>

      {/* 2. Overlay móvil */}
      {isMobileMenuOpen && (
        <div 
          className="sidebar-overlay" 
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* 3. Barra Lateral (Sidebar responsive) */}
      <Sidebar 
        currentView={currentActiveView} 
        setCurrentView={(view) => {
          if (activeUser) {
            setCurrentView(view);
          } else {
            setCurrentView('auth');
          }
          setIsMobileMenuOpen(false);
        }} 
        currentUser={activeUser}
        isMobileOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />
      
      {/* 4. Contenido Principal */}
      <main className="main-content">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%' }}>
          <div style={{ flex: 1 }}>
            <SyncIndicator />
          </div>
          
          <button
            onClick={toggleTheme}
            className="btn btn-secondary"
            style={{ 
              padding: '0.75rem', 
              borderRadius: '12px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              height: '46px',
              width: '46px'
            }}
            title={theme === 'dark' ? 'Modo Claro (Alta luz/exterior)' : 'Modo Oscuro (Baja luz/interior)'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
        
        {/* Vista activa */}
        <div style={{ minHeight: '80vh' }}>
          {renderView()}
        </div>
      </main>
    </div>
  );
}
