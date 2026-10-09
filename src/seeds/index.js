import { tenantHocol } from './tenantHocol.js';

// Registro de tenants a sembrar. La plataforma opera hoy un único convenio
// (Ecopetrol–Hocol); dar de alta otro proyecto = agregar aquí su archivo de
// configuración (o crearlo desde la consola de tenants), sin modificar la
// lógica de la plataforma (DRT: "configuración, no código").
export const TENANT_SEEDS = [tenantHocol];
