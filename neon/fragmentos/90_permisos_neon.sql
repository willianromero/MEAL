-- --------------------------------------------------------------------------
-- 90. Permisos de la Data API de Neon.
--     La Data API entra a Postgres como el rol `authenticated` (usuario con
--     sesión) o `anonymous` (sin sesión). Los GRANT dan acceso a las tablas;
--     las políticas RLS de 002–007 deciden QUÉ filas ve/escribe cada usuario.
--     Se reaplican aquí aunque se haya marcado "Grant public schema access"
--     al habilitar la Data API, para no depender de esa casilla.
-- --------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Bitácora append-only (7.3): sin UPDATE/DELETE para nadie de la app.
-- (Equivale al `revoke ... from authenticated, anon` de 002 en Supabase; va
-- DESPUÉS del grant general porque este lo volvería a otorgar.)
revoke update, delete on public.audit_log from authenticated;

-- Catálogo de sistemas de coordenadas que instala PostGIS: solo lectura.
revoke insert, update, delete on public.spatial_ref_sys from authenticated;

-- Sin sesión no se accede a nada.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anonymous') then
    execute 'revoke all on all tables in schema public from anonymous';
  end if;
end $$;
