import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
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

  // Tenants existentes en la BD local
  const allTenants = useLiveQuery(() => db.tenants.toArray(), [], []);

  // Membresías del usuario (en modo real filtran su acceso; en modo demo un
  // platform_admin ve todos los tenants sin membresía explícita).
  const memberships = useLiveQuery(
    () => (currentUser?.id ? db.memberships.where('usuario_id').equals(currentUser.id).toArray() : Promise.resolve([])),
    [currentUser?.id],
    []
  );

  // Tenants visibles para este usuario
  const tenants = useMemo(() => {
    if (!allTenants) return [];
    if (isPlatform) return allTenants; // plataforma ve el portafolio completo
    if (memberships && memberships.length > 0) {
      const ids = new Set(memberships.map(m => m.tenant_id));
      return allTenants.filter(t => ids.has(t.id));
    }
    // Fallback demo (sin Supabase, sin membresías sembradas): acceso a todos
    return allTenants;
  }, [allTenants, memberships, isPlatform]);

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
    // Fallback demo (sin membresías): si el rol de sesión ya es un rol de tenant
    // válido, se usa tal cual; de lo contrario se deriva del rol de plataforma.
    const raw = currentUser?.role;
    if (TENANT_ROLES.includes(raw)) return raw;
    if (isPlatform) return 'admin_tenant';
    return normalizeRole(raw) === 'coordinador' ? 'coordinador' : 'auditor';
  }, [memberships, activeTenantId, isPlatform, currentUser?.role]);

  const capabilities = useMemo(
    () => capabilitiesFor({ platformRole, tenantRole }),
    [platformRole, tenantRole]
  );

  const value = {
    tenants,
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
