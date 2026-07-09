-- ============================================================================
-- Integridad y auditoría en servidor (DRT 7.3, 11.3, M13)
-- Triggers que garantizan las reglas aunque el cliente sea manipulado.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Bitácora automática de operaciones sensibles (SECURITY DEFINER para
--    poder escribir en audit_log sin depender de la política del actor)
-- --------------------------------------------------------------------------

create or replace function public.fn_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_tenant text;
begin
  -- Extrae tenant_id vía jsonb (NULL si la tabla no lo tiene, p.ej. `tenants`);
  -- para la propia tabla tenants, el tenant es su id.
  v_tenant := coalesce(
    v_row->>'tenant_id',
    case when tg_table_name = 'tenants' then v_row->>'id' end
  );
  insert into audit_log (tenant_id, actor_id, accion, entidad, entidad_id, antes, despues)
  values (
    v_tenant,
    public.current_user_id(),
    tg_op,
    tg_table_name,
    v_row->>'id',
    v_old,
    v_new
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'indicators','field_records','consents','beneficiaries','memberships',
    'tenants','feedbacks','forms','evidences'
  ] loop
    execute format('drop trigger if exists trg_audit_%1$s on public.%1$I', t);
    execute format(
      'create trigger trg_audit_%1$s after insert or update or delete on public.%1$I
       for each row execute function public.fn_audit()', t);
  end loop;
end $$;

-- --------------------------------------------------------------------------
-- 2. Congelación de la línea base (HU-05 / RF-IND-4):
--    con linea_base_congelada = true, el valor no cambia por vía directa.
--    Descongelar exige un UPDATE explícito del flag (que queda en bitácora).
-- --------------------------------------------------------------------------

create or replace function public.fn_protect_baseline()
returns trigger language plpgsql as $$
begin
  if old.linea_base_congelada
     and new.linea_base_congelada
     and new.linea_base_valor is distinct from old.linea_base_valor then
    raise exception 'La línea base del indicador % está congelada. Descongele primero (la operación queda en bitácora).', old.code;
  end if;
  return new;
end $$;

drop trigger if exists trg_protect_baseline on public.indicators;
create trigger trg_protect_baseline before update on public.indicators
  for each row execute function public.fn_protect_baseline();

-- --------------------------------------------------------------------------
-- 3. Inmutabilidad del registro de campo tras sincronizar (8.4):
--    solo cambian los campos del flujo de validación. Una corrección de
--    contenido es un registro NUEVO con corrige_registro_id.
--    Además: separación de funciones (11.3) — el autor no valida su dato.
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
    new.validado_por := public.current_user_id();
    new.validado_at := now();
    if new.estado_validacion = 'rechazado' and coalesce(new.motivo_rechazo, '') = '' then
      raise exception 'Rechazar un registro exige un motivo (RF-CAL-3).';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_field_record_rules on public.field_records;
create trigger trg_field_record_rules before update on public.field_records
  for each row execute function public.fn_field_record_rules();

-- --------------------------------------------------------------------------
-- 4. Inmutabilidad de la evidencia (7.3): el hash y el binario no cambian.
--    Solo se permite fijar url_objeto una vez (subida diferida de fotos, 8.3).
-- --------------------------------------------------------------------------

create or replace function public.fn_evidence_immutable()
returns trigger language plpgsql as $$
begin
  if new.hash is distinct from old.hash
     or new.registro_id is distinct from old.registro_id
     or new.tenant_id is distinct from old.tenant_id
     or (old.url_objeto is not null and new.url_objeto is distinct from old.url_objeto) then
    raise exception 'La evidencia es inmutable: cualquier reemplazo crea una evidencia nueva (DRT 7.3).';
  end if;
  return new;
end $$;

drop trigger if exists trg_evidence_immutable on public.evidences;
create trigger trg_evidence_immutable before update on public.evidences
  for each row execute function public.fn_evidence_immutable();

-- --------------------------------------------------------------------------
-- 5. Consentimiento obligatorio (HU-07): un beneficiario no queda vinculado
--    a consentimiento_id inexistente o no otorgado.
-- --------------------------------------------------------------------------

create or replace function public.fn_check_consent()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.consentimiento_id is not null then
    if not exists (
      select 1 from consents c
      where c.id = new.consentimiento_id
        and c.tenant_id = new.tenant_id
        and c.otorgado
    ) then
      raise exception 'El consentimiento referenciado no existe, no pertenece al tenant o no fue otorgado (Ley 1581/2012).';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_check_consent on public.beneficiaries;
create trigger trg_check_consent before insert or update on public.beneficiaries
  for each row execute function public.fn_check_consent();

-- --------------------------------------------------------------------------
-- 6. updated_at automático en servidor
-- --------------------------------------------------------------------------

create or replace function public.fn_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'tenants','profiles','memberships','units','program_lines','projects',
    'logframes','beneficiaries','consents','forms','field_records','evidences',
    'indicators','indicator_values','feedbacks','lessons_learned','surveys',
    'survey_responses'
  ] loop
    execute format('drop trigger if exists trg_touch_%1$s on public.%1$I', t);
    execute format(
      'create trigger trg_touch_%1$s before update on public.%1$I
       for each row execute function public.fn_touch_updated_at()', t);
  end loop;
end $$;
