-- ============================================================================
-- 007_postgis_rls_advisor.sql — Cierra el aviso del Security Advisor de
-- Supabase: "RLS Disabled in Public" sobre public.spatial_ref_sys.
--
-- Esa tabla la crea automáticamente la extensión PostGIS (activada en
-- 001_schema.sql para las coordenadas GPS de comunidades y registros de
-- campo). Contiene únicamente definiciones estándar de sistemas de
-- coordenadas (EPSG/WGS84, ~8000 filas de catálogo técnico público) — no
-- guarda ningún dato de la Fundación ni de ningún tenant. El linter la marca
-- igual porque cualquier tabla pública sin RLS activo se reporta como error.
--
-- Se activa RLS con una política de SOLO LECTURA pública: es necesario que
-- siga siendo legible por cualquier rol, porque las funciones internas de
-- PostGIS (usadas por las columnas `geog` de units/field_records) consultan
-- esta tabla para transformar coordenadas; restringirla más rompería la
-- georreferenciación de comunidades y registros de campo (RF-GEO-1).
--
-- Ejecutar en Supabase DESPUÉS de 001–006. Idempotente.
-- ============================================================================

alter table public.spatial_ref_sys enable row level security;

drop policy if exists spatial_ref_sys_public_read on public.spatial_ref_sys;
create policy spatial_ref_sys_public_read on public.spatial_ref_sys
  for select using (true);

-- Sin políticas de insert/update/delete: es un catálogo de solo lectura
-- mantenido por la extensión PostGIS, no por la aplicación.
