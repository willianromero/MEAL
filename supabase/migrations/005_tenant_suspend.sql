-- ============================================================================
-- 005_tenant_suspend.sql — Hace funcional el estado "suspendido" de un tenant.
--
-- Antes de esta migración, `tenants.estado` existía pero NO lo verificaba
-- ninguna política RLS ni el frontend: suspender un proyecto en la Consola de
-- Proyectos cambiaba la etiqueta pero no bloqueaba nada.
--
-- Diseño: `is_member_of()` y `has_tenant_role()` (usadas por prácticamente
-- todas las políticas de las tablas operativas, ver 002_rls.sql) ahora exigen
-- además que el tenant esté "activo". Como TODAS esas políticas ya incluyen
-- `... or public.is_platform_admin()`, el Administrador de Plataforma
-- conserva acceso completo para poder reactivar el proyecto.
--
-- La tabla `tenants` en sí usa una variante SIN el filtro de estado
-- (`is_member_of_any_state`), para que un miembro pueda seguir viendo que su
-- proyecto existe y está suspendido, en vez de que desaparezca sin explicación.
--
-- Ejecutar en Supabase DESPUÉS de 001–004. Idempotente.
-- ============================================================================

-- Membresía activa SIN importar el estado del tenant (solo para la propia
-- fila de `tenants`, así el usuario ve que su proyecto quedó suspendido).
create or replace function public.is_member_of_any_state(t text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.usuario_id = public.current_user_id()
      and m.tenant_id = t
      and m.activo
  )
$$;

-- is_member_of ahora exige además tenants.estado = 'activo': bloquea el
-- acceso de lectura a TODA la data operativa de un proyecto suspendido/cerrado.
create or replace function public.is_member_of(t text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_member_of_any_state(t) and exists (
    select 1 from tenants tn where tn.id = t and tn.estado = 'activo'
  )
$$;

-- has_tenant_role ídem para escritura (insert/update/delete de configuración
-- y captura). Un admin_tenant de un proyecto suspendido tampoco puede
-- reactivarlo por sí mismo: solo el Administrador de Plataforma puede.
create or replace function public.has_tenant_role(t text, roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    join tenants tn on tn.id = m.tenant_id
    where m.usuario_id = public.current_user_id()
      and m.tenant_id = t
      and m.activo
      and m.rol = any(roles)
      and tn.estado = 'activo'
  )
$$;

-- La visibilidad del tenant en sí no depende del nuevo filtro de estado.
drop policy if exists tenants_select on public.tenants;
create policy tenants_select on public.tenants for select
  using (public.is_member_of_any_state(id) or public.is_platform_direccion());
