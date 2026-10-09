import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { isBackendConfigured } from '../backendClient';
import { capabilitiesFor, isPlatformRole, normalizeRole, TENANT_ROLES } from '../lib/roles';

// Contexto de tenant activo (DRT Sección 17): la sesión fija un tenant y todo
// el trabajo se realiza dentro de él. Aísla los datos en la capa de UI; el
// backend (RLS) lo refuerza de forma independiente.
const TenantContext = createContext(null);

const ACTIVE_TENANT_KEY = 'meal_active_tenant';

export function TenantProvider({ currentUser, children }) {
  const platformRole = normalizeRole(currentUser?.role);
  const isPlatform = isPlatformRole(platformRole);

  const [activeTenantId, setActiveTenantIdState] = useState(
    () => localStorage.getItem(ACTIVE_TENANT_KEY) || null
  );

  // Tenants existentes en la BD local. Un proyecto 'cerrado' salió de la
  // plataforma: no se muestra a nadie (su historial sigue en la bitácora).
  const allTenants = useLiveQuery(() => db.tenants.filter(t => t.estado !== 'cerrado').toArray(), [], []);

  // Membresías del usuario (en modo real filtran su acceso; en modo demo un
  // platform_admin ve todos los tenants sin membresía explícita).
  const memberships = useLiveQuery(
    () => (currentUser?.id ? db.memberships.where('usuario_id').equals(currentUser.id).toArray() : Promise.resolve([])),
    [currentUser?.id],
    []
  );

  // Tenants de los que el usuario es miembro (sin filtrar por estado todavía)
  const memberTenants = useMemo(() => {
    if (!allTenants) return [];
    if (memberships && memberships.length > 0) {
      const ids = new Set(memberships.map(m => m.tenant_id));
      return allTenants.filter(t => ids.has(t.id));
    }
    // Solo en modo local (sin servidor) no hay membresías: acceso a todos. Con
    // servidor, sin membresía no hay proyecto (cuenta nueva aún sin asignar).
    return isBackendConfigured ? [] : allTenants;
  }, [allTenants, memberships]);

  // Tenants OPERABLES para este usuario: la plataforma ve el portafolio
  // completo (incluidos suspendidos, para poder reactivarlos); un miembro de
  // tenant solo puede seleccionar/trabajar en proyectos con estado 'activo'
  // (un proyecto suspendido queda bloqueado también en el backend, RLS 005).
  const tenants = useMemo(() => {
    if (isPlatform) return allTenants || [];
    return memberTenants.filter(t => (t.estado || 'activo') === 'activo');
  }, [allTenants, memberTenants, isPlatform]);

  // Proyectos del usuario que están suspendidos/cerrados (para avisarle en
  // vez de que el proyecto simplemente desaparezca sin explicación).
  const suspendedMemberTenants = useMemo(
    () => (isPlatform ? [] : memberTenants.filter(t => (t.estado || 'activo') !== 'activo')),
    [memberTenants, isPlatform]
  );

  // Fijar un tenant activo por defecto cuando haya tenants disponibles
  useEffect(() => {
    if (tenants.length === 0) return;
    const stillValid = activeTenantId && tenants.some(t => t.id === activeTenantId);
    if (!stillValid) {
      const first = tenants[0].id;
      setActiveTenantIdState(first);
      localStorage.setItem(ACTIVE_TENANT_KEY, first);
    }
  }, [tenants, activeTenantId]);

  const setActiveTenant = (tenantId) => {
    setActiveTenantIdState(tenantId);
    localStorage.setItem(ACTIVE_TENANT_KEY, tenantId);
  };

  const activeTenant = useMemo(
    () => tenants.find(t => t.id === activeTenantId) || null,
    [tenants, activeTenantId]
  );

  // Rol efectivo del usuario dentro del tenant activo
  const tenantRole = useMemo(() => {
    if (!activeTenantId) return null;
    const m = (memberships || []).find(x => x.tenant_id === activeTenantId && x.activo !== false);
    if (m) return m.rol;
    // El Administrador de Plataforma opera cualquier proyecto como su
    // administrador (el backend lo refleja con is_platform_admin()).
    if (isPlatform) return 'admin_tenant';
    if (isBackendConfigured) return null; // sin membresía no hay rol
    // Modo local (sin servidor): el rol de sesión, si es de tenant.
    const raw = currentUser?.role;
    return TENANT_ROLES.includes(raw) ? raw : 'auditor';
  }, [memberships, activeTenantId, isPlatform, currentUser?.role]);

  const capabilities = useMemo(
    () => capabilitiesFor({ platformRole, tenantRole }),
    [platformRole, tenantRole]
  );

  const value = {
    tenants,
    suspendedMemberTenants,
    activeTenant,
    activeTenantId,
    setActiveTenant,
    isPlatform,
    platformRole,
    tenantRole,
    capabilities,
    tenantConfig: activeTenant?.config || {},
    currentUser
  };

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant debe usarse dentro de <TenantProvider>');
  return ctx;
}

// Helper de consulta scopeada: garantiza que toda lectura filtre por tenant.
export function tenantWhere(activeTenantId, extra = {}) {
  return { tenant_id: activeTenantId, ...extra };
}
