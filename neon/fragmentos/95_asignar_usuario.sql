-- --------------------------------------------------------------------------
-- 95. Alta de usuarios por correo (solo desde el SQL Editor de Neon).
--     Reemplaza el paso de "copiar el UID" de Supabase: busca la cuenta en
--     Neon Auth por correo y crea/actualiza su perfil y su membresía.
--
--     Ejemplos:
--       select public.meal_asignar_usuario('admin@fundacionguajiracompetitiva.org',
--                                          'ten-hocol', 'admin_tenant', 'platform_admin');
--       select public.meal_asignar_usuario('gestor@ejemplo.org', 'ten-wayuu', 'gestor');
--
--     Solo la puede ejecutar el dueño de la base (SQL Editor): se revoca el
--     EXECUTE a todos los demás, porque permite asignar cualquier rol.
-- --------------------------------------------------------------------------
create or replace function public.meal_asignar_usuario(
  p_email text,
  p_tenant_id text default null,
  p_rol text default null,
  p_rol_plataforma text default 'user'
)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_id text;
begin
  select u.id::text into v_id
  from neon_auth."user" u
  where lower(u.email) = lower(trim(p_email));

  if v_id is null then
    raise exception 'No existe ninguna cuenta con el correo % en Neon Auth. Créala primero desde la pantalla de acceso de la app ("Crear cuenta").', p_email;
  end if;

  insert into profiles (id, email, role)
  values (v_id, lower(trim(p_email)), p_rol_plataforma)
  on conflict (id) do update
    set role = excluded.role, email = excluded.email, updated_at = now();

  if p_tenant_id is not null then
    if p_rol is null then
      raise exception 'Indica el rol dentro del proyecto % (gestor, coordinador, director, admin_fin, admin_tenant, financiador o auditor).', p_tenant_id;
    end if;
    insert into memberships (id, usuario_id, tenant_id, rol, activo)
    values (gen_random_uuid()::text, v_id, p_tenant_id, p_rol, true)
    on conflict (usuario_id, tenant_id) do update
      set rol = excluded.rol, activo = true, updated_at = now();
  end if;

  return v_id;
end $$;

revoke execute on function public.meal_asignar_usuario(text, text, text, text) from public;
revoke execute on function public.meal_asignar_usuario(text, text, text, text) from authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anonymous') then
    execute 'revoke execute on function public.meal_asignar_usuario(text, text, text, text) from anonymous';
  end if;
end $$;
