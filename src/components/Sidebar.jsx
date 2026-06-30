import React from 'react';
import { 
  LayoutDashboard, 
  Briefcase, 
  BarChart3, 
  ClipboardList, 
  MessageSquare, 
  BookOpen, 
  ShieldCheck, 
  Globe 
} from 'lucide-react';

export default function Sidebar({ currentView, setCurrentView, currentUser }) {
  
  const userRole = currentUser?.role || 'officer'; // Por defecto: oficial de campo
  const userEmail = currentUser?.email || 'anonimo@meal.org';

  // Mapeo de vistas disponibles y roles requeridos
  const navItems = [
    { id: 'dashboard', name: 'Dashboard', icon: <LayoutDashboard size={18} />, roles: ['admin', 'officer', 'viewer'] },
    { id: 'projects', name: 'Proyectos & LogFrames', icon: <Briefcase size={18} />, roles: ['admin', 'officer', 'viewer'] },
    { id: 'indicators', name: 'Indicadores MEAL', icon: <BarChart3 size={18} />, roles: ['admin', 'officer', 'viewer'] },
    { id: 'surveys', name: 'Encuestas Offline', icon: <ClipboardList size={18} />, roles: ['admin', 'officer'] },
    { id: 'feedback', name: 'Rendición de Cuentas', icon: <MessageSquare size={18} />, roles: ['admin', 'officer', 'viewer'] },
    { id: 'lessons', name: 'Lecciones Aprendidas', icon: <BookOpen size={18} />, roles: ['admin', 'officer', 'viewer'] },
    { id: 'auth', name: 'Sesión y Simulación', icon: <ShieldCheck size={18} />, roles: ['admin', 'officer', 'viewer'] }
  ];

  // Traducir rol al español para mostrar en la interfaz
  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'officer': return 'Oficial de Campo';
      case 'viewer': return 'Visualizador';
      default: return role;
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin': return 'rgba(239, 68, 68, 0.2)'; // Rojo semi
      case 'officer': return 'rgba(5, 150, 105, 0.2)'; // Esmeralda semi
      case 'viewer': return 'rgba(14, 165, 233, 0.2)'; // Azul semi
      default: return 'rgba(255,255,255,0.1)';
    }
  };

  return (
    <aside 
      className="glass-panel" 
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        bottom: 0, 
        width: '260px', 
        borderRadius: 0, 
        borderRight: '1px solid var(--border-glass)', 
        borderTop: 'none',
        borderBottom: 'none',
        borderLeft: 'none',
        display: 'flex', 
        flexDirection: 'column', 
        zIndex: 100,
        padding: '1.5rem 1rem'
      }}
    >
      {/* Brand Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', padding: '0.5rem' }}>
        <div style={{ 
          background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%)', 
          width: '36px', 
          height: '36px', 
          borderRadius: '8px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          boxShadow: '0 4px 10px rgba(5,150,105,0.3)'
        }}>
          <Globe size={20} color="white" />
        </div>
        <div>
          <span style={{ fontSize: '1.25rem', fontWeight: 800, background: 'linear-gradient(135deg, #a7f3d0 0%, #2dd4bf 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            MEAL System
          </span>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>
            Offline-First v1.0
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
        {navItems.map((item) => {
          // Filtrar por rol de usuario
          const hasAccess = item.roles.includes(userRole);
          if (!hasAccess) return null;

          const isActive = currentView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                width: '100%',
                padding: '0.75rem 1rem',
                border: '1px solid transparent',
                borderRadius: '10px',
                background: isActive ? 'rgba(5, 150, 105, 0.15)' : 'transparent',
                borderColor: isActive ? 'rgba(5, 150, 105, 0.25)' : 'transparent',
                color: isActive ? 'var(--primary-light)' : 'var(--text-secondary)',
                cursor: 'pointer',
                textAlign: 'left',
                fontWeight: isActive ? '600' : '500',
                transition: 'var(--transition-smooth)'
              }}
            >
              {item.icon}
              <span style={{ fontSize: '0.9rem' }}>{item.name}</span>
            </button>
          );
        })}
      </nav>

      {/* User Info & Role Simulation */}
      <div 
        className="glass-card" 
        style={{ 
          marginTop: 'auto', 
          padding: '1rem', 
          background: 'rgba(15, 23, 42, 0.5)', 
          border: '1px solid var(--border-glass)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}
      >
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={userEmail}>
          Sesión: {userEmail}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.25rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Rol:</span>
          <span 
            className="badge" 
            style={{ 
              background: getRoleBadgeColor(userRole),
              color: userRole === 'admin' ? '#fca5a5' : userRole === 'officer' ? '#a7f3d0' : '#e0f2fe',
              border: `1px solid ${userRole === 'admin' ? 'rgba(239, 68, 68, 0.4)' : userRole === 'officer' ? 'rgba(5, 150, 105, 0.4)' : 'rgba(14, 165, 233, 0.4)'}`,
              padding: '0.15rem 0.5rem', 
              fontSize: '0.7rem' 
            }}
          >
            {getRoleLabel(userRole)}
          </span>
        </div>
        
        {/* Atajo rápido para simular rol alternativo */}
        <button
          onClick={() => setCurrentView('auth')}
          style={{
            marginTop: '0.5rem',
            width: '100%',
            padding: '0.4rem',
            fontSize: '0.75rem',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--border-glass)',
            borderRadius: '6px',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontWeight: '600',
            textAlign: 'center'
          }}
        >
          Cambiar Simulación
        </button>
      </div>
    </aside>
  );
}
