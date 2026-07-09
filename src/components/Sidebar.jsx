import React from 'react';
import { isSupabaseConfigured } from '../supabaseClient';
import { useTenant } from '../context/TenantContext';
import { CAP, can, roleLabel } from '../lib/roles';
import {
  LayoutDashboard,
  Briefcase,
  BarChart3,
  ClipboardList,
  MessageSquare,
  BookOpen,
  ShieldCheck,
  Globe,
  Building2,
  Layers,
  ClipboardCheck,
  UserSquare,
  FolderOpen,
  ScrollText,
  FileBarChart,
  Users as UsersIcon,
  X
} from 'lucide-react';

export default function Sidebar({ currentView, setCurrentView, currentUser, isMobileOpen, onClose, onLogout }) {
  const { capabilities, tenantRole, platformRole, tenantConfig, isPlatform } = useTenant();
  const userEmail = currentUser?.email || 'anonimo@meal.org';

  // Navegación gobernada por capacidades (DRT 3.2). La segregación de funciones
  // decide qué módulos ve cada rol, no una lista fija de roles por vista.
  const navItems = [
    { id: 'dashboard', name: 'Dashboard', icon: <LayoutDashboard size={18} />, cap: CAP.VIEW_DASHBOARD },
    { id: 'tenants', name: 'Consola de Proyectos', icon: <Building2 size={18} />, cap: CAP.MANAGE_TENANTS },
    { id: 'projects', name: 'Proyectos & Marco Lógico', icon: <Briefcase size={18} />, cap: CAP.VIEW_CATALOG },
    { id: 'catalog', name: 'Catálogo Maestro', icon: <Layers size={18} />, cap: CAP.VIEW_CATALOG },
    { id: 'formbuilder', name: 'Formularios', icon: <ClipboardList size={18} />, cap: CAP.EDIT_CATALOG },
    { id: 'indicators', name: 'Indicadores MEAL', icon: <BarChart3 size={18} />, cap: CAP.VIEW_CATALOG },
    { id: 'capture', name: 'Captura Offline', icon: <ClipboardList size={18} />, cap: CAP.CAPTURE },
    { id: 'validation', name: 'Cola de Validación', icon: <ClipboardCheck size={18} />, cap: CAP.VALIDATE },
    { id: 'surveys', name: 'Encuestas (legado)', icon: <ClipboardList size={18} />, cap: CAP.CAPTURE },
    { id: 'feedback', name: 'PQRS / Rendición de Cuentas', icon: <MessageSquare size={18} />, cap: CAP.VIEW_DASHBOARD },
    { id: 'beneficiaries', name: 'Beneficiarios', icon: <UserSquare size={18} />, cap: CAP.MANAGE_BENEFICIARIES },
    { id: 'repository', name: 'Repositorio Documental', icon: <FolderOpen size={18} />, cap: CAP.VIEW_CATALOG },
    { id: 'lessons', name: 'Lecciones Aprendidas', icon: <BookOpen size={18} />, cap: CAP.VIEW_DASHBOARD },
    { id: 'reports', name: 'Reportes y Export', icon: <FileBarChart size={18} />, cap: CAP.EXPORT },
    { id: 'audit', name: 'Bitácora de Auditoría', icon: <ScrollText size={18} />, cap: CAP.VIEW_AUDIT },
    { id: 'users', name: 'Usuarios del Proyecto', icon: <UsersIcon size={18} />, cap: CAP.MANAGE_USERS },
    { id: 'auth', name: 'Sesión de Acceso', icon: <ShieldCheck size={18} />, cap: null }
  ];

  const effectiveRole = isPlatform ? platformRole : (tenantRole || platformRole);
  const roleName = roleLabel(effectiveRole, tenantConfig);
  const badgeColor = isPlatform ? 'rgba(239, 68, 68, 0.12)' : 'rgba(5, 150, 105, 0.12)';
  const badgeText = isPlatform ? '#fca5a5' : '#a7f3d0';

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
            Multi-proyecto
          </div>
        </div>
      </div>

      {/* Navegación */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
        {navItems.map((item) => {
          const hasAccess = item.cap === null || can(capabilities, item.cap);
          if (!hasAccess) return null;

          const isActive = currentView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => {
                setCurrentView(item.id);
                if (onClose) onClose(); // Auto cerrar menú en móviles
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Rol:</span>
          <span
            className="badge"
            style={{
              background: badgeColor,
              color: badgeText,
              border: `1px solid ${isPlatform ? 'rgba(239, 68, 68, 0.25)' : 'rgba(5, 150, 105, 0.25)'}`,
              padding: '0.1rem 0.4rem',
              fontSize: '0.65rem',
              textAlign: 'right'
            }}
          >
            {roleName}
          </span>
        </div>
        
        {/* Botón de simulación rápido oculto en producción (Supabase real conectado) */}
        {!isSupabaseConfigured && (
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
        )}

        {/* Botón permanente de Cerrar Sesión en la Barra Lateral */}
        {currentUser && (
          <button
            onClick={onLogout}
            style={{
              marginTop: '0.4rem',
              width: '100%',
              padding: '0.45rem',
              fontSize: '0.75rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '6px',
              color: '#fca5a5',
              cursor: 'pointer',
              fontWeight: '600',
              textAlign: 'center',
              transition: 'var(--transition-smooth)'
            }}
          >
            Cerrar Sesión
          </button>
        )}
      </div>
    </aside>
  );
}
