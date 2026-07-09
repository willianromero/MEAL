import { tenantWayuu } from './tenantWayuu.js';
import { tenantMaicao } from './tenantMaicao.js';
import { tenantHocol } from './tenantHocol.js';

// Registro de tenants a sembrar. Dar de alta un proyecto nuevo = agregar aquí
// su archivo de configuración (o crearlo desde la consola de tenants), sin
// modificar la lógica de la plataforma (DRT: "configuración, no código").
export const TENANT_SEEDS = [tenantWayuu, tenantMaicao, tenantHocol];
