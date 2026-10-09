import React from 'react';
import { useTenant } from '../context/TenantContext';
import { CAP, can, roleLabel } from '../lib/roles';
import {
  LayoutDashboard,
  Briefcase,
  BarChart3,
  ClipboardList,
  MessageSquare,
  BookOpen,
  Globe,
  Building2,
  Layers,
  ClipboardCheck,
  UserSquare,
  FolderOpen,
  ScrollText,
  FileBarChart,
  Users as UsersIcon,
  UserCircle2,
  LogOut,
  X
} from 'lucide-react';

export default function Sidebar({ currentView, setCurrentView, currentUser, isMobileOpen, onClose, onLogout, hideNavigation = false }) {
  const { capabilities, tenantRole, platformRole, tenantConfig, isPlatform } = useTenant();
  const userEmail = currentUser?.email || '';

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
    { id: 'feedback', name: 'PQRS / Rendición de Cuentas', icon: <MessageSquare size={18} />, cap: CAP.VIEW_DASHBOARD },
    { id: 'beneficiaries', name: 'Beneficiarios', icon: <UserSquare size={18} />, cap: CAP.MANAGE_BENEFICIARIES },
    { id: 'repository', name: 'Repositorio Documental', icon: <FolderOpen size={18} />, cap: CAP.VIEW_CATALOG },
    { id: 'lessons', name: 'Lecciones Aprendidas', icon: <BookOpen size={18} />, cap: CAP.VIEW_DASHBOARD },
    { id: 'reports', name: 'Reportes y Export', icon: <FileBarChart size={18} />, cap: CAP.EXPORT },
    { id: 'audit', name: 'Bitácora de Auditoría', icon: <ScrollText size={18} />, cap: CAP.VIEW_AUDIT },
    { id: 'users', name: 'Usuarios del Proyecto', icon: <UsersIcon size={18} />, cap: CAP.MANAGE_USERS }
  ];

  const roleName = isPlatform ? roleLabel(platformRole) : (tenantRole ? roleLabel(tenantRole, tenantConfig) : 'Sin rol asignado');

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', padding: '0.5rem' }}>
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
            Plataforma MEAL
          </span>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>
            Fundación Guajira Competitiva
          </div>
        </div>
      </div>

      {/* Navegación (con desplazamiento propio: el bloque de sesión de abajo
          queda siempre visible aunque la lista sea larga) */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1, minHeight: 0, overflowY: 'auto', marginBottom: '0.75rem' }}>
        {!hideNavigation && navItems.map((item) => {
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

      {/* Sesión: quién está conectado, Mi cuenta y Cerrar sesión */}
      <div
        className="glass-card"
        style={{
          padding: '0.85rem',
          background: 'var(--bg-card-inner)',
          border: '1px solid var(--border-glass)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          flexShrink: 0
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={userEmail}>
            {userEmail}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{roleName}</div>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button
            onClick={() => { setCurrentView('account'); if (onClose) onClose(); }}
            className="btn btn-secondary"
            style={{ flex: 1, padding: '0.45rem', fontSize: '0.75rem', borderColor: currentView === 'account' ? 'var(--primary-color)' : undefined }}
          >
            <UserCircle2 size={15} /> Mi cuenta
          </button>
          <button
            onClick={onLogout}
            className="btn btn-danger"
            style={{ flex: 1, padding: '0.45rem', fontSize: '0.75rem' }}
          >
            <LogOut size={15} /> Salir
          </button>
        </div>
      </div>
    </aside>
  );
}
