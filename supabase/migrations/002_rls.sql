-- ============================================================================
-- Aislamiento multi-tenant con Row-Level Security (DRT Secciones 11.0 y 17.2)
-- Defensa en profundidad: además del filtro de la aplicación, PostgreSQL
-- fuerza el aislamiento aunque el cliente falle o manipule identificadores.
-- ============================================================================

-- --------------------------------------------------------------------------
-- Funciones auxiliares de contexto (SECURITY DEFINER para evitar recursión
-- de RLS al consultar memberships/profiles desde las políticas)
-- --------------------------------------------------------------------------

create or replace function public.current_user_id()
returns text language sql stable as $$
  select coalesce(auth.uid()::text, '')
$$;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    where p.id = public.current_user_id() and p.role = 'platform_admin'
  )
$$;

create or replace function public.is_platform_direccion()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    where p.id = public.current_user_id() and p.role in ('platform_admin','platform_direccion')
  )
$$;

-- ¿El usuario autenticado es miembro activo del tenant?
create or replace function public.is_member_of(t text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.usuario_id = public.current_user_id()
      and m.tenant_id = t
      and m.activo
  )
$$;

-- ¿El usuario tiene alguno de estos roles dentro del tenant?
create or replace function public.has_tenant_role(t text, roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.usuario_id = public.current_user_id()
      and m.tenant_id = t
      and m.activo
      and m.rol = any(roles)
  )
$$;

-- --------------------------------------------------------------------------
-- Activar y forzar RLS en todas las tablas
-- --------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'tenants','profiles','memberships','units','program_lines','projects',
    'logframes','beneficiaries','consents','forms','field_records','evidences',
    'indicators','indicator_values','feedbacks','lessons_learned','surveys',
    'survey_responses','audit_log'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- --------------------------------------------------------------------------
-- tenants: los miembros ven su tenant; solo el admin de plataforma crea/edita
-- --------------------------------------------------------------------------

drop policy if exists tenants_select on public.tenants;
create policy tenants_select on public.tenants for select
  using (public.is_member_of(id) or public.is_platform_direccion());

drop policy if exists tenants_insert on public.tenants;
create policy tenants_insert on public.tenants for insert
  with check (public.is_platform_admin());

drop policy if exists tenants_update on public.tenants;
create policy tenants_update on public.tenants for update
  using (public.is_platform_admin() or public.has_tenant_role(id, array['admin_tenant']))
  with check (public.is_platform_admin() or public.has_tenant_role(id, array['admin_tenant']));

-- --------------------------------------------------------------------------
-- profiles: cada quien ve/edita su perfil; plataforma ve todos
-- --------------------------------------------------------------------------

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (
    id = public.current_user_id()
    or public.is_platform_direccion()
    -- los miembros de un tenant ven los perfiles de sus co-miembros
    or exists (
      select 1 from public.memberships m1
      join public.memberships m2 on m1.tenant_id = m2.tenant_id
      where m1.usuario_id = public.current_user_id() and m1.activo
        and m2.usuario_id = profiles.id and m2.activo
    )
  );

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert
  with check (id = public.current_user_id() or public.is_platform_admin());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (id = public.current_user_id() or public.is_platform_admin())
  with check (
    -- nadie se auto-promueve a rol de plataforma
    (id = public.current_user_id() and role = 'user') or public.is_platform_admin()
  );

-- --------------------------------------------------------------------------
-- memberships: gestionadas por el Administrador de Tenant dentro de su tenant
-- (HU-11: solo puede asignar roles dentro de su propio tenant)
-- --------------------------------------------------------------------------

drop policy if exists memberships_select on public.memberships;
create policy memberships_select on public.memberships for select
  using (
    usuario_id = public.current_user_id()
    or public.is_member_of(tenant_id)
    or public.is_platform_direccion()
  );

drop policy if exists memberships_write on public.memberships;
create policy memberships_write on public.memberships for insert
  with check (public.is_platform_admin() or public.has_tenant_role(tenant_id, array['admin_tenant']));

drop policy if exists memberships_update on public.memberships;
create policy memberships_update on public.memberships for update
  using (public.is_platform_admin() or public.has_tenant_role(tenant_id, array['admin_tenant']))
  with check (public.is_platform_admin() or public.has_tenant_role(tenant_id, array['admin_tenant']));

-- --------------------------------------------------------------------------
-- Patrón genérico para tablas operativas con tenant_id:
--   SELECT: miembros del tenant
--   INSERT/UPDATE: roles de escritura del tenant
--   DELETE: sin política (prohibido; las correcciones se versionan)
-- --------------------------------------------------------------------------

do $$
declare
  t text;
  write_roles text := $r$array['gestor','coordinador','director','admin_fin','admin_tenant']$r$;
  admin_roles text := $r$array['coordinador','admin_tenant']$r$;
begin
  -- Tablas donde escriben los roles operativos (incluido el gestor de campo)
  foreach t in array array[
    'field_records','evidences','survey_responses','feedbacks','beneficiaries','consents'
  ] loop
    execute format('drop policy if exists %1$s_select on public.%1$I', t);
    execute format(
      'create policy %1$s_select on public.%1$I for select using (public.is_member_of(tenant_id) or public.is_platform_admin())', t);
    execute format('drop policy if exists %1$s_insert on public.%1$I', t);
    execute format(
      'create policy %1$s_insert on public.%1$I for insert with check (public.has_tenant_role(tenant_id, %2$s))', t, write_roles);
    execute format('drop policy if exists %1$s_update on public.%1$I', t);
    execute format(
      'create policy %1$s_update on public.%1$I for update using (public.has_tenant_role(tenant_id, %2$s)) with check (public.has_tenant_role(tenant_id, %2$s))', t, write_roles);
  end loop;

  -- Catálogos y configuración: solo roles administrativos del tenant (8.4)
  foreach t in array array[
    'units','program_lines','projects','logframes','forms','indicators',
    'indicator_values','surveys','lessons_learned'
  ] loop
    execute format('drop policy if exists %1$s_select on public.%1$I', t);
    execute format(
      'create policy %1$s_select on public.%1$I for select using (public.is_member_of(tenant_id) or public.is_platform_admin())', t);
    execute format('drop policy if exists %1$s_insert on public.%1$I', t);
    execute format(
      'create policy %1$s_insert on public.%1$I for insert with check (public.has_tenant_role(tenant_id, %2$s) or public.is_platform_admin())', t, admin_roles);
    execute format('drop policy if exists %1$s_update on public.%1$I', t);
    execute format(
      'create policy %1$s_update on public.%1$I for update using (public.has_tenant_role(tenant_id, %2$s) or public.is_platform_admin()) with check (public.has_tenant_role(tenant_id, %2$s) or public.is_platform_admin())', t, admin_roles);
  end loop;
end $$;

-- --------------------------------------------------------------------------
-- audit_log: append-only. Se puede leer (miembros) e insertar (miembros),
-- pero NUNCA actualizar ni borrar: sin políticas de UPDATE/DELETE y con
-- privilegios revocados (7.3: "append-only; sin UPDATE/DELETE por diseño").
-- --------------------------------------------------------------------------

drop policy if exists audit_select on public.audit_log;
create policy audit_select on public.audit_log for select
  using (
    (tenant_id is not null and public.is_member_of(tenant_id))
    or public.is_platform_direccion()
  );

drop policy if exists audit_insert on public.audit_log;
create policy audit_insert on public.audit_log for insert
  with check (
    (tenant_id is not null and public.is_member_of(tenant_id))
    or public.is_platform_admin()
  );

revoke update, delete on public.audit_log from authenticated, anon;

-- --------------------------------------------------------------------------
-- Almacén de objetos: bucket único "evidencias" con carpetas por tenant.
-- La primera carpeta de la ruta es el tenant_id; solo sus miembros acceden.
-- --------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('evidencias', 'evidencias', false)
on conflict (id) do nothing;

drop policy if exists evidencias_select on storage.objects;
create policy evidencias_select on storage.objects for select
  using (bucket_id = 'evidencias' and public.is_member_of((storage.foldername(name))[1]));

drop policy if exists evidencias_insert on storage.objects;
create policy evidencias_insert on storage.objects for insert
  with check (
    bucket_id = 'evidencias'
    and public.has_tenant_role((storage.foldername(name))[1],
      array['gestor','coordinador','director','admin_fin','admin_tenant'])
  );
-- Sin políticas de UPDATE/DELETE: la evidencia es inmutable (principio 6.3-5).
