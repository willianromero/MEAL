-- --------------------------------------------------------------------------
-- 0. Prerrequisito: la Data API con Neon Auth debe estar habilitada en esta
--    rama ANTES de correr este script. Al habilitarla, Neon crea los roles
--    `authenticated` / `anonymous` y la función auth.user_id() (extensión
--    pg_session_jwt) que usan todas las políticas RLS. Sin ellos el script
--    fallaría a mitad de camino con un error poco claro; aquí se detiene
--    antes de tocar nada y explica qué hacer.
-- --------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise exception 'Falta el rol "authenticated": primero habilita la Data API con Neon Auth (Consola Neon -> Data API -> Enable). Ver docs/MIGRACION_NEON.md, Paso 2.';
  end if;
  if to_regprocedure('auth.user_id()') is null then
    raise exception 'Falta la función auth.user_id(): primero habilita la Data API con Neon Auth (Consola Neon -> Data API -> Enable). Ver docs/MIGRACION_NEON.md, Paso 2.';
  end if;
end $$;
