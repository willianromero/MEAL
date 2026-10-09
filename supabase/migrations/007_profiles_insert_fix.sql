-- ============================================================================
-- 007_profiles_insert_fix.sql — Cierra una auto-promoción a Administrador de
-- Plataforma al CREAR el perfil propio.
--
-- 002 protegía el UPDATE de profiles ("nadie se auto-promueve a rol de
-- plataforma"), pero el INSERT solo exigía `id = current_user_id()`, sin mirar
-- el rol. Cualquier cuenta recién registrada en el servicio de autenticación
-- (el registro por email está abierto por defecto, tanto en Supabase como en
-- Neon Auth) podía insertar su propio perfil con role = 'platform_admin' vía
-- API y obtener acceso total a todos los tenants.
--
-- Ahora: uno mismo solo puede crear su perfil con role = 'user'; los roles de
-- plataforma los asigna únicamente un Administrador de Plataforma.
--
-- Ejecutar DESPUÉS de 001–006. Idempotente.
-- ============================================================================

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert
  with check (
    (id = public.current_user_id() and role = 'user')
    or public.is_platform_admin()
  );
