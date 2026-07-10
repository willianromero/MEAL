-- ============================================================================
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
update public.surveys set schema = '{"fields":[{"name":"full_name","label":"Nombre Completo del Pescador","type":"text","required":true},{"name":"genero","label":"Género","type":"select","options":["Masculino","Femenino","Otro"],"required":true},{"name":"edad","label":"Edad","type":"number","required":true},{"name":"clan","label":"Clan Wayuu de pertenencia (ej. Pushaina, Uriana, Epinayu)","type":"text","required":true},{"name":"location","label":"Corregimiento / Comunidad de Residencia","type":"select","options":["Mayapo","El Pájaro","Ranchería Aledaña Mayapo","Ranchería Aledaña El Pájaro"],"required":true},{"name":"association","label":"Asociación de Pescadores a la que pertenece","type":"select","options":["Asociación de Mayapo A","Asociación de Mayapo B","Asociación de El Pájaro A","Independiente / No asociado"],"required":true},{"name":"family_count","label":"Miembros dependientes en el núcleo familiar","type":"number","required":true},{"name":"fishing_only","label":"¿Es la pesca artesanal su única fuente de ingresos?","type":"select","options":["Sí, dependemos 100% de la pesca","No, alternamos con pastoreo/artesanías","No, alternamos con mototaxismo o comercio"],"required":true},{"name":"boat_motor","label":"¿Cuenta con embarcación y motor propio en buen estado?","type":"select","options":["Embarcación y motor propios operativos","Embarcación propia pero sin motor","No tiene activos propios (pesca de orilla)","Usa activos alquilados/prestados"],"required":true},{"name":"experiencia_turismo","label":"¿Ha prestado servicios turísticos antes?","type":"select","options":["Sí, recurrentemente","Sí, ocasionalmente","No, nunca"],"required":true},{"name":"equipos_seguridad_actuales","label":"Equipos de seguridad marítima con los que cuenta actualmente","type":"checklist","options":["Chalecos salvavidas","Radio de comunicación","GPS náutico","Botiquín","Ninguno"],"required":true},{"name":"comments","label":"Observaciones generales del diagnóstico","type":"textarea","required":false}]}'::jsonb where id = 'srv-wayuu-101';

-- 2) Encuesta 102: cultural_respect -> checklist de observables + intención de compra.
--    indicator_id se re-enlaza a IND-3.2 SI existe (fue creado por el usuario vía
--    la app, con id autogenerado); si no existe todavía, no cambia nada.
--    Recordatorio: indicator_id en el motor legado es decorativo (indicatorEngine
--    no lo lee), así que esto es solo para que la UI de Encuestas muestre el
--    indicador correcto.
update public.surveys set schema = '{"fields":[{"name":"agency_name","label":"Agencia de Viajes / Operadora Turística evaluadora","type":"text","required":true},{"name":"route_evaluated","label":"Experiencia Turística Evaluada","type":"select","options":["Pesca Ancestral Wayuu en Mayapo","Ruta de la Tortuga y Gastronomía en El Pájaro"],"required":true},{"name":"cultural_respect_checklist","label":"Elementos de pertinencia cultural evidenciados","type":"checklist","options":["Uso del idioma Wayuunaiki en la guianza","Interacción directa con autoridades tradicionales","Inclusión de relatos y saberes ancestrales","Consumo de gastronomía tradicional"],"required":true},{"name":"safety_equipment","label":"¿Se constató el uso riguroso de equipos de seguridad?","type":"select","options":["Sí, se cumplieron todos los protocolos DIMAR","Parcialmente (faltaban elementos)","No contaban con seguridad adecuada"],"required":true},{"name":"commercial_potential","label":"Potencial de inserción comercial (Modelo B2B)","type":"select","options":["Alto potencial","Medio potencial","Bajo potencial"],"required":true},{"name":"intencion_compra","label":"¿Estaría dispuesto a incluir esta ruta en el portafolio formal de su agencia?","type":"select","options":["Sí, de manera inmediata","Sí, si realizan ajustes técnicos/tarifarios","No por el momento"],"required":true},{"name":"improvement_points","label":"Recomendaciones de mejora identificadas","type":"textarea","required":false}]}'::jsonb where id = 'srv-wayuu-102';

update public.surveys
set indicator_id = (select id from public.indicators where tenant_id = 'ten-wayuu' and code = 'IND-3.2')
where id = 'srv-wayuu-102'
  and exists (select 1 from public.indicators where tenant_id = 'ten-wayuu' and code = 'IND-3.2');

-- 3) Fórmulas de cálculo automático (indicatorEngine), sobre los formularios
--    nuevos frm-wayuu-104..107 (créalos primero corriendo seed.sql, ver arriba).
update public.indicators set formula = '{"fuente":{"formulario_id":"frm-wayuu-104"},"operacion":"suma","campo":"numero_asistentes"}'::jsonb
where tenant_id = 'ten-wayuu' and code = 'IND-1.1';

update public.indicators set formula = '{"fuente":{"formulario_id":"frm-wayuu-105"},"operacion":"conteo"}'::jsonb
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
