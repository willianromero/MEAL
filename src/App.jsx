import React, { useState, useEffect } from 'react';
import { seedLocalData } from './db';
import Sidebar from './components/Sidebar';
import SyncIndicator from './components/SyncIndicator';
import { Menu, Sun, Moon } from 'lucide-react';

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

  // Cargar sesión inicial o iniciar con Oficial de Campo simulado por defecto
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('meal_user_session');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error cargando sesión local:', e);
      }
    }
    return {
      id: 'mock-initial-officer-id',
      email: 'campo@meal.org',
      role: 'officer'
    };
  });

  // Aplicar tema dinámicamente al elemento body
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

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard setCurrentView={setCurrentView} />;
      case 'projects':
        return <Projects currentUser={currentUser} />;
      case 'indicators':
        return <Indicators currentUser={currentUser} />;
      case 'surveys':
        return <Surveys currentUser={currentUser} />;
      case 'feedback':
        return <Feedback currentUser={currentUser} />;
      case 'lessons':
        return <Lessons currentUser={currentUser} />;
      case 'auth':
        return <Auth currentUser={currentUser} setCurrentUser={setCurrentUser} />;
      default:
        return <Dashboard setCurrentView={setCurrentView} />;
    }
  };

  return (
    <div className="app-container">
      {/* 1. Barra superior para móviles y tabletas */}
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

      {/* 2. Overlay para cerrar menú móvil al hacer clic fuera */}
      {isMobileMenuOpen && (
        <div 
          className="sidebar-overlay" 
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* 3. Barra Lateral (Sidebar responsive limpia) */}
      <Sidebar 
        currentView={currentView} 
        setCurrentView={setCurrentView} 
        currentUser={currentUser}
        isMobileOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />
      
      {/* 4. Contenido Principal */}
      <main className="main-content">
        {/* Fila de controles superiores (desktop: Sync Indicator + Theme Toggle) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%' }}>
          <div style={{ flex: 1 }}>
            <SyncIndicator />
          </div>
          
          {/* Botón de tema para Escritorio */}
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
