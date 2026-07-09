-- ============================================================================
-- 000_reset.sql — LIMPIEZA PREVIA (ejecutar ANTES de 001_schema.sql)
--
-- Elimina las tablas del PROTOTIPO ANTERIOR (v1) que quedaron en la instancia
-- de Supabase, para que el esquema nuevo (multi-tenant, DRT v2.0) se cree limpio
-- y con tipos consistentes (todos los id son `text`).
--
-- ⚠️ DESTRUCTIVO: borra los datos de esas tablas. Es SEGURO solo si esos datos
-- son del prototipo/pruebas y NO hay datos de producción reales todavía.
-- Si tuvieras datos reales, expórtalos antes (no es el caso en una instalación
-- nueva). CASCADE elimina también las políticas y triggers dependientes.
-- ============================================================================

drop table if exists public.audit_log cascade;
drop table if exists public.survey_responses cascade;
drop table if exists public.surveys cascade;
drop table if exists public.lessons_learned cascade;
drop table if exists public.feedbacks cascade;
drop table if exists public.indicator_values cascade;
drop table if exists public.indicators cascade;
drop table if exists public.evidences cascade;
drop table if exists public.field_records cascade;
drop table if exists public.forms cascade;
drop table if exists public.consents cascade;
drop table if exists public.beneficiaries cascade;
drop table if exists public.logframes cascade;
drop table if exists public.projects cascade;
drop table if exists public.program_lines cascade;
drop table if exists public.units cascade;
drop table if exists public.memberships cascade;
drop table if exists public.profiles cascade;
drop table if exists public.tenants cascade;

-- Tabla auxiliar del prototipo v1, si existiera
drop table if exists public.sync_meta cascade;

-- Funciones auxiliares del esquema nuevo (por si se corrió parcialmente antes)
drop function if exists public.current_user_id() cascade;
drop function if exists public.is_platform_admin() cascade;
drop function if exists public.is_platform_direccion() cascade;
drop function if exists public.is_member_of(text) cascade;
drop function if exists public.has_tenant_role(text, text[]) cascade;
drop function if exists public.fn_audit() cascade;
drop function if exists public.fn_protect_baseline() cascade;
drop function if exists public.fn_field_record_rules() cascade;
drop function if exists public.fn_evidence_immutable() cascade;
drop function if exists public.fn_check_consent() cascade;
drop function if exists public.fn_touch_updated_at() cascade;
