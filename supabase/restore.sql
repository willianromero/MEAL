-- ============================================================================
-- restore.sql — Restaurar la base al estado inicial (recién sembrado)
--
-- Borra TODOS los datos de configuración y operativos (incluida cualquier data
-- de pruebas), pero CONSERVA intactos:
--   • los usuarios (public.profiles)
--   • sus membresías (public.memberships)
--   • los proyectos raíz (public.tenants)
-- Así no tienes que volver a crear el usuario admin ni su rol.
--
-- Uso: ejecutar en Supabase → SQL Editor, y DESPUÉS volver a correr seed.sql.
-- Es seguro reejecutarlo. No toca la autenticación (Authentication → Users).
-- ============================================================================

truncate table
  public.audit_log,
  public.indicator_values,
  public.evidences,
  public.field_records,
  public.survey_responses,
  public.consents,
  public.beneficiaries,
  public.indicators,
  public.logframes,
  public.projects,
  public.forms,
  public.surveys,
  public.feedbacks,
  public.lessons_learned,
  public.units,
  public.program_lines
  cascade;

-- Comprobación: profiles, memberships y tenants deben seguir con sus filas.
select
  (select count(*) from public.profiles)    as usuarios,
  (select count(*) from public.memberships) as membresias,
  (select count(*) from public.tenants)     as proyectos,
  (select count(*) from public.indicators)  as indicadores_tras_reset;  -- debe ser 0
