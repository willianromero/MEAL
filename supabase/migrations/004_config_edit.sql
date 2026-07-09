-- ============================================================================
-- 004_config_edit.sql — Edición, archivado (reversible) y borrado de configuración
-- Ejecutar en Supabase DESPUÉS de 001/002/003 (y del seed, si ya lo corriste).
-- Es idempotente: se puede reejecutar sin problema.
-- ============================================================================

-- 1) Columna `archivado` en las tablas de configuración (forms ya usa `activo`)
alter table public.indicators     add column if not exists archivado boolean not null default false;
alter table public.logframes      add column if not exists archivado boolean not null default false;
alter table public.projects       add column if not exists archivado boolean not null default false;
alter table public.units          add column if not exists archivado boolean not null default false;
alter table public.program_lines  add column if not exists archivado boolean not null default false;

-- 2) Políticas RLS de DELETE para las tablas de configuración.
--    Misma condición administrativa que el INSERT/UPDATE de catálogos (002).
do $$
declare
  t text;
  admin_del text := $r$public.has_tenant_role(tenant_id, array['coordinador','admin_tenant']) or public.is_platform_admin()$r$;
begin
  foreach t in array array['units','program_lines','projects','logframes','indicators','forms'] loop
    execute format('drop policy if exists %1$s_delete on public.%1$I', t);
    execute format('create policy %1$s_delete on public.%1$I for delete using (%2$s)', t, admin_del);
  end loop;
end $$;

-- 3) Extender la bitácora automática a las tablas de catálogo que faltaban,
--    para que archivar (UPDATE) y borrar (DELETE) queden auditados en servidor.
--    fn_audit() ya existe (003) y extrae tenant_id de forma segura vía jsonb.
do $$
declare
  t text;
begin
  foreach t in array array['units','program_lines','projects','logframes'] loop
    execute format('drop trigger if exists trg_audit_%1$s on public.%1$I', t);
    execute format(
      'create trigger trg_audit_%1$s after insert or update or delete on public.%1$I
       for each row execute function public.fn_audit()', t);
  end loop;
end $$;
