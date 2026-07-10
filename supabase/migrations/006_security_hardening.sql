-- ============================================================================
-- 006_security_hardening.sql — Cierra 3 brechas encontradas en auditoría
-- general (misma clase de problema que el bug de "Suspender": el servidor
-- permitía más de lo que la interfaz da a entender).
--
-- 1) El borrado definitivo (004) permitía a 'coordinador' además de
--    'admin_tenant', pero la app (CAP.DELETE_CONFIG) solo lo ofrece al
--    Administrador de Tenant. Se ajusta el servidor para que coincida.
-- 2) La validación de registros de campo solo bloqueaba la AUTO-validación
--    (separación de funciones), pero no exigía que quien valida tenga rol de
--    Coordinador/Administrador — un Gestor podría validar el dato de OTRO
--    Gestor si llamara la API directamente. Se agrega el chequeo de rol.
-- 3) Cualquier Administrador de Tenant podía editar directamente la fila de
--    su propio proyecto en `tenants` (nombre, financiador, incluso su propio
--    estado) vía API, sin que ninguna pantalla de la app se lo permitiera.
--    Se restringe a solo el Administrador de Plataforma.
--
-- Ejecutar en Supabase DESPUÉS de 001–005. Idempotente.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1) Borrado definitivo de configuración: solo admin_tenant (+ plataforma)
-- --------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['units','program_lines','projects','logframes','indicators','forms'] loop
    execute format('drop policy if exists %1$s_delete on public.%1$I', t);
    execute format(
      'create policy %1$s_delete on public.%1$I for delete using (public.has_tenant_role(tenant_id, array[''admin_tenant'']) or public.is_platform_admin())', t);
  end loop;
end $$;

-- --------------------------------------------------------------------------
-- 2) Validar un registro de campo exige rol Coordinador/Administrador, no
--    solo "no ser el autor". Reemplaza fn_field_record_rules (definida en 003).
-- --------------------------------------------------------------------------
create or replace function public.fn_field_record_rules()
returns trigger language plpgsql as $$
begin
  if new.datos is distinct from old.datos
     or new.geopunto is distinct from old.geopunto
     or new.capturado_at is distinct from old.capturado_at
     or new.autor_id is distinct from old.autor_id
     or new.formulario_id is distinct from old.formulario_id
     or new.tenant_id is distinct from old.tenant_id then
    raise exception 'Los registros de campo son inmutables tras sincronizar. Cree un registro nuevo con corrige_registro_id (DRT 8.4).';
  end if;

  if new.estado_validacion in ('validado','rechazado')
     and old.estado_validacion = 'pendiente' then
    if public.current_user_id() = old.autor_id then
      raise exception 'Separación de funciones: quien captura un dato no puede validarlo (DRT 11.3).';
    end if;
    if not (public.has_tenant_role(old.tenant_id, array['coordinador','admin_tenant']) or public.is_platform_admin()) then
      raise exception 'Solo el Coordinador o el Administrador del proyecto pueden validar registros de campo (DRT 3.2).';
    end if;
    new.validado_por := public.current_user_id();
    new.validado_at := now();
    if new.estado_validacion = 'rechazado' and coalesce(new.motivo_rechazo, '') = '' then
      raise exception 'Rechazar un registro exige un motivo (RF-CAL-3).';
    end if;
  end if;
  return new;
end $$;

-- --------------------------------------------------------------------------
-- 3) Solo el Administrador de Plataforma edita la fila del tenant en sí
--    (ninguna pantalla de la app permite a un admin_tenant hacerlo; la
--    Consola de Proyectos es exclusiva de platform_admin).
-- --------------------------------------------------------------------------
drop policy if exists tenants_update on public.tenants;
create policy tenants_update on public.tenants for update
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
