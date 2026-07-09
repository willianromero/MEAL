// ============================================================================
// Modelo de roles y capacidades (DRT v2.0, Sección 3.2 y 11.3)
// Dos niveles: plataforma (transversal, Fundación) y tenant (dentro de un
// proyecto). La separación de funciones se aplica como capacidades explícitas.
// ============================================================================

// Roles de nivel plataforma
export const PLATFORM_ROLES = ['platform_admin', 'platform_direccion'];

// Roles de nivel tenant (el nombre visible es configurable por tenant, 17.3)
export const TENANT_ROLES = [
  'gestor', 'coordinador', 'director', 'admin_fin', 'admin_tenant', 'financiador', 'auditor'
];

// Capacidades atómicas de la plataforma
export const CAP = {
  VIEW_DASHBOARD: 'view_dashboard',
  VIEW_CATALOG: 'view_catalog',
  EDIT_CATALOG: 'edit_catalog',       // unidades, líneas, proyectos, formularios, indicadores
  CAPTURE: 'capture',                 // diligenciar registros de campo / encuestas
  VALIDATE: 'validate',               // validar/rechazar registros (cola de calidad)
  APPROVE: 'approve',                 // aprobar informes / validación independiente
  VIEW_FINANCE: 'view_finance',
  EDIT_FINANCE: 'edit_finance',
  MANAGE_PQRS: 'manage_pqrs',
  VIEW_PQRS_IDENTITY: 'view_pqrs_identity', // ver identidad reservada del reportante
  MANAGE_BENEFICIARIES: 'manage_beneficiaries',
  MANAGE_USERS: 'manage_users',       // membresías dentro del tenant
  MANAGE_TENANTS: 'manage_tenants',   // consola de plataforma
  VIEW_AUDIT: 'view_audit',
  EXPORT: 'export',
  DELETE_CONFIG: 'delete_config'      // borrado definitivo de configuración (solo admin)
};

// Matriz rol → capacidades dentro del tenant activo (Sección 3.2)
const TENANT_CAPS = {
  gestor: [CAP.VIEW_DASHBOARD, CAP.VIEW_CATALOG, CAP.CAPTURE, CAP.MANAGE_BENEFICIARIES, CAP.MANAGE_PQRS],
  coordinador: [
    CAP.VIEW_DASHBOARD, CAP.VIEW_CATALOG, CAP.EDIT_CATALOG, CAP.VALIDATE,
    CAP.MANAGE_PQRS, CAP.VIEW_PQRS_IDENTITY, CAP.MANAGE_BENEFICIARIES, CAP.VIEW_AUDIT, CAP.EXPORT
  ],
  director: [
    CAP.VIEW_DASHBOARD, CAP.VIEW_CATALOG, CAP.APPROVE, CAP.VIEW_FINANCE,
    CAP.MANAGE_PQRS, CAP.VIEW_PQRS_IDENTITY, CAP.VIEW_AUDIT, CAP.EXPORT
  ],
  admin_fin: [CAP.VIEW_DASHBOARD, CAP.VIEW_CATALOG, CAP.VIEW_FINANCE, CAP.EDIT_FINANCE, CAP.EXPORT],
  admin_tenant: [
    CAP.VIEW_DASHBOARD, CAP.VIEW_CATALOG, CAP.EDIT_CATALOG, CAP.MANAGE_USERS,
    CAP.MANAGE_BENEFICIARIES, CAP.MANAGE_PQRS, CAP.VIEW_PQRS_IDENTITY, CAP.VIEW_AUDIT,
    CAP.EXPORT, CAP.DELETE_CONFIG
  ],
  financiador: [CAP.VIEW_DASHBOARD, CAP.VIEW_CATALOG, CAP.EXPORT],
  auditor: [CAP.VIEW_DASHBOARD, CAP.VIEW_CATALOG, CAP.VIEW_AUDIT, CAP.EXPORT]
};

// Capacidades de plataforma
const PLATFORM_CAPS = {
  platform_admin: [CAP.MANAGE_TENANTS, CAP.MANAGE_USERS, CAP.VIEW_DASHBOARD, CAP.VIEW_AUDIT, CAP.EXPORT, CAP.VIEW_CATALOG, CAP.EDIT_CATALOG, CAP.DELETE_CONFIG],
  platform_direccion: [CAP.VIEW_DASHBOARD, CAP.EXPORT] // solo portafolio agregado
};

// Compatibilidad con los roles demo heredados (admin/officer/viewer) para no
// romper las sesiones existentes: se mapean al modelo del DRT.
export const LEGACY_ROLE_MAP = {
  admin: 'platform_admin',
  officer: 'coordinador',
  viewer: 'auditor'
};

export function normalizeRole(role) {
  if (!role) return 'auditor';
  if (LEGACY_ROLE_MAP[role]) return LEGACY_ROLE_MAP[role];
  return role;
}

export function isPlatformRole(role) {
  return PLATFORM_ROLES.includes(normalizeRole(role));
}

// Capacidades efectivas de un usuario dado su rol de plataforma y su rol en el
// tenant activo. Un platform_admin además hereda capacidades administrativas.
export function capabilitiesFor({ platformRole, tenantRole }) {
  const caps = new Set();
  const pr = normalizeRole(platformRole);
  if (PLATFORM_CAPS[pr]) PLATFORM_CAPS[pr].forEach(c => caps.add(c));
  if (tenantRole && TENANT_CAPS[tenantRole]) TENANT_CAPS[tenantRole].forEach(c => caps.add(c));
  return caps;
}

export function can(caps, capability) {
  return caps instanceof Set ? caps.has(capability) : false;
}

// Etiqueta visible de un rol, respetando los nombres configurados por el tenant.
export function roleLabel(role, tenantConfig) {
  const configured = tenantConfig?.roles_nombres?.[role];
  if (configured) return configured;
  const defaults = {
    platform_admin: 'Administrador de Plataforma',
    platform_direccion: 'Dirección de la Fundación',
    gestor: 'Gestor de Campo',
    coordinador: 'Coordinador',
    director: 'Director del Proyecto',
    admin_fin: 'Profesional Administrativo y Financiero',
    admin_tenant: 'Administrador de Tenant',
    financiador: 'Financiador (consulta)',
    auditor: 'Auditor (consulta)'
  };
  return defaults[normalizeRole(role)] || role;
}
