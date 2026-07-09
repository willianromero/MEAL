// Constantes de configuración por defecto de la plataforma, sin dependencias
// (para poder importarlas tanto desde la app como desde scripts de Node).

// Niveles PQRS por defecto (DRT Anexo B). Cada tenant puede sobreescribirlos.
export const DEFAULT_PQRS_LEVELS = [
  { nivel: 'verde', sla_horas: 72, responsables: ['gestor'], descripcion: 'Informativa / inconformidad aislada' },
  { nivel: 'amarillo', sla_horas: 48, responsables: ['coordinador'], descripcion: 'Inconformidad recurrente / tensión localizada' },
  { nivel: 'naranja', sla_horas: 24, responsables: ['coordinador', 'director'], descripcion: 'Conflicto activo / riesgo de bloqueo' },
  { nivel: 'rojo', sla_horas: 0, responsables: ['director', 'coordinador'], descripcion: 'Riesgo a vida/integridad, VBG, bloqueo crítico (atención inmediata)' }
];

// Nombres de rol por defecto (el tenant puede renombrarlos, DRT 17.3)
export const DEFAULT_ROLE_NAMES = {
  gestor: 'Gestor de Campo',
  coordinador: 'Coordinador',
  director: 'Director del Proyecto',
  admin_fin: 'Profesional Administrativo y Financiero',
  admin_tenant: 'Administrador del Proyecto',
  financiador: 'Financiador (consulta)',
  auditor: 'Auditor (consulta)'
};
