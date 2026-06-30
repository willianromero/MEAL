import React from 'react';
import { 
  LayoutDashboard, 
  Briefcase, 
  BarChart3, 
  ClipboardList, 
  MessageSquare, 
  BookOpen, 
  ShieldCheck, 
  Globe,
  X
} from 'lucide-react';

export default function Sidebar({ currentView, setCurrentView, currentUser, isMobileOpen, onClose }) {
  const userRole = currentUser?.role || 'officer';
  const userEmail = currentUser?.email || 'anonimo@meal.org';

  // Mapeo de vistas y roles permitidos
  const navItems = [
    { id: 'dashboard', name: 'Dashboard', icon: <LayoutDashboard size={18} />, roles: ['admin', 'officer', 'viewer'] },
    { id: 'projects', name: 'Proyectos & LogFrames', icon: <Briefcase size={18} />, roles: ['admin', 'officer', 'viewer'] },
    { id: 'indicators', name: 'Indicadores MEAL', icon: <BarChart3 size={18} />, roles: ['admin', 'officer', 'viewer'] },
    { id: 'surveys', name: 'Encuestas Offline', icon: <ClipboardList size={18} />, roles: ['admin', 'officer'] },
    { id: 'feedback', name: 'Rendición de Cuentas', icon: <MessageSquare size={18} />, roles: ['admin', 'officer', 'viewer'] },
    { id: 'lessons', name: 'Lecciones Aprendidas', icon: <BookOpen size={18} />, roles: ['admin', 'officer', 'viewer'] },
    { id: 'auth', name: 'Sesión y Simulación', icon: <ShieldCheck size={18} />, roles: ['admin', 'officer', 'viewer'] }
  ];

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
      case 'admin': return 'rgba(239, 68, 68, 0.12)';
      case 'officer': return 'rgba(5, 150, 105, 0.12)';
      case 'viewer': return 'rgba(14, 165, 233, 0.12)';
      default: return 'rgba(255,255,255,0.05)';
    }
  };

  return (
    <aside className={`glass-panel sidebar-layout ${isMobileOpen ? 'open' : ''}`}>
      {/* Botón para cerrar menú móvil */}
      {isMobileOpen && (
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1rem',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '0.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Cerrar menú"
        >
          <X size={20} />
        </button>
      )}

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
          boxShadow: '0 4px 10px rgba(5,150,105,0.2)'
        }}>
          <Globe size={20} color="white" />
        </div>
        <div>
          <span style={{ fontSize: '1.15rem', fontWeight: 800, background: 'linear-gradient(135deg, var(--primary-light) 0%, var(--secondary-light) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            MEAL System
          </span>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>
            Guardianes Wayuu
          </div>
        </div>
      </div>

      {/* Navegación */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
        {navItems.map((item) => {
          const hasAccess = item.roles.includes(userRole);
          if (!hasAccess) return null;

          const isActive = currentView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => {
                setCurrentView(item.id);
                if (onClose) onClose(); // Auto cerrar menú al hacer clic en móvil
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                width: '100%',
                padding: '0.65rem 0.85rem',
                border: '1px solid transparent',
                borderRadius: '8px',
                background: isActive ? 'rgba(5, 150, 105, 0.12)' : 'transparent',
                borderColor: isActive ? 'rgba(5, 150, 105, 0.2)' : 'transparent',
                color: isActive ? 'var(--primary-light)' : 'var(--text-secondary)',
                cursor: 'pointer',
                textAlign: 'left',
                fontWeight: isActive ? '600' : '500',
                transition: 'var(--transition-smooth)'
              }}
            >
              {item.icon}
              <span style={{ fontSize: '0.85rem' }}>{item.name}</span>
            </button>
          );
        })}
      </nav>

      {/* Información del perfil */}
      <div 
        className="glass-card" 
        style={{ 
          marginTop: 'auto', 
          padding: '0.85rem', 
          background: 'var(--bg-card-inner)', 
          border: '1px solid var(--border-glass)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem'
        }}
      >
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={userEmail}>
          Usuario: {userEmail}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Rol:</span>
          <span 
            className="badge" 
            style={{ 
              background: getRoleBadgeColor(userRole),
              color: userRole === 'admin' ? '#fca5a5' : userRole === 'officer' ? '#a7f3d0' : '#e0f2fe',
              border: `1px solid ${userRole === 'admin' ? 'rgba(239, 68, 68, 0.25)' : userRole === 'officer' ? 'rgba(5, 150, 105, 0.25)' : 'rgba(14, 165, 233, 0.25)'}`,
              padding: '0.1rem 0.4rem', 
              fontSize: '0.65rem' 
            }}
          >
            {getRoleLabel(userRole)}
          </span>
        </div>
        
        <button
          onClick={() => {
            setCurrentView('auth');
            if (onClose) onClose();
          }}
          style={{
            marginTop: '0.4rem',
            width: '100%',
            padding: '0.35rem',
            fontSize: '0.7rem',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border-glass)',
            borderRadius: '6px',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          Simular otro Rol
        </button>
      </div>
    </aside>
  );
}
