import React, { useState, useEffect } from 'react';
import { seedLocalData } from './db';
import Sidebar from './components/Sidebar';
import SyncIndicator from './components/SyncIndicator';

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
  
  // Cargar sesión inicial de localStorage o iniciar con Oficial de Campo simulado por defecto
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('meal_user_session');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error cargando sesión local:', e);
      }
    }
    // Sesión por defecto para desarrollo rápido sin bloqueos
    return {
      id: 'mock-initial-officer-id',
      email: 'campo@meal.org',
      role: 'officer'
    };
  });

  // Sembrar base de datos local en IndexedDB al montar el componente
  useEffect(() => {
    seedLocalData();
  }, []);

  // Función de renderizado condicional de vistas
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
      {/* Barra de navegación lateral fija */}
      <Sidebar 
        currentView={currentView} 
        setCurrentView={setCurrentView} 
        currentUser={currentUser} 
      />
      
      {/* Sección principal de la app */}
      <main className="main-content">
        {/* Cabecera global con estado de sincronización offline-first */}
        <SyncIndicator />
        
        {/* Vista activa */}
        <div style={{ marginTop: '0.5rem', minHeight: '80vh' }}>
          {renderView()}
        </div>
      </main>
    </div>
  );
}
