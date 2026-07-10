// Script de un solo uso: genera supabase/update_wayuu_formularios_ampliados.sql
// a partir de src/seeds/tenantWayuu.js (fuente de verdad ya corregida).
// No se integra al pipeline normal de seed (ver scripts/genSeedSql.mjs);
// existe para producir el UPDATE de aplicación directa sobre el tenant
// Wayuu YA sembrado en Supabase (que seedTenantConfig() no vuelve a tocar).
import { writeFileSync } from 'node:fs';
import { tenantWayuu } from '../src/seeds/tenantWayuu.js';

function sql(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

const s101 = tenantWayuu.surveys.find(s => s.id === 'srv-wayuu-101');
const s102 = tenantWayuu.surveys.find(s => s.id === 'srv-wayuu-102');
const iInd11 = tenantWayuu.indicators.find(i => i.code === 'IND-1.1');
const iInd21 = tenantWayuu.indicators.find(i => i.code === 'IND-2.1');

let out = `-- ============================================================================
-- update_wayuu_formularios_ampliados.sql — Aplicación directa (4ª revisión
-- experta MEAL, 2026) sobre el tenant Wayuu YA SEMBRADO en Supabase.
--
-- src/seeds/tenantWayuu.js es la fuente de verdad; este archivo traduce esos
-- cambios a UPDATE porque seed.sql usa "on conflict do nothing" y NO
-- sobreescribe filas existentes (srv-wayuu-101/102 e indicadores ya existen).
--
-- Uso: ejecutar en Supabase → SQL Editor. Es seguro reejecutarlo.
-- DESPUÉS, ejecutar también supabase/seed.sql completo (regenerado): es
-- idempotente y solo insertará las 5 filas nuevas en public.forms
-- (frm-wayuu-103..107), el resto se salta por "on conflict do nothing".
-- ============================================================================

-- 1) Encuesta 101: + género, edad, experiencia_turismo, equipos_seguridad_actuales
update public.surveys set schema = ${sql(s101.schema)} where id = 'srv-wayuu-101';

-- 2) Encuesta 102: cultural_respect -> checklist de observables + intención de compra.
--    indicator_id se re-enlaza a IND-3.2 SI existe (fue creado por el usuario vía
--    la app, con id autogenerado); si no existe todavía, no cambia nada.
--    Recordatorio: indicator_id en el motor legado es decorativo (indicatorEngine
--    no lo lee), así que esto es solo para que la UI de Encuestas muestre el
--    indicador correcto.
update public.surveys set schema = ${sql(s102.schema)} where id = 'srv-wayuu-102';

update public.surveys
set indicator_id = (select id from public.indicators where tenant_id = 'ten-wayuu' and code = 'IND-3.2')
where id = 'srv-wayuu-102'
  and exists (select 1 from public.indicators where tenant_id = 'ten-wayuu' and code = 'IND-3.2');

-- 3) Fórmulas de cálculo automático (indicatorEngine), sobre los formularios
--    nuevos frm-wayuu-104..107 (créalos primero corriendo seed.sql, ver arriba).
update public.indicators set formula = ${sql(iInd11.formula)}
where tenant_id = 'ten-wayuu' and code = 'IND-1.1';

update public.indicators set formula = ${sql(iInd21.formula)}
where tenant_id = 'ten-wayuu' and code = 'IND-2.1';

-- IND-4.1 e IND-4.2 fueron creados por el usuario vía la app (ids autogenerados
-- desconocidos aquí), por eso se ubican por código en vez de por id.
update public.indicators
set formula = '{"fuente":{"formulario_id":"frm-wayuu-107"},"operacion":"conteo"}'::jsonb
where tenant_id = 'ten-wayuu' and code = 'IND-4.1';

update public.indicators
set formula = '{"fuente":{"formulario_id":"frm-wayuu-106"},"operacion":"conteo"}'::jsonb
where tenant_id = 'ten-wayuu' and code = 'IND-4.2';

-- Verificación rápida
select id, indicator_id from public.surveys where id in ('srv-wayuu-101','srv-wayuu-102');
select code, formula from public.indicators where tenant_id = 'ten-wayuu' and code in ('IND-1.1','IND-2.1','IND-4.1','IND-4.2');
`;

writeFileSync(new URL('../supabase/update_wayuu_formularios_ampliados.sql', import.meta.url), out, 'utf8');
console.log('supabase/update_wayuu_formularios_ampliados.sql generado.');
