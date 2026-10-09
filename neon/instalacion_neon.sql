-- ============================================================================
-- instalacion_neon.sql — Base de datos COMPLETA de la Plataforma MEAL para Neon
-- (GENERADO por scripts/genNeonSql.mjs. No editar a mano.)
--
-- Uso: Consola Neon -> SQL Editor -> pegar TODO este archivo -> Run.
-- Antes: habilitar la Data API con Neon Auth (docs/MIGRACION_NEON.md, Paso 2).
-- Es idempotente: se puede volver a ejecutar sin perder datos.
--
-- Contenido: prerrequisitos · migraciones 001, 002, 003, 004, 005, 006, 007
-- (adaptadas a Neon) · permisos de la Data API · alta de usuarios por correo ·
-- configuración sembrada de los tenants (seed).
-- ============================================================================

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


-- ############################################################################
-- ## 001_schema.sql
-- ############################################################################

-- ============================================================================
-- Plataforma MEAL multi-tenant — Esquema base (DRT v2.0, Sección 7)
-- Regla transversal: toda tabla operativa lleva tenant_id NOT NULL indexado.
-- Los IDs son text generados en cliente (idempotencia de sync, RF-OFF-3).
-- ============================================================================

create extension if not exists pgcrypto;
-- PostGIS para consultas geoespaciales (Sección 6.2). El geopunto de origen
-- viaja como jsonb desde el cliente offline; la columna geográfica se deriva.
create extension if not exists postgis;

-- ----------------------------------------------------------------------------
-- 1. Núcleo multi-tenant
-- ----------------------------------------------------------------------------

create table if not exists public.tenants (
  id text primary key,
  nombre text not null,
  financiador text,
  entidad_ejecutora text,
  unidad_analisis_default text not null default 'comunidad'
    check (unidad_analisis_default in ('comunidad','vereda','organizacion','individuo')),
  moneda text not null default 'COP',
  vigencia_inicio date,
  vigencia_fin date,
  estado text not null default 'activo' check (estado in ('activo','suspendido','cerrado')),
  config jsonb not null default '{}'::jsonb, -- roles_nombres, pqrs_niveles, idiomas, consentimiento
  signature text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id text primary key, -- = auth.users.id (uuid en texto) cuando hay Supabase Auth
  email text,
  full_name text,
  role text not null default 'user' check (role in ('user','platform_admin','platform_direccion')),
  signature text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id text primary key,
  usuario_id text not null references public.profiles(id),
  tenant_id text not null references public.tenants(id),
  rol text not null check (rol in ('gestor','coordinador','director','admin_fin','admin_tenant','financiador','auditor')),
  activo boolean not null default true,
  signature text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (usuario_id, tenant_id)
);

-- ----------------------------------------------------------------------------
-- 2. Catálogo maestro por tenant
-- ----------------------------------------------------------------------------

create table if not exists public.units ( -- unidad_analisis (RF-CAT-1)
  id text primary key,
  tenant_id text not null references public.tenants(id),
  nombre text not null,
  municipio text,
  estado_reconocimiento text check (estado_reconocimiento in ('legalizada','en_proceso')),
  autoridad_tradicional text,
  geopunto jsonb, -- { lat, lng, accuracy?, timestamp? }
  geog geography(Point, 4326) generated always as (
    case
      when geopunto ? 'lat' and geopunto ? 'lng'
      then st_setsrid(st_makepoint((geopunto->>'lng')::float8, (geopunto->>'lat')::float8), 4326)::geography
    end
  ) stored,
  poblacion_estimada integer,
  atributos jsonb not null default '{}'::jsonb, -- atributos configurables por tenant
  signature text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.program_lines ( -- linea_programatica + fases (RF-CAT-2)
  id text primary key,
  tenant_id text not null references public.tenants(id),
  codigo text not null,
  nombre text not null,
  tipo text not null default 'estructurada' check (tipo in ('estructurada','flexible','transversal')),
  orden integer not null default 1,
  fases jsonb not null default '[]'::jsonb, -- [{ orden, nombre }]
  signature text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.projects ( -- proyecto/iniciativa (RF-CAT-3)
  id text primary key,
  tenant_id text not null references public.tenants(id),
  name text not null,
  description text,
  linea_id text references public.program_lines(id),
  unidad_ids jsonb not null default '[]'::jsonb,
  tipo text,
  presupuesto numeric,
  start_date date,
  end_date date,
  status text not null default 'active',
  signature text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.logframes ( -- marco lógico jerárquico (4 niveles)
  id text primary key,
  tenant_id text not null references public.tenants(id),
  project_id text not null references public.projects(id),
  type text not null check (type in ('impact','outcome','output','activity')),
  code text,
  description text,
  parent_id text references public.logframes(id),
  signature text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. Beneficiarios y Habeas Data (Ley 1581/2012)
-- ----------------------------------------------------------------------------

create table if not exists public.beneficiaries (
  id text primary key,
  tenant_id text not null references public.tenants(id),
  unidad_id text references public.units(id),
  nombres_cifrado text,   -- cifrado en cliente (AES-GCM) antes de sincronizar
  apellidos_cifrado text,
  documento_cifrado text,
  documento_hash text,    -- SHA-256 para deduplicación sin exponer el documento
  sexo text check (sexo in ('femenino','masculino','otro','sin_dato')),
  edad_rango text check (edad_rango in ('ninez','juventud','adultez','mayor','sin_dato')),
  consentimiento_id text,
  created_by text references public.profiles(id),
  signature text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.consents ( -- consentimiento informado (RF-SEG-3)
  id text primary key,
  tenant_id text not null references public.tenants(id),
  beneficiario_id text not null references public.beneficiaries(id),
  otorgado boolean not null default false,
  fecha timestamptz,
  medio text check (medio in ('fisico','digital','verbal_testificado')),
  finalidad text,
  evidencia_id text,
  signature text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4. Formularios configurables y captura de campo (offline-first)
-- ----------------------------------------------------------------------------

create table if not exists public.forms ( -- formulario + campos (RF-FRM-1)
  id text primary key,
  tenant_id text not null references public.tenants(id),
  codigo text not null,
  nombre text not null,
  version integer not null default 1,
  linea_id text references public.program_lines(id),
  activo boolean not null default true,
  campos jsonb not null default '[]'::jsonb,
  -- [{ name, etiqueta_es, etiqueta_way, tipo(texto|num|fecha|select|geo|foto|firma|bool|escala),
  --    obligatorio, opciones?, reglas_validacion? }]
  signature text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.field_records ( -- registro_campo (RF-FRM-4)
  id text primary key, -- UUID generado en cliente: idempotencia de sync (RF-OFF-3)
  tenant_id text not null references public.tenants(id),
  formulario_id text not null references public.forms(id),
  formulario_version integer not null default 1,
  unidad_id text references public.units(id),
  proyecto_id text references public.projects(id),
  autor_id text not null references public.profiles(id),
  autor_rol text,
  datos jsonb not null default '{}'::jsonb,
  geopunto jsonb,
  geog geography(Point, 4326) generated always as (
    case
      when geopunto ? 'lat' and geopunto ? 'lng'
      then st_setsrid(st_makepoint((geopunto->>'lng')::float8, (geopunto->>'lat')::float8), 4326)::geography
    end
  ) stored,
  capturado_at timestamptz not null, -- hora real de captura offline
  sincronizado_at timestamptz not null default now(),
  estado_validacion text not null default 'pendiente'
    check (estado_validacion in ('pendiente','validado','rechazado')),
  motivo_rechazo text,
  validado_por text references public.profiles(id),
  validado_at timestamptz,
  corrige_registro_id text references public.field_records(id), -- corrección = nuevo registro (8.4)
  signature text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.evidences ( -- evidencia inmutable (M5, 7.3)
  id text primary key,
  tenant_id text not null references public.tenants(id),
  registro_id text not null references public.field_records(id),
  tipo text not null check (tipo in ('foto','documento')),
  url_objeto text, -- ruta en el almacén de objetos (bucket segregado por tenant)
  nombre_archivo text,
  mime text,
  tamano_bytes bigint,
  geopunto jsonb,
  tomada_at timestamptz,
  hash text not null, -- SHA-256 del binario; inmutable
  signature text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 5. Indicadores: catálogo y serie temporal (M7)
-- ----------------------------------------------------------------------------

create table if not exists public.indicators (
  id text primary key,
  tenant_id text not null references public.tenants(id),
  project_id text references public.projects(id),
  logframe_id text references public.logframes(id),
  linea_id text references public.program_lines(id),
  code text not null,
  name text not null,
  unit text,
  baseline numeric,
  target numeric,
  actual numeric,
  meta_tipo text not null default 'numero' check (meta_tipo in ('numero','porcentaje')),
  frecuencia text not null default 'mensual'
    check (frecuencia in ('mensual','trimestral','semestral','final','continua')),
  medio_verificacion text,
  formula jsonb, -- definición de cálculo interpretable (Sección 9.3)
  linea_base_valor numeric,
  linea_base_congelada boolean not null default false, -- HU-05 / RF-IND-4
  meta_ajustable boolean not null default false, -- metas flexibles L2–L5 (9.4)
  disaggregated_data jsonb,
  signature text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.indicator_values ( -- serie temporal calculada
  id text primary key,
  tenant_id text not null references public.tenants(id),
  indicador_id text not null references public.indicators(id),
  unidad_id text references public.units(id), -- null = agregado del tenant
  periodo date not null, -- mes de corte
  valor numeric,
  semaforo text check (semaforo in ('verde','amarillo','rojo')),
  signature text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 6. PQRS / alertas tempranas (M10), aprendizaje y encuestas legadas
-- ----------------------------------------------------------------------------

create table if not exists public.feedbacks ( -- alerta_pqrs (Anexo B)
  id text primary key,
  tenant_id text not null references public.tenants(id),
  project_id text references public.projects(id),
  unidad_id text references public.units(id),
  category text,
  canal text check (canal in ('telefono','whatsapp','presencial','autoridad','correo','buzon','anonimo')),
  nivel text check (nivel in ('verde','amarillo','naranja','rojo')),
  details text,
  contact_info text, -- identidad reservada: visible solo para roles autorizados (RF-PQR-4)
  reportante_reservado boolean not null default true,
  responsable_id text references public.profiles(id),
  sla_limite timestamptz, -- calculado según nivel (RF-PQR-2)
  estado text not null default 'recibida'
    check (estado in ('recibida','clasificada','asignada','en_atencion','escalada','cerrada','retroalimentada')),
  status text, -- legado UI
  severity text,
  is_confidential boolean not null default false,
  response_text text,
  historial jsonb not null default '[]'::jsonb,
  signature text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.lessons_learned (
  id text primary key,
  tenant_id text not null references public.tenants(id),
  project_id text references public.projects(id),
  title text not null,
  description text,
  challenges text,
  recommendations text,
  action_plan jsonb,
  signature text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.surveys ( -- legado: migra al motor de formularios
  id text primary key,
  tenant_id text not null references public.tenants(id),
  title text not null,
  description text,
  indicator_id text,
  schema jsonb,
  created_by text,
  signature text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.survey_responses (
  id text primary key,
  tenant_id text not null references public.tenants(id),
  survey_id text not null references public.surveys(id),
  answers jsonb,
  submitted_by text,
  submitted_at timestamptz,
  geopunto jsonb,
  signature text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 7. Bitácora de auditoría inmutable (M13) — append-only por diseño (7.3)
-- ----------------------------------------------------------------------------

create table if not exists public.audit_log (
  id text primary key default gen_random_uuid()::text,
  tenant_id text references public.tenants(id), -- null = evento de plataforma
  actor_id text,
  actor_email text,
  accion text not null,
  entidad text not null,
  entidad_id text,
  antes jsonb,
  despues jsonb,
  ip text,
  signature text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Índices de tenant (aislamiento y rendimiento, RF-TEN-2)
-- ----------------------------------------------------------------------------

create index if not exists idx_memberships_tenant on public.memberships (tenant_id);
create index if not exists idx_memberships_usuario on public.memberships (usuario_id);
create index if not exists idx_units_tenant on public.units (tenant_id);
create index if not exists idx_program_lines_tenant on public.program_lines (tenant_id);
create index if not exists idx_projects_tenant on public.projects (tenant_id);
create index if not exists idx_logframes_tenant on public.logframes (tenant_id);
create index if not exists idx_beneficiaries_tenant on public.beneficiaries (tenant_id);
create index if not exists idx_beneficiaries_dochash on public.beneficiaries (tenant_id, documento_hash);
create index if not exists idx_consents_tenant on public.consents (tenant_id);
create index if not exists idx_forms_tenant on public.forms (tenant_id);
create index if not exists idx_field_records_tenant on public.field_records (tenant_id);
create index if not exists idx_field_records_estado on public.field_records (tenant_id, estado_validacion);
create index if not exists idx_field_records_updated on public.field_records (updated_at);
create index if not exists idx_evidences_tenant on public.evidences (tenant_id);
create index if not exists idx_evidences_registro on public.evidences (registro_id);
create index if not exists idx_indicators_tenant on public.indicators (tenant_id);
create index if not exists idx_indicator_values_tenant on public.indicator_values (tenant_id, indicador_id, periodo);
create index if not exists idx_feedbacks_tenant on public.feedbacks (tenant_id);
create index if not exists idx_feedbacks_sla on public.feedbacks (tenant_id, estado, sla_limite);
create index if not exists idx_lessons_tenant on public.lessons_learned (tenant_id);
create index if not exists idx_surveys_tenant on public.surveys (tenant_id);
create index if not exists idx_survey_responses_tenant on public.survey_responses (tenant_id);
create index if not exists idx_audit_log_tenant on public.audit_log (tenant_id, created_at);


-- ############################################################################
-- ## 002_rls.sql
-- ############################################################################

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
  select coalesce(auth.user_id(), '')
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
    execute format('alter table public.%I no force row level security', t);
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

-- (Neon) El revoke de audit_log está en la sección 90 (permisos de la Data API).

-- (Neon) Sin almacén de objetos en la base: las fotos de evidencia van a
-- Netlify Blobs (netlify/functions/evidencias.mjs), con la misma regla por tenant.


-- ############################################################################
-- ## 003_audit_triggers.sql
-- ############################################################################

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


-- ############################################################################
-- ## 004_config_edit.sql
-- ############################################################################

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


-- ############################################################################
-- ## 005_tenant_suspend.sql
-- ############################################################################

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


-- ############################################################################
-- ## 006_security_hardening.sql
-- ############################################################################

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


-- ############################################################################
-- ## 007_profiles_insert_fix.sql
-- ############################################################################

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


-- ############################################################################
-- ## seed.sql (configuración inicial de los tenants)
-- ############################################################################

-- ============================================================================
-- seed.sql — Configuración inicial de los tenants (GENERADO automáticamente
-- desde src/seeds/ por scripts/genSeedSql.mjs). No editar a mano.
-- Ejecutar en Supabase DESPUÉS de 001/002/003. Idempotente (on conflict do nothing).
-- ============================================================================


-- ===== Tenant: Guardianes del Mar Wayuu (ten-wayuu) =====
insert into public.tenants (id, nombre, financiador, entidad_ejecutora, unidad_analisis_default, moneda, vigencia_inicio, vigencia_fin, estado, config) values ('ten-wayuu', 'Guardianes del Mar Wayuu', 'Cooperación / Fondos propios', 'Fundación Guajira Competitiva', 'comunidad', 'COP', '2026-06-01', '2027-04-01', 'activo', '{"roles_nombres":{"gestor":"Gestor Comunitario","coordinador":"Coordinador","director":"Director del Proyecto","admin_fin":"Profesional Administrativo y Financiero","admin_tenant":"Administrador del Proyecto","financiador":"Financiador (consulta)","auditor":"Auditor (consulta)"},"pqrs_niveles":[{"nivel":"verde","sla_horas":72,"responsables":["gestor"],"descripcion":"Informativa / inconformidad aislada"},{"nivel":"amarillo","sla_horas":48,"responsables":["coordinador"],"descripcion":"Inconformidad recurrente / tensión localizada"},{"nivel":"naranja","sla_horas":24,"responsables":["coordinador","director"],"descripcion":"Conflicto activo / riesgo de bloqueo"},{"nivel":"rojo","sla_horas":0,"responsables":["director","coordinador"],"descripcion":"Riesgo a vida/integridad, VBG, bloqueo crítico (atención inmediata)"}],"idiomas":["es","way"],"consentimiento":{"finalidad":"Caracterización socioeconómica y seguimiento del proyecto Guardianes del Mar Wayuu, conforme a la Ley 1581 de 2012.","medios":["fisico","digital","verbal_testificado"]}}'::jsonb) on conflict (id) do nothing;
-- program_lines (1)
insert into public.program_lines (id, tenant_id, codigo, nombre, tipo, orden, fases) values ('line-wayuu-general', 'ten-wayuu', 'LG', 'Línea General de Ejecución', 'estructurada', 1, '[{"orden":1,"nombre":"Diagnóstico y caracterización"},{"orden":2,"nombre":"Dotación y fortalecimiento"},{"orden":3,"nombre":"Validación comercial y sostenibilidad"}]'::jsonb) on conflict (id) do nothing;
-- units (2)
insert into public.units (id, tenant_id, nombre, municipio, estado_reconocimiento, autoridad_tradicional, geopunto, poblacion_estimada, atributos) values ('unit-wayuu-mayapo', 'ten-wayuu', 'Mayapo', 'manaure', 'legalizada', NULL, '{"lat":11.6919,"lng":-72.7592}'::jsonb, NULL, '{}'::jsonb) on conflict (id) do nothing;
insert into public.units (id, tenant_id, nombre, municipio, estado_reconocimiento, autoridad_tradicional, geopunto, poblacion_estimada, atributos) values ('unit-wayuu-elpajaro', 'ten-wayuu', 'El Pájaro', 'manaure', 'legalizada', NULL, '{"lat":11.7318,"lng":-72.6412}'::jsonb, NULL, '{}'::jsonb) on conflict (id) do nothing;
-- projects (1)
insert into public.projects (id, tenant_id, name, description, linea_id, unidad_ids, tipo, presupuesto, start_date, end_date, status) values ('proj-wayuu-001', 'ten-wayuu', 'Guardianes del Mar Wayuu', 'Fortalecimiento pesquero artesanal y desarrollo de experiencias turísticas comunitarias sostenibles en Mayapo y El Pájaro, Manaure, La Guajira.', 'line-wayuu-general', '["unit-wayuu-mayapo","unit-wayuu-elpajaro"]'::jsonb, 'comunitario', NULL, '2026-06-01', '2027-04-01', 'active') on conflict (id) do nothing;
-- logframes (11)
insert into public.logframes (id, tenant_id, project_id, type, code, description, parent_id) values ('lf-wayuu-impact', 'ten-wayuu', 'proj-wayuu-001', 'impact', 'OBJ-G', 'Mejorar de forma sostenible las condiciones socioeconómicas, la gobernanza comunitaria y la resiliencia climática de las comunidades pesqueras artesanales Wayuu en La Guajira.', NULL) on conflict (id) do nothing;
insert into public.logframes (id, tenant_id, project_id, type, code, description, parent_id) values ('lf-wayuu-out1', 'ten-wayuu', 'proj-wayuu-001', 'outcome', 'R-1', 'Fortalecimiento de la gobernanza asociativa y las capacidades organizacionales para la auto-gestión del territorio costero.', 'lf-wayuu-impact') on conflict (id) do nothing;
insert into public.logframes (id, tenant_id, project_id, type, code, description, parent_id) values ('lf-wayuu-out2', 'ten-wayuu', 'proj-wayuu-001', 'outcome', 'R-2', 'Mejoramiento de las capacidades productivas, cadena de frío y seguridad marítima de las tripulaciones.', 'lf-wayuu-impact') on conflict (id) do nothing;
insert into public.logframes (id, tenant_id, project_id, type, code, description, parent_id) values ('lf-wayuu-out3', 'ten-wayuu', 'proj-wayuu-001', 'outcome', 'R-3', 'Estructuración y validación del portafolio comunitario de pescaturismo y patrimonio cultural.', 'lf-wayuu-impact') on conflict (id) do nothing;
insert into public.logframes (id, tenant_id, project_id, type, code, description, parent_id) values ('lf-wayuu-out4', 'ten-wayuu', 'proj-wayuu-001', 'outcome', 'R-4', 'Establecimiento de acuerdos comerciales estables y mecanismos de financiamiento para la sostenibilidad.', 'lf-wayuu-impact') on conflict (id) do nothing;
insert into public.logframes (id, tenant_id, project_id, type, code, description, parent_id) values ('lf-wayuu-outp1.1', 'ten-wayuu', 'proj-wayuu-001', 'output', 'P-1.1', 'Diagnóstico base completado y talleres de gobernanza impartidos a líderes tradicionales.', 'lf-wayuu-out1') on conflict (id) do nothing;
insert into public.logframes (id, tenant_id, project_id, type, code, description, parent_id) values ('lf-wayuu-outp2.1', 'ten-wayuu', 'proj-wayuu-001', 'output', 'P-2.1', 'Activos estratégicos (cavas de frío, chalecos de seguridad, GPS náuticos) entregados a cooperativas.', 'lf-wayuu-out2') on conflict (id) do nothing;
insert into public.logframes (id, tenant_id, project_id, type, code, description, parent_id) values ('lf-wayuu-act1.1', 'ten-wayuu', 'proj-wayuu-001', 'activity', 'A-1.1', 'Socialización y concertación territorial del censo en Wayuunaiki con autoridades tradicionales.', 'lf-wayuu-outp1.1') on conflict (id) do nothing;
insert into public.logframes (id, tenant_id, project_id, type, code, description, parent_id) values ('lf-wayuu-act1.2', 'ten-wayuu', 'proj-wayuu-001', 'activity', 'A-1.2', 'Campaña de caracterización socioeconómica individual de pescadores artesanales en campo.', 'lf-wayuu-outp1.1') on conflict (id) do nothing;
insert into public.logframes (id, tenant_id, project_id, type, code, description, parent_id) values ('lf-wayuu-act2.1', 'ten-wayuu', 'proj-wayuu-001', 'activity', 'A-2.1', 'Entrega técnica de activos de conservación y cavas isotérmicas.', 'lf-wayuu-outp2.1') on conflict (id) do nothing;
insert into public.logframes (id, tenant_id, project_id, type, code, description, parent_id) values ('lf-wayuu-act2.2', 'ten-wayuu', 'proj-wayuu-001', 'activity', 'A-2.2', 'Talleres de capacitación en cartografía náutica y primeros auxilios marítimos.', 'lf-wayuu-outp2.1') on conflict (id) do nothing;
-- indicators (4)
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-wayuu-101', 'ten-wayuu', 'proj-wayuu-001', 'lf-wayuu-out1', 'line-wayuu-general', 'IND-1.1', 'Personas que culminan los ciclos de formación en turismo, inocuidad y pesca', 'Participantes', 0, 100, 15, 'numero', 'mensual', 'Registros de asistencia y certificados de formación', '{"fuente":{"formulario_id":"frm-wayuu-104"},"operacion":"suma","campo":"numero_asistentes"}'::jsonb, 0, false, false, '{"gender":{"male":10,"female":5,"other":0},"age":{"children":0,"youth":3,"adult":10,"elder":2},"ethnicity":{"indigenous":12,"afrodescendant":0,"local":3},"location":{"Mayapo":10,"ElPajaro":5}}'::jsonb) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-wayuu-102', 'ten-wayuu', 'proj-wayuu-001', 'lf-wayuu-out1', 'line-wayuu-general', 'IND-1.2', 'Asociaciones de pescadores fortalecidas en gobernanza comunitaria y administración', 'Asociaciones', 0, 5, 2, 'numero', 'trimestral', 'Actas de talleres y planes de fortalecimiento firmados', NULL, 0, false, false, '{"gender":{"male":0,"female":0,"other":0},"age":{"children":0,"youth":0,"adult":0,"elder":0},"ethnicity":{"indigenous":2,"afrodescendant":0,"local":0},"location":{"Mayapo":1,"ElPajaro":1}}'::jsonb) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-wayuu-201', 'ten-wayuu', 'proj-wayuu-001', 'lf-wayuu-out2', 'line-wayuu-general', 'IND-2.1', 'Asociaciones pesqueras dotadas de activos productivos de conservación y seguridad marítima', 'Asociaciones', 0, 2, 0, 'numero', 'semestral', 'Actas de entrega de activos con registro fotográfico', '{"fuente":{"formulario_id":"frm-wayuu-105"},"operacion":"conteo"}'::jsonb, 0, false, false, '{"gender":{"male":0,"female":0,"other":0},"age":{"children":0,"youth":0,"adult":0,"elder":0},"ethnicity":{"indigenous":0,"afrodescendant":0,"local":0},"location":{"Mayapo":0,"ElPajaro":0}}'::jsonb) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-wayuu-301', 'ten-wayuu', 'proj-wayuu-001', 'lf-wayuu-out3', 'line-wayuu-general', 'IND-3.1', 'Propuestas de experiencias turísticas comunitarias estructuradas y costeadas', 'Propuestas', 0, 5, 1, 'numero', 'trimestral', 'Documentos de propuesta con costeo validado', NULL, 0, false, false, '{"gender":{"male":0,"female":0,"other":0},"age":{"children":0,"youth":0,"adult":0,"elder":0},"ethnicity":{"indigenous":1,"afrodescendant":0,"local":0},"location":{"Mayapo":1,"ElPajaro":0}}'::jsonb) on conflict (id) do nothing;
-- forms (5)
insert into public.forms (id, tenant_id, codigo, nombre, version, linea_id, activo, campos) values ('frm-wayuu-103', 'ten-wayuu', 'FRM-103', 'Evaluación de Pitch Vivencial (Uso exclusivo Comité)', 1, 'line-wayuu-general', true, '[{"name":"asociacion_evaluada","etiqueta_es":"Asociación que presenta el Pitch","etiqueta_way":null,"tipo":"select","obligatorio":true,"reglas_validacion":null,"opciones":["Asociación de Mayapo A","Asociación de Mayapo B","Asociación de El Pájaro A","Otra"]},{"name":"puntaje_asistencia","etiqueta_es":"Puntaje Asistencia a Formación (Máx 30%)","etiqueta_way":null,"tipo":"num","obligatorio":true,"reglas_validacion":{"min":0,"max":30}},{"name":"puntaje_viabilidad","etiqueta_es":"Puntaje Viabilidad Técnica y Financiera (Máx 20%)","etiqueta_way":null,"tipo":"num","obligatorio":true,"reglas_validacion":{"min":0,"max":20}},{"name":"puntaje_pitch","etiqueta_es":"Puntaje Sustentación y Apropiación (Máx 20%)","etiqueta_way":null,"tipo":"num","obligatorio":true,"reglas_validacion":{"min":0,"max":20}},{"name":"puntaje_innovacion_cultural","etiqueta_es":"Puntaje Innovación y Enfoque Étnico (Máx 15%)","etiqueta_way":null,"tipo":"num","obligatorio":true,"reglas_validacion":{"min":0,"max":15}},{"name":"puntaje_inclusion_diferencial","etiqueta_es":"Puntaje Inclusión Social - Mujeres/Jóvenes (Máx 15%)","etiqueta_way":null,"tipo":"num","obligatorio":true,"reglas_validacion":{"min":0,"max":15}},{"name":"comentarios_jurado","etiqueta_es":"Justificación del Comité Evaluador","etiqueta_way":null,"tipo":"texto","obligatorio":true,"reglas_validacion":null}]'::jsonb) on conflict (id) do nothing;
insert into public.forms (id, tenant_id, codigo, nombre, version, linea_id, activo, campos) values ('frm-wayuu-104', 'ten-wayuu', 'FRM-104', 'Registro de Asistencia a Ciclos de Formación', 1, 'line-wayuu-general', true, '[{"name":"fecha_capacitacion","etiqueta_es":"Fecha de la sesión","etiqueta_way":null,"tipo":"fecha","obligatorio":true,"reglas_validacion":null},{"name":"modulo_dictado","etiqueta_es":"Módulo Temático","etiqueta_way":null,"tipo":"select","obligatorio":true,"reglas_validacion":null,"opciones":["Turismo Comunitario","Atención al Cliente","Manipulación de Alimentos","Seguridad Marítima DIMAR","Gobernanza y Sostenibilidad"]},{"name":"entidad_formadora","etiqueta_es":"Entidad Formadora","etiqueta_way":null,"tipo":"select","obligatorio":true,"reglas_validacion":null,"opciones":["SENA","Cámara de Comercio de La Guajira","Fundación Guajira Competitiva"]},{"name":"numero_asistentes","etiqueta_es":"Número total de asistentes en la sesión","etiqueta_way":null,"tipo":"num","obligatorio":true,"reglas_validacion":{"min":0}},{"name":"evidencia_fotografica","etiqueta_es":"Registro fotográfico / Planilla firmada","etiqueta_way":null,"tipo":"documento","obligatorio":true,"reglas_validacion":null}]'::jsonb) on conflict (id) do nothing;
insert into public.forms (id, tenant_id, codigo, nombre, version, linea_id, activo, campos) values ('frm-wayuu-105', 'ten-wayuu', 'FRM-105', 'Acta de Entrega de Activos Productivos y HSE', 1, 'line-wayuu-general', true, '[{"name":"fecha_entrega","etiqueta_es":"Fecha de entrega","etiqueta_way":null,"tipo":"fecha","obligatorio":true,"reglas_validacion":null},{"name":"asociacion_receptora","etiqueta_es":"Asociación Beneficiaria","etiqueta_way":null,"tipo":"select","obligatorio":true,"reglas_validacion":null,"opciones":["Asociación Ganadora Mayapo","Asociación Ganadora El Pájaro"]},{"name":"tipo_activo","etiqueta_es":"Categoría de los activos entregados","etiqueta_way":null,"tipo":"checklist","obligatorio":true,"reglas_validacion":null,"opciones":["Cavas isotérmicas (Cadena de frío)","Chalecos salvavidas","Equipos GPS/Radio","Herramientas de manejo postcaptura"]},{"name":"estado_entrega","etiqueta_es":"Estado de los equipos","etiqueta_way":null,"tipo":"select","obligatorio":true,"reglas_validacion":null,"opciones":["Nuevos y funcionales","Requieren instalación técnica","Con novedades (Describir abajo)"]},{"name":"nombre_representante","etiqueta_es":"Nombre del representante legal que recibe","etiqueta_way":null,"tipo":"texto","obligatorio":true,"reglas_validacion":null},{"name":"firma_representante","etiqueta_es":"Firma digital del representante que recibe","etiqueta_way":null,"tipo":"firma","obligatorio":true,"reglas_validacion":null},{"name":"acta_adjunta","etiqueta_es":"Acta firmada (PDF)","etiqueta_way":null,"tipo":"documento","obligatorio":true,"reglas_validacion":null}]'::jsonb) on conflict (id) do nothing;
insert into public.forms (id, tenant_id, codigo, nombre, version, linea_id, activo, campos) values ('frm-wayuu-106', 'ten-wayuu', 'FRM-106', 'Adopción de Mecanismos de Gobernanza y Sostenibilidad', 1, 'line-wayuu-general', true, '[{"name":"asociacion","etiqueta_es":"Organización Comunitaria","etiqueta_way":null,"tipo":"select","obligatorio":true,"reglas_validacion":null,"opciones":["Asociación Mayapo","Asociación El Pájaro"]},{"name":"tipo_mecanismo","etiqueta_es":"Tipo de mecanismo adoptado","etiqueta_way":null,"tipo":"select","obligatorio":true,"reglas_validacion":null,"opciones":["Fondo comunitario de ahorro","Reglamento interno de administración de activos","Plan de sostenibilidad financiera","Acuerdo de distribución de responsabilidades"]},{"name":"porcentaje_ahorro","etiqueta_es":"Porcentaje de ingresos destinado a reinversión (si aplica)","etiqueta_way":null,"tipo":"num","obligatorio":false,"reglas_validacion":{"min":0,"max":100}},{"name":"descripcion_acuerdo","etiqueta_es":"Resumen del acuerdo alcanzado","etiqueta_way":null,"tipo":"texto","obligatorio":true,"reglas_validacion":null},{"name":"documento_soporte","etiqueta_es":"Reglamento o acta de asamblea comunitaria (PDF)","etiqueta_way":null,"tipo":"documento","obligatorio":true,"reglas_validacion":null}]'::jsonb) on conflict (id) do nothing;
insert into public.forms (id, tenant_id, codigo, nombre, version, linea_id, activo, campos) values ('frm-wayuu-107', 'ten-wayuu', 'FRM-107', 'Registro de Alianzas Comerciales B2B', 1, 'line-wayuu-general', true, '[{"name":"fecha_firma","etiqueta_es":"Fecha de formalización del acuerdo","etiqueta_way":null,"tipo":"fecha","obligatorio":true,"reglas_validacion":null},{"name":"nombre_operador_aliado","etiqueta_es":"Nombre de la Agencia / Operador Turístico Aliado","etiqueta_way":null,"tipo":"texto","obligatorio":true,"reglas_validacion":null},{"name":"ruta_comercializada","etiqueta_es":"Experiencia vinculada","etiqueta_way":null,"tipo":"select","obligatorio":true,"reglas_validacion":null,"opciones":["Experiencia Mayapo","Experiencia El Pájaro","Ambas rutas"]},{"name":"tipo_acuerdo","etiqueta_es":"Naturaleza del acuerdo comercial","etiqueta_way":null,"tipo":"select","obligatorio":true,"reglas_validacion":null,"opciones":["Acuerdo de tarifas netas fijas","Inclusión en portafolio promocional","Contrato de exclusividad operativa","Carta de intención de compra"]},{"name":"responsabilidades_aliado","etiqueta_es":"Compromisos principales del aliado","etiqueta_way":null,"tipo":"texto","obligatorio":true,"reglas_validacion":null},{"name":"documento_soporte","etiqueta_es":"Acuerdo o carta de intención (PDF)","etiqueta_way":null,"tipo":"documento","obligatorio":true,"reglas_validacion":null}]'::jsonb) on conflict (id) do nothing;
-- surveys (2)
insert into public.surveys (id, tenant_id, title, description, indicator_id, schema, created_by) values ('srv-wayuu-101', 'ten-wayuu', 'Ficha de Caracterización y Diagnóstico Socioeconómico (Mes 1)', 'Formulario de caracterización socioeconómica para el censo de pescadores en Mayapo y El Pájaro.', 'ind-wayuu-101', '{"fields":[{"name":"full_name","label":"Nombre Completo del Pescador","type":"text","required":true},{"name":"genero","label":"Género","type":"select","options":["Masculino","Femenino","Otro"],"required":true},{"name":"edad","label":"Edad","type":"number","required":true},{"name":"clan","label":"Clan Wayuu de pertenencia (ej. Pushaina, Uriana, Epinayu)","type":"text","required":true},{"name":"location","label":"Corregimiento / Comunidad de Residencia","type":"select","options":["Mayapo","El Pájaro","Ranchería Aledaña Mayapo","Ranchería Aledaña El Pájaro"],"required":true},{"name":"association","label":"Asociación de Pescadores a la que pertenece","type":"select","options":["Asociación de Mayapo A","Asociación de Mayapo B","Asociación de El Pájaro A","Independiente / No asociado"],"required":true},{"name":"family_count","label":"Miembros dependientes en el núcleo familiar","type":"number","required":true},{"name":"fishing_only","label":"¿Es la pesca artesanal su única fuente de ingresos?","type":"select","options":["Sí, dependemos 100% de la pesca","No, alternamos con pastoreo/artesanías","No, alternamos con mototaxismo o comercio"],"required":true},{"name":"boat_motor","label":"¿Cuenta con embarcación y motor propio en buen estado?","type":"select","options":["Embarcación y motor propios operativos","Embarcación propia pero sin motor","No tiene activos propios (pesca de orilla)","Usa activos alquilados/prestados"],"required":true},{"name":"experiencia_turismo","label":"¿Ha prestado servicios turísticos antes?","type":"select","options":["Sí, recurrentemente","Sí, ocasionalmente","No, nunca"],"required":true},{"name":"equipos_seguridad_actuales","label":"Equipos de seguridad marítima con los que cuenta actualmente","type":"checklist","options":["Chalecos salvavidas","Radio de comunicación","GPS náutico","Botiquín","Ninguno"],"required":true},{"name":"comments","label":"Observaciones generales del diagnóstico","type":"textarea","required":false}]}'::jsonb, 'coordinacion@guajiracompetitiva.org') on conflict (id) do nothing;
insert into public.surveys (id, tenant_id, title, description, indicator_id, schema, created_by) values ('srv-wayuu-102', 'ten-wayuu', 'Evaluación del FAM TRIP y Satisfacción Comercial (Metas 9.6)', 'Encuesta técnica para evaluar la viabilidad de las experiencias piloto de pescaturismo.', 'ind-wayuu-301', '{"fields":[{"name":"agency_name","label":"Agencia de Viajes / Operadora Turística evaluadora","type":"text","required":true},{"name":"route_evaluated","label":"Experiencia Turística Evaluada","type":"select","options":["Pesca Ancestral Wayuu en Mayapo","Ruta de la Tortuga y Gastronomía en El Pájaro"],"required":true},{"name":"cultural_respect_checklist","label":"Elementos de pertinencia cultural evidenciados","type":"checklist","options":["Uso del idioma Wayuunaiki en la guianza","Interacción directa con autoridades tradicionales","Inclusión de relatos y saberes ancestrales","Consumo de gastronomía tradicional"],"required":true},{"name":"safety_equipment","label":"¿Se constató el uso riguroso de equipos de seguridad?","type":"select","options":["Sí, se cumplieron todos los protocolos DIMAR","Parcialmente (faltaban elementos)","No contaban con seguridad adecuada"],"required":true},{"name":"commercial_potential","label":"Potencial de inserción comercial (Modelo B2B)","type":"select","options":["Alto potencial","Medio potencial","Bajo potencial"],"required":true},{"name":"intencion_compra","label":"¿Estaría dispuesto a incluir esta ruta en el portafolio formal de su agencia?","type":"select","options":["Sí, de manera inmediata","Sí, si realizan ajustes técnicos/tarifarios","No por el momento"],"required":true},{"name":"improvement_points","label":"Recomendaciones de mejora identificadas","type":"textarea","required":false}]}'::jsonb, 'coordinacion@guajiracompetitiva.org') on conflict (id) do nothing;

-- ===== Tenant: Implementación Reforma Laboral — Clínica Maicao (ten-maicao) =====
insert into public.tenants (id, nombre, financiador, entidad_ejecutora, unidad_analisis_default, moneda, vigencia_inicio, vigencia_fin, estado, config) values ('ten-maicao', 'Implementación Reforma Laboral — Clínica Maicao', 'Clínica Maicao S.A.S.', 'Fundación Guajira Competitiva', 'organizacion', 'COP', '2026-03-30', '2026-09-30', 'activo', '{"roles_nombres":{"gestor":"Consultor de Campo","coordinador":"Coordinador","director":"Director del Proyecto","admin_fin":"Profesional Administrativo y Financiero","admin_tenant":"Administrador del Proyecto","financiador":"Financiador (consulta)","auditor":"Auditor (consulta)"},"pqrs_niveles":[{"nivel":"verde","sla_horas":72,"responsables":["gestor"],"descripcion":"Informativa / inconformidad aislada"},{"nivel":"amarillo","sla_horas":48,"responsables":["coordinador"],"descripcion":"Inconformidad recurrente / tensión localizada"},{"nivel":"naranja","sla_horas":24,"responsables":["coordinador","director"],"descripcion":"Conflicto activo / riesgo de bloqueo"},{"nivel":"rojo","sla_horas":0,"responsables":["director","coordinador"],"descripcion":"Riesgo a vida/integridad, VBG, bloqueo crítico (atención inmediata)"}],"idiomas":["es"],"consentimiento":{"finalidad":"Diagnóstico organizacional y evaluación de riesgo psicosocial del personal de la Clínica Maicao, conforme a la Ley 1581 de 2012.","medios":["fisico","digital"]}}'::jsonb) on conflict (id) do nothing;
-- program_lines (1)
insert into public.program_lines (id, tenant_id, codigo, nombre, tipo, orden, fases) values ('line-maicao-general', 'ten-maicao', 'LG', 'Línea General de Consultoría', 'estructurada', 1, '[{"orden":1,"nombre":"Diagnóstico jurídico y organizacional"},{"orden":2,"nombre":"Adecuación e implementación"},{"orden":3,"nombre":"Apropiación y cierre"}]'::jsonb) on conflict (id) do nothing;
-- units (1)
insert into public.units (id, tenant_id, nombre, municipio, estado_reconocimiento, autoridad_tradicional, geopunto, poblacion_estimada, atributos) values ('unit-maicao-clinica', 'ten-maicao', 'Clínica Maicao — Sede Principal', 'maicao', 'legalizada', NULL, '{"lat":11.3778,"lng":-72.2394}'::jsonb, 150, '{"tipo_organizacion":"IPS de alta complejidad"}'::jsonb) on conflict (id) do nothing;
-- projects (1)
insert into public.projects (id, tenant_id, name, description, linea_id, unidad_ids, tipo, presupuesto, start_date, end_date, status) values ('proj-maicao-002', 'ten-maicao', 'Implementación Reforma Laboral - Clínica Maicao', 'Diseño, adecuación e implementación del modelo laboral organizacional de la Clínica Maicao en el marco de la Ley 2466 de 2025 (Reforma Laboral), mitigando riesgos jurídicos y optimizando mallas de turnos de salud de alta complejidad.', 'line-maicao-general', '["unit-maicao-clinica"]'::jsonb, 'consultoria', NULL, '2026-03-30', '2026-09-30', 'active') on conflict (id) do nothing;
-- logframes (13)
insert into public.logframes (id, tenant_id, project_id, type, code, description, parent_id) values ('lf-maicao-impact', 'ten-maicao', 'proj-maicao-002', 'impact', 'OBJ-G', 'Garantizar la adecuada implementación de la Reforma Laboral (Ley 2466 de 2025) en la Clínica Maicao mediante un modelo de transformación organizacional 360° para mitigar riesgos legales y optimizar la continuidad del servicio de salud.', NULL) on conflict (id) do nothing;
insert into public.logframes (id, tenant_id, project_id, type, code, description, parent_id) values ('lf-maicao-out1', 'ten-maicao', 'proj-maicao-002', 'outcome', 'R-1', 'Adecuación normativa, prevención de riesgo jurídico y fortalecimiento del marco legal institucional.', 'lf-maicao-impact') on conflict (id) do nothing;
insert into public.logframes (id, tenant_id, project_id, type, code, description, parent_id) values ('lf-maicao-out2', 'ten-maicao', 'proj-maicao-002', 'outcome', 'R-2', 'Optimización de la estructura de jornada laboral, turnos, mallas, liquidación de nómina y recargos.', 'lf-maicao-impact') on conflict (id) do nothing;
insert into public.logframes (id, tenant_id, project_id, type, code, description, parent_id) values ('lf-maicao-out3', 'ten-maicao', 'proj-maicao-002', 'outcome', 'R-3', 'Fortalecimiento del clima laboral, prevención de conflictos y cumplimiento de obligaciones en riesgo psicosocial.', 'lf-maicao-impact') on conflict (id) do nothing;
insert into public.logframes (id, tenant_id, project_id, type, code, description, parent_id) values ('lf-maicao-out4', 'ten-maicao', 'proj-maicao-002', 'outcome', 'R-4', 'Apropiación institucional y capacitación del talento humano sobre los cambios derivados de la reforma laboral.', 'lf-maicao-impact') on conflict (id) do nothing;
insert into public.logframes (id, tenant_id, project_id, type, code, description, parent_id) values ('lf-maicao-otp1.1', 'ten-maicao', 'proj-maicao-002', 'output', 'P-1.1', 'Políticas de contratación y modelos contractuales adaptados y redactados.', 'lf-maicao-out1') on conflict (id) do nothing;
insert into public.logframes (id, tenant_id, project_id, type, code, description, parent_id) values ('lf-maicao-otp2.1', 'ten-maicao', 'proj-maicao-002', 'output', 'P-2.1', 'Manual de jornada laboral adaptado a 42 horas y mallas de turnos de salud optimizadas.', 'lf-maicao-out2') on conflict (id) do nothing;
insert into public.logframes (id, tenant_id, project_id, type, code, description, parent_id) values ('lf-maicao-otp3.1', 'ten-maicao', 'proj-maicao-002', 'output', 'P-3.1', 'Protocolo de prevención del acoso laboral y diagnóstico psicosocial.', 'lf-maicao-out3') on conflict (id) do nothing;
insert into public.logframes (id, tenant_id, project_id, type, code, description, parent_id) values ('lf-maicao-otp4.1', 'ten-maicao', 'proj-maicao-002', 'output', 'P-4.1', 'Talleres presenciales de formación ejecutados y kit pedagógico institucional de reforma.', 'lf-maicao-out4') on conflict (id) do nothing;
insert into public.logframes (id, tenant_id, project_id, type, code, description, parent_id) values ('lf-maicao-act1.1', 'ten-maicao', 'proj-maicao-002', 'activity', 'A-1.1', 'Elaboración del informe diagnóstico jurídico de la Clínica y matriz de riesgos inicial.', 'lf-maicao-otp1.1') on conflict (id) do nothing;
insert into public.logframes (id, tenant_id, project_id, type, code, description, parent_id) values ('lf-maicao-act2.1', 'ten-maicao', 'proj-maicao-002', 'activity', 'A-2.1', 'Ejecución de simulaciones financieras sobre el impacto de recargos nocturnos y dominicales.', 'lf-maicao-otp2.1') on conflict (id) do nothing;
insert into public.logframes (id, tenant_id, project_id, type, code, description, parent_id) values ('lf-maicao-act3.1', 'ten-maicao', 'proj-maicao-002', 'activity', 'A-3.1', 'Aplicación de encuestas de evaluación del riesgo psicosocial del personal médico y administrativo.', 'lf-maicao-otp3.1') on conflict (id) do nothing;
insert into public.logframes (id, tenant_id, project_id, type, code, description, parent_id) values ('lf-maicao-act4.1', 'ten-maicao', 'proj-maicao-002', 'activity', 'A-4.1', 'Diseño e impartición de talleres de gestión del cambio para coordinadores y jefes de área.', 'lf-maicao-otp4.1') on conflict (id) do nothing;
-- indicators (4)
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-maicao-101', 'ten-maicao', 'proj-maicao-002', 'lf-maicao-out1', 'line-maicao-general', 'IND-1.1', 'Porcentaje de adecuación jurídica de contratos del personal', '%', 0, 100, 0, 'porcentaje', 'mensual', 'Matriz de contratos revisados y adendas firmadas', NULL, 0, false, false, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-maicao-201', 'ten-maicao', 'proj-maicao-002', 'lf-maicao-out2', 'line-maicao-general', 'IND-2.1', 'Simulaciones financieras de nómina y turnos completadas y aprobadas', 'Simulaciones', 0, 3, 0, 'numero', 'trimestral', 'Informes de simulación aprobados por gerencia', NULL, 0, false, false, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-maicao-301', 'ten-maicao', 'proj-maicao-002', 'lf-maicao-out3', 'line-maicao-general', 'IND-3.1', 'Protocolo contra el acoso laboral socializado y aprobado', 'Protocolo', 0, 1, 0, 'numero', 'final', 'Acta de aprobación del comité de convivencia', NULL, 0, false, false, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-maicao-401', 'ten-maicao', 'proj-maicao-002', 'lf-maicao-out4', 'line-maicao-general', 'IND-4.1', 'Colaboradores de la clínica capacitados en gestión del cambio', 'Colaboradores', 0, 150, 0, 'numero', 'mensual', 'Listados de asistencia a talleres con firma', NULL, 0, false, false, NULL) on conflict (id) do nothing;

-- ===== Tenant: Convenio Asociación Guajira (Ecopetrol–Hocol) 2026 (ten-hocol) =====
insert into public.tenants (id, nombre, financiador, entidad_ejecutora, unidad_analisis_default, moneda, vigencia_inicio, vigencia_fin, estado, config) values ('ten-hocol', 'Convenio Asociación Guajira (Ecopetrol–Hocol) 2026', 'Hocol S.A.', 'Fundación Guajira Competitiva', 'comunidad', 'COP', '2026-01-01', '2027-04-30', 'activo', '{"roles_nombres":{"gestor":"Gestor Comunitario Wayuu","coordinador":"Coordinador Territorial","director":"Director del Proyecto","admin_fin":"Profesional Administrativo y Financiero","admin_tenant":"Administrador de Tenant","financiador":"Hocol S.A. (consulta)","auditor":"Auditor (consulta)"},"pqrs_niveles":[{"nivel":"verde","sla_horas":72,"responsables":["gestor"],"descripcion":"Informativa / inconformidad aislada"},{"nivel":"amarillo","sla_horas":48,"responsables":["coordinador"],"descripcion":"Inconformidad recurrente / tensión localizada"},{"nivel":"naranja","sla_horas":24,"responsables":["coordinador","director"],"descripcion":"Conflicto activo / riesgo de bloqueo"},{"nivel":"rojo","sla_horas":0,"responsables":["director","coordinador"],"descripcion":"Riesgo a vida/integridad, VBG, bloqueo crítico (atención inmediata)"}],"idiomas":["es","way"],"consentimiento":{"finalidad":"Registro y seguimiento de beneficiarios del convenio de inversión social Asociación Guajira (Ecopetrol–Hocol), con enfoque étnico y conforme a la Ley 1581 de 2012. Los datos se usan exclusivamente para los fines del convenio.","medios":["fisico","digital","verbal_testificado"]}}'::jsonb) on conflict (id) do nothing;
-- program_lines (6)
insert into public.program_lines (id, tenant_id, codigo, nombre, tipo, orden, fases) values ('line-hocol-l1', 'ten-hocol', 'L1', 'L1 — Fortalecimiento comunitario', 'estructurada', 1, '[{"orden":1,"nombre":"Diagnóstico"},{"orden":2,"nombre":"Caracterización"},{"orden":3,"nombre":"Plan de fortalecimiento"},{"orden":4,"nombre":"Formulación de proyectos"},{"orden":5,"nombre":"Implementación y planes de inversión"},{"orden":6,"nombre":"Sostenibilidad"}]'::jsonb) on conflict (id) do nothing;
insert into public.program_lines (id, tenant_id, codigo, nombre, tipo, orden, fases) values ('line-hocol-l2', 'ten-hocol', 'L2', 'L2 — Atención de solicitudes', 'flexible', 2, '[]'::jsonb) on conflict (id) do nothing;
insert into public.program_lines (id, tenant_id, codigo, nombre, tipo, orden, fases) values ('line-hocol-l3', 'ten-hocol', 'L3', 'L3 — Cultura y patrimonio', 'flexible', 3, '[]'::jsonb) on conflict (id) do nothing;
insert into public.program_lines (id, tenant_id, codigo, nombre, tipo, orden, fases) values ('line-hocol-l4', 'ten-hocol', 'L4', 'L4 — Apoyos humanitarios y usos y costumbres', 'flexible', 4, '[]'::jsonb) on conflict (id) do nothing;
insert into public.program_lines (id, tenant_id, codigo, nombre, tipo, orden, fases) values ('line-hocol-l5', 'ten-hocol', 'L5', 'L5 — Salud', 'flexible', 5, '[]'::jsonb) on conflict (id) do nothing;
insert into public.program_lines (id, tenant_id, codigo, nombre, tipo, orden, fases) values ('line-hocol-meal', 'ten-hocol', 'MEAL', 'Eje transversal MEAL', 'transversal', 6, '[]'::jsonb) on conflict (id) do nothing;
-- units (36)
insert into public.units (id, tenant_id, nombre, municipio, estado_reconocimiento, autoridad_tradicional, geopunto, poblacion_estimada, atributos) values ('unit-hocol-01', 'ten-hocol', 'Comunidad Wayuu 01 — Riohacha (nombre por confirmar en onboarding)', 'riohacha', 'en_proceso', NULL, NULL, NULL, '{}'::jsonb) on conflict (id) do nothing;
insert into public.units (id, tenant_id, nombre, municipio, estado_reconocimiento, autoridad_tradicional, geopunto, poblacion_estimada, atributos) values ('unit-hocol-02', 'ten-hocol', 'Comunidad Wayuu 02 — Riohacha (nombre por confirmar en onboarding)', 'riohacha', 'en_proceso', NULL, NULL, NULL, '{}'::jsonb) on conflict (id) do nothing;
insert into public.units (id, tenant_id, nombre, municipio, estado_reconocimiento, autoridad_tradicional, geopunto, poblacion_estimada, atributos) values ('unit-hocol-03', 'ten-hocol', 'Comunidad Wayuu 03 — Riohacha (nombre por confirmar en onboarding)', 'riohacha', 'en_proceso', NULL, NULL, NULL, '{}'::jsonb) on conflict (id) do nothing;
insert into public.units (id, tenant_id, nombre, municipio, estado_reconocimiento, autoridad_tradicional, geopunto, poblacion_estimada, atributos) values ('unit-hocol-04', 'ten-hocol', 'Comunidad Wayuu 04 — Riohacha (nombre por confirmar en onboarding)', 'riohacha', 'en_proceso', NULL, NULL, NULL, '{}'::jsonb) on conflict (id) do nothing;
insert into public.units (id, tenant_id, nombre, municipio, estado_reconocimiento, autoridad_tradicional, geopunto, poblacion_estimada, atributos) values ('unit-hocol-05', 'ten-hocol', 'Comunidad Wayuu 05 — Riohacha (nombre por confirmar en onboarding)', 'riohacha', 'en_proceso', NULL, NULL, NULL, '{}'::jsonb) on conflict (id) do nothing;
insert into public.units (id, tenant_id, nombre, municipio, estado_reconocimiento, autoridad_tradicional, geopunto, poblacion_estimada, atributos) values ('unit-hocol-06', 'ten-hocol', 'Comunidad Wayuu 06 — Riohacha (nombre por confirmar en onboarding)', 'riohacha', 'en_proceso', NULL, NULL, NULL, '{}'::jsonb) on conflict (id) do nothing;
insert into public.units (id, tenant_id, nombre, municipio, estado_reconocimiento, autoridad_tradicional, geopunto, poblacion_estimada, atributos) values ('unit-hocol-07', 'ten-hocol', 'Comunidad Wayuu 07 — Riohacha (nombre por confirmar en onboarding)', 'riohacha', 'en_proceso', NULL, NULL, NULL, '{}'::jsonb) on conflict (id) do nothing;
insert into public.units (id, tenant_id, nombre, municipio, estado_reconocimiento, autoridad_tradicional, geopunto, poblacion_estimada, atributos) values ('unit-hocol-08', 'ten-hocol', 'Comunidad Wayuu 08 — Riohacha (nombre por confirmar en onboarding)', 'riohacha', 'en_proceso', NULL, NULL, NULL, '{}'::jsonb) on conflict (id) do nothing;
insert into public.units (id, tenant_id, nombre, municipio, estado_reconocimiento, autoridad_tradicional, geopunto, poblacion_estimada, atributos) values ('unit-hocol-09', 'ten-hocol', 'Comunidad Wayuu 09 — Riohacha (nombre por confirmar en onboarding)', 'riohacha', 'en_proceso', NULL, NULL, NULL, '{}'::jsonb) on conflict (id) do nothing;
insert into public.units (id, tenant_id, nombre, municipio, estado_reconocimiento, autoridad_tradicional, geopunto, poblacion_estimada, atributos) values ('unit-hocol-10', 'ten-hocol', 'Comunidad Wayuu 10 — Riohacha (nombre por confirmar en onboarding)', 'riohacha', 'en_proceso', NULL, NULL, NULL, '{}'::jsonb) on conflict (id) do nothing;
insert into public.units (id, tenant_id, nombre, municipio, estado_reconocimiento, autoridad_tradicional, geopunto, poblacion_estimada, atributos) values ('unit-hocol-11', 'ten-hocol', 'Comunidad Wayuu 11 — Riohacha (nombre por confirmar en onboarding)', 'riohacha', 'en_proceso', NULL, NULL, NULL, '{}'::jsonb) on conflict (id) do nothing;
insert into public.units (id, tenant_id, nombre, municipio, estado_reconocimiento, autoridad_tradicional, geopunto, poblacion_estimada, atributos) values ('unit-hocol-12', 'ten-hocol', 'Comunidad Wayuu 12 — Riohacha (nombre por confirmar en onboarding)', 'riohacha', 'en_proceso', NULL, NULL, NULL, '{}'::jsonb) on conflict (id) do nothing;
insert into public.units (id, tenant_id, nombre, municipio, estado_reconocimiento, autoridad_tradicional, geopunto, poblacion_estimada, atributos) values ('unit-hocol-13', 'ten-hocol', 'Comunidad Wayuu 13 — Riohacha (nombre por confirmar en onboarding)', 'riohacha', 'en_proceso', NULL, NULL, NULL, '{}'::jsonb) on conflict (id) do nothing;
insert into public.units (id, tenant_id, nombre, municipio, estado_reconocimiento, autoridad_tradicional, geopunto, poblacion_estimada, atributos) values ('unit-hocol-14', 'ten-hocol', 'Comunidad Wayuu 14 — Riohacha (nombre por confirmar en onboarding)', 'riohacha', 'en_proceso', NULL, NULL, NULL, '{}'::jsonb) on conflict (id) do nothing;
insert into public.units (id, tenant_id, nombre, municipio, estado_reconocimiento, autoridad_tradicional, geopunto, poblacion_estimada, atributos) values ('unit-hocol-15', 'ten-hocol', 'Comunidad Wayuu 15 — Riohacha (nombre por confirmar en onboarding)', 'riohacha', 'en_proceso', NULL, NULL, NULL, '{}'::jsonb) on conflict (id) do nothing;
insert into public.units (id, tenant_id, nombre, municipio, estado_reconocimiento, autoridad_tradicional, geopunto, poblacion_estimada, atributos) values ('unit-hocol-16', 'ten-hocol', 'Comunidad Wayuu 16 — Riohacha (nombre por confirmar en onboarding)', 'riohacha', 'en_proceso', NULL, NULL, NULL, '{}'::jsonb) on conflict (id) do nothing;
insert into public.units (id, tenant_id, nombre, municipio, estado_reconocimiento, autoridad_tradicional, geopunto, poblacion_estimada, atributos) values ('unit-hocol-17', 'ten-hocol', 'Comunidad Wayuu 17 — Riohacha (nombre por confirmar en onboarding)', 'riohacha', 'en_proceso', NULL, NULL, NULL, '{}'::jsonb) on conflict (id) do nothing;
insert into public.units (id, tenant_id, nombre, municipio, estado_reconocimiento, autoridad_tradicional, geopunto, poblacion_estimada, atributos) values ('unit-hocol-18', 'ten-hocol', 'Comunidad Wayuu 18 — Riohacha (nombre por confirmar en onboarding)', 'riohacha', 'en_proceso', NULL, NULL, NULL, '{}'::jsonb) on conflict (id) do nothing;
insert into public.units (id, tenant_id, nombre, municipio, estado_reconocimiento, autoridad_tradicional, geopunto, poblacion_estimada, atributos) values ('unit-hocol-19', 'ten-hocol', 'Comunidad Wayuu 19 — Manaure (nombre por confirmar en onboarding)', 'manaure', 'en_proceso', NULL, NULL, NULL, '{}'::jsonb) on conflict (id) do nothing;
insert into public.units (id, tenant_id, nombre, municipio, estado_reconocimiento, autoridad_tradicional, geopunto, poblacion_estimada, atributos) values ('unit-hocol-20', 'ten-hocol', 'Comunidad Wayuu 20 — Manaure (nombre por confirmar en onboarding)', 'manaure', 'en_proceso', NULL, NULL, NULL, '{}'::jsonb) on conflict (id) do nothing;
insert into public.units (id, tenant_id, nombre, municipio, estado_reconocimiento, autoridad_tradicional, geopunto, poblacion_estimada, atributos) values ('unit-hocol-21', 'ten-hocol', 'Comunidad Wayuu 21 — Manaure (nombre por confirmar en onboarding)', 'manaure', 'en_proceso', NULL, NULL, NULL, '{}'::jsonb) on conflict (id) do nothing;
insert into public.units (id, tenant_id, nombre, municipio, estado_reconocimiento, autoridad_tradicional, geopunto, poblacion_estimada, atributos) values ('unit-hocol-22', 'ten-hocol', 'Comunidad Wayuu 22 — Manaure (nombre por confirmar en onboarding)', 'manaure', 'en_proceso', NULL, NULL, NULL, '{}'::jsonb) on conflict (id) do nothing;
insert into public.units (id, tenant_id, nombre, municipio, estado_reconocimiento, autoridad_tradicional, geopunto, poblacion_estimada, atributos) values ('unit-hocol-23', 'ten-hocol', 'Comunidad Wayuu 23 — Manaure (nombre por confirmar en onboarding)', 'manaure', 'en_proceso', NULL, NULL, NULL, '{}'::jsonb) on conflict (id) do nothing;
insert into public.units (id, tenant_id, nombre, municipio, estado_reconocimiento, autoridad_tradicional, geopunto, poblacion_estimada, atributos) values ('unit-hocol-24', 'ten-hocol', 'Comunidad Wayuu 24 — Manaure (nombre por confirmar en onboarding)', 'manaure', 'en_proceso', NULL, NULL, NULL, '{}'::jsonb) on conflict (id) do nothing;
insert into public.units (id, tenant_id, nombre, municipio, estado_reconocimiento, autoridad_tradicional, geopunto, poblacion_estimada, atributos) values ('unit-hocol-25', 'ten-hocol', 'Comunidad Wayuu 25 — Manaure (nombre por confirmar en onboarding)', 'manaure', 'en_proceso', NULL, NULL, NULL, '{}'::jsonb) on conflict (id) do nothing;
insert into public.units (id, tenant_id, nombre, municipio, estado_reconocimiento, autoridad_tradicional, geopunto, poblacion_estimada, atributos) values ('unit-hocol-26', 'ten-hocol', 'Comunidad Wayuu 26 — Manaure (nombre por confirmar en onboarding)', 'manaure', 'en_proceso', NULL, NULL, NULL, '{}'::jsonb) on conflict (id) do nothing;
insert into public.units (id, tenant_id, nombre, municipio, estado_reconocimiento, autoridad_tradicional, geopunto, poblacion_estimada, atributos) values ('unit-hocol-27', 'ten-hocol', 'Comunidad Wayuu 27 — Manaure (nombre por confirmar en onboarding)', 'manaure', 'en_proceso', NULL, NULL, NULL, '{}'::jsonb) on conflict (id) do nothing;
insert into public.units (id, tenant_id, nombre, municipio, estado_reconocimiento, autoridad_tradicional, geopunto, poblacion_estimada, atributos) values ('unit-hocol-28', 'ten-hocol', 'Comunidad Wayuu 28 — Manaure (nombre por confirmar en onboarding)', 'manaure', 'en_proceso', NULL, NULL, NULL, '{}'::jsonb) on conflict (id) do nothing;
insert into public.units (id, tenant_id, nombre, municipio, estado_reconocimiento, autoridad_tradicional, geopunto, poblacion_estimada, atributos) values ('unit-hocol-29', 'ten-hocol', 'Comunidad Wayuu 29 — Manaure (nombre por confirmar en onboarding)', 'manaure', 'en_proceso', NULL, NULL, NULL, '{}'::jsonb) on conflict (id) do nothing;
insert into public.units (id, tenant_id, nombre, municipio, estado_reconocimiento, autoridad_tradicional, geopunto, poblacion_estimada, atributos) values ('unit-hocol-30', 'ten-hocol', 'Comunidad Wayuu 30 — Manaure (nombre por confirmar en onboarding)', 'manaure', 'en_proceso', NULL, NULL, NULL, '{}'::jsonb) on conflict (id) do nothing;
insert into public.units (id, tenant_id, nombre, municipio, estado_reconocimiento, autoridad_tradicional, geopunto, poblacion_estimada, atributos) values ('unit-hocol-31', 'ten-hocol', 'Comunidad Wayuu 31 — Manaure (nombre por confirmar en onboarding)', 'manaure', 'en_proceso', NULL, NULL, NULL, '{}'::jsonb) on conflict (id) do nothing;
insert into public.units (id, tenant_id, nombre, municipio, estado_reconocimiento, autoridad_tradicional, geopunto, poblacion_estimada, atributos) values ('unit-hocol-32', 'ten-hocol', 'Comunidad Wayuu 32 — Manaure (nombre por confirmar en onboarding)', 'manaure', 'en_proceso', NULL, NULL, NULL, '{}'::jsonb) on conflict (id) do nothing;
insert into public.units (id, tenant_id, nombre, municipio, estado_reconocimiento, autoridad_tradicional, geopunto, poblacion_estimada, atributos) values ('unit-hocol-33', 'ten-hocol', 'Comunidad Wayuu 33 — Manaure (nombre por confirmar en onboarding)', 'manaure', 'en_proceso', NULL, NULL, NULL, '{}'::jsonb) on conflict (id) do nothing;
insert into public.units (id, tenant_id, nombre, municipio, estado_reconocimiento, autoridad_tradicional, geopunto, poblacion_estimada, atributos) values ('unit-hocol-34', 'ten-hocol', 'Comunidad Wayuu 34 — Manaure (nombre por confirmar en onboarding)', 'manaure', 'en_proceso', NULL, NULL, NULL, '{}'::jsonb) on conflict (id) do nothing;
insert into public.units (id, tenant_id, nombre, municipio, estado_reconocimiento, autoridad_tradicional, geopunto, poblacion_estimada, atributos) values ('unit-hocol-35', 'ten-hocol', 'Comunidad Wayuu 35 — Manaure (nombre por confirmar en onboarding)', 'manaure', 'en_proceso', NULL, NULL, NULL, '{}'::jsonb) on conflict (id) do nothing;
insert into public.units (id, tenant_id, nombre, municipio, estado_reconocimiento, autoridad_tradicional, geopunto, poblacion_estimada, atributos) values ('unit-hocol-36', 'ten-hocol', 'Comunidad Wayuu 36 — Manaure (nombre por confirmar en onboarding)', 'manaure', 'en_proceso', NULL, NULL, NULL, '{}'::jsonb) on conflict (id) do nothing;
-- indicators (44)
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-001', 'ten-hocol', NULL, NULL, NULL, 'IND-EST-01', 'Comunidades fortalecidas', 'Comunidades', NULL, 36, 0, 'numero', 'final', 'Actas de cierre de fase por comunidad', NULL, NULL, false, false, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-002', 'ten-hocol', NULL, NULL, NULL, 'IND-EST-02', 'Proyectos comunitarios formulados', 'Proyectos', NULL, 36, 0, 'numero', 'trimestral', 'Documentos de proyecto formulados', NULL, NULL, false, false, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-003', 'ten-hocol', NULL, NULL, NULL, 'IND-EST-03', 'Proyectos comunitarios implementados', 'Proyectos', NULL, 36, 0, 'numero', 'trimestral', 'Actas de entrega e informes de implementación', NULL, NULL, false, false, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-004', 'ten-hocol', NULL, NULL, NULL, 'IND-EST-04', 'Cumplimiento físico del convenio', '%', NULL, 95, 0, 'porcentaje', 'mensual', 'Tablero de control — avance físico', NULL, NULL, false, false, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-005', 'ten-hocol', NULL, NULL, NULL, 'IND-EST-05', 'Ejecución financiera del convenio', '%', NULL, 95, 0, 'porcentaje', 'mensual', 'Informe financiero mensual', NULL, NULL, false, false, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-006', 'ten-hocol', NULL, NULL, NULL, 'IND-EST-06', 'Cumplimiento de cronograma', '%', NULL, 95, 0, 'porcentaje', 'mensual', 'Cronograma actualizado vs ejecutado', NULL, NULL, false, false, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-007', 'ten-hocol', NULL, NULL, NULL, 'IND-EST-07', 'Trazabilidad documental', '%', NULL, 100, 0, 'porcentaje', 'continua', 'Repositorio documental con evidencias enlazadas', NULL, NULL, false, false, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-008', 'ten-hocol', NULL, NULL, NULL, 'IND-EST-08', 'Satisfacción del financiador', '%', NULL, 90, 0, 'porcentaje', 'semestral', 'Encuesta de satisfacción Hocol', NULL, NULL, false, false, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-009', 'ten-hocol', NULL, NULL, 'line-hocol-l1', 'IND-L1-01', 'Diagnósticos comunitarios realizados', 'Diagnósticos', NULL, 36, 0, 'numero', 'mensual', 'Fichas de diagnóstico validadas', NULL, NULL, false, false, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-010', 'ten-hocol', NULL, NULL, 'line-hocol-l1', 'IND-L1-02', 'Comunidades caracterizadas', 'Comunidades', NULL, 36, 0, 'numero', 'mensual', 'Fichas de caracterización validadas', NULL, NULL, false, false, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-011', 'ten-hocol', NULL, NULL, 'line-hocol-l1', 'IND-L1-03', 'Planes de fortalecimiento elaborados', 'Planes', NULL, 36, 0, 'numero', 'trimestral', 'Planes de fortalecimiento aprobados', NULL, NULL, false, false, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-012', 'ten-hocol', NULL, NULL, 'line-hocol-l1', 'IND-L1-04', 'Proyectos formulados (L1)', 'Proyectos', NULL, 36, 0, 'numero', 'trimestral', 'Documentos de formulación', NULL, NULL, false, false, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-013', 'ten-hocol', NULL, NULL, 'line-hocol-l1', 'IND-L1-05', 'Proyectos implementados (L1)', 'Proyectos', NULL, 36, 0, 'numero', 'trimestral', 'Actas de implementación', NULL, NULL, false, false, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-014', 'ten-hocol', NULL, NULL, 'line-hocol-l1', 'IND-L1-06', 'Planes de inversión ejecutados', 'Planes', NULL, 36, 0, 'numero', 'trimestral', 'Soportes de ejecución de inversión', NULL, NULL, false, false, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-015', 'ten-hocol', NULL, NULL, 'line-hocol-l1', 'IND-L1-07', 'Culminación de procesos de formación', '%', NULL, 90, 0, 'porcentaje', 'trimestral', 'Registros de asistencia y certificados', NULL, NULL, false, false, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-016', 'ten-hocol', NULL, NULL, 'line-hocol-l1', 'IND-L1-08', 'Estrategia de sostenibilidad formulada', 'Documento', NULL, 1, 0, 'numero', 'final', 'Documento de estrategia aprobado', NULL, NULL, false, false, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-017', 'ten-hocol', NULL, NULL, 'line-hocol-l2', 'IND-L2-01', 'Solicitudes atendidas', 'Solicitudes', NULL, NULL, 0, 'numero', 'mensual', 'Registros de solicitud con cierre técnico', NULL, NULL, false, true, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-018', 'ten-hocol', NULL, NULL, 'line-hocol-l2', 'IND-L2-02', 'Solicitudes con cierre técnico', '%', NULL, 100, 0, 'porcentaje', 'mensual', 'Actas de cierre técnico', NULL, NULL, false, false, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-019', 'ten-hocol', NULL, NULL, 'line-hocol-l2', 'IND-L2-03', 'Solicitudes atendidas en tiempo', '%', NULL, 90, 0, 'porcentaje', 'mensual', 'Comparativo fecha solicitud vs atención', NULL, NULL, false, false, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-020', 'ten-hocol', NULL, NULL, 'line-hocol-l2', 'IND-L2-04', 'Trazabilidad de solicitudes', '%', NULL, 100, 0, 'porcentaje', 'continua', 'Expedientes con evidencias completas', NULL, NULL, false, false, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-021', 'ten-hocol', NULL, NULL, 'line-hocol-l3', 'IND-L3-01', 'Iniciativas culturales apoyadas', 'Iniciativas', NULL, NULL, 0, 'numero', 'trimestral', 'Registros de apoyo cultural', NULL, NULL, false, true, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-022', 'ten-hocol', NULL, NULL, 'line-hocol-l3', 'IND-L3-02', 'Actividades de patrimonio realizadas', 'Actividades', NULL, NULL, 0, 'numero', 'trimestral', 'Registros de actividad con evidencia', NULL, NULL, false, true, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-023', 'ten-hocol', NULL, NULL, 'line-hocol-l3', 'IND-L3-03', 'Participantes en actividades culturales', 'Personas', NULL, NULL, 0, 'numero', 'trimestral', 'Registros de asistencia', NULL, NULL, false, true, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-024', 'ten-hocol', NULL, NULL, 'line-hocol-l3', 'IND-L3-04', 'Satisfacción con actividades culturales', '%', NULL, 90, 0, 'porcentaje', 'semestral', 'Encuestas de satisfacción', NULL, NULL, false, false, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-025', 'ten-hocol', NULL, NULL, 'line-hocol-l4', 'IND-L4-01', 'Apoyos humanitarios ejecutados', 'Apoyos', NULL, NULL, 0, 'numero', 'mensual', 'Registros de apoyo con acta de entrega', NULL, NULL, false, true, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-026', 'ten-hocol', NULL, NULL, 'line-hocol-l4', 'IND-L4-02', 'Atenciones de usos y costumbres', 'Atenciones', NULL, NULL, 0, 'numero', 'mensual', 'Registros de atención', NULL, NULL, false, true, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-027', 'ten-hocol', NULL, NULL, 'line-hocol-l4', 'IND-L4-03', 'Trazabilidad de apoyos (L4)', '%', NULL, 100, 0, 'porcentaje', 'continua', 'Expedientes con evidencias completas', NULL, NULL, false, false, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-028', 'ten-hocol', NULL, NULL, 'line-hocol-l4', 'IND-L4-04', 'Satisfacción con apoyos (L4)', '%', NULL, 90, 0, 'porcentaje', 'semestral', 'Encuestas de satisfacción', NULL, NULL, false, false, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-029', 'ten-hocol', NULL, NULL, 'line-hocol-l5', 'IND-L5-01', 'Jornadas y acciones de salud realizadas', 'Jornadas', NULL, NULL, 0, 'numero', 'mensual', 'Registros de atención en salud', NULL, NULL, false, true, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-030', 'ten-hocol', NULL, NULL, 'line-hocol-l5', 'IND-L5-02', 'Personas beneficiadas en salud', 'Personas', NULL, NULL, 0, 'numero', 'mensual', 'Registros de atención individual', NULL, NULL, false, true, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-031', 'ten-hocol', NULL, NULL, 'line-hocol-l5', 'IND-L5-03', 'Instituciones de salud articuladas', 'Instituciones', NULL, NULL, 0, 'numero', 'trimestral', 'Convenios/actas de articulación', NULL, NULL, false, true, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-032', 'ten-hocol', NULL, NULL, 'line-hocol-l5', 'IND-L5-04', 'Satisfacción con jornadas de salud', '%', NULL, 90, 0, 'porcentaje', 'semestral', 'Encuestas de satisfacción', NULL, NULL, false, false, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-033', 'ten-hocol', NULL, NULL, 'line-hocol-meal', 'IND-MEAL-01', 'Línea base consolidada', 'Documento', NULL, 1, 0, 'numero', 'final', 'Documento de línea base congelado', NULL, NULL, false, false, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-034', 'ten-hocol', NULL, NULL, 'line-hocol-meal', 'IND-MEAL-02', 'Sistema MEAL en operación', 'Sistema', NULL, 1, 0, 'numero', 'continua', 'Plataforma operativa con usuarios activos', NULL, NULL, false, false, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-035', 'ten-hocol', NULL, NULL, 'line-hocol-meal', 'IND-MEAL-03', 'Tablero de control actualizado mensualmente', '%', NULL, 100, 0, 'porcentaje', 'mensual', 'Bitácora de actualización del tablero', NULL, NULL, false, false, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-036', 'ten-hocol', NULL, NULL, 'line-hocol-meal', 'IND-MEAL-04', 'Indicadores actualizados al día', '%', NULL, 100, 0, 'porcentaje', 'mensual', 'Reporte de vigencia de indicadores', NULL, NULL, false, false, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-037', 'ten-hocol', NULL, NULL, 'line-hocol-meal', 'IND-MEAL-05', 'Informes técnicos mensuales entregados', 'Informes', NULL, 12, 0, 'numero', 'mensual', 'Informes técnicos radicados', NULL, NULL, false, false, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-038', 'ten-hocol', NULL, NULL, 'line-hocol-meal', 'IND-MEAL-06', 'Informes financieros mensuales entregados', 'Informes', NULL, 12, 0, 'numero', 'mensual', 'Informes financieros radicados', NULL, NULL, false, false, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-039', 'ten-hocol', NULL, NULL, 'line-hocol-meal', 'IND-MEAL-07', 'Informes de seguimiento entregados', 'Informes', NULL, 12, 0, 'numero', 'mensual', 'Informes de seguimiento radicados', NULL, NULL, false, false, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-040', 'ten-hocol', NULL, NULL, 'line-hocol-meal', 'IND-MEAL-08', 'Evaluación final realizada', 'Evaluación', NULL, 1, 0, 'numero', 'final', 'Informe de evaluación final', NULL, NULL, false, false, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-041', 'ten-hocol', NULL, NULL, 'line-hocol-meal', 'IND-MEAL-09', 'Evaluación de impacto realizada', 'Evaluación', NULL, 1, 0, 'numero', 'final', 'Informe de evaluación de impacto', NULL, NULL, false, false, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-042', 'ten-hocol', NULL, NULL, 'line-hocol-meal', 'IND-MEAL-10', 'Documento de lecciones aprendidas', 'Documento', NULL, 1, 0, 'numero', 'final', 'Documento consolidado de lecciones', NULL, NULL, false, false, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-043', 'ten-hocol', NULL, NULL, 'line-hocol-meal', 'IND-MEAL-11', 'Banco de evidencias consolidado', 'Repositorio', NULL, 1, 0, 'numero', 'continua', 'Repositorio documental completo', NULL, NULL, false, false, NULL) on conflict (id) do nothing;
insert into public.indicators (id, tenant_id, project_id, logframe_id, linea_id, code, name, unit, baseline, target, actual, meta_tipo, frecuencia, medio_verificacion, formula, linea_base_valor, linea_base_congelada, meta_ajustable, disaggregated_data) values ('ind-hocol-044', 'ten-hocol', NULL, NULL, 'line-hocol-meal', 'IND-MEAL-12', 'Trazabilidad extremo a extremo', '%', NULL, 100, 0, 'porcentaje', 'continua', 'Auditoría de reconstrucción de indicadores', NULL, NULL, false, false, NULL) on conflict (id) do nothing;
-- forms (9)
insert into public.forms (id, tenant_id, codigo, nombre, version, linea_id, activo, campos) values ('frm-hocol-lineabase', 'ten-hocol', 'F-LB', 'Encuesta de línea base comunitaria', 1, 'line-hocol-l1', true, '[{"name":"comunidad_confirma","etiqueta_es":"Comunidad donde se aplica","etiqueta_way":null,"tipo":"texto","obligatorio":true,"reglas_validacion":null},{"name":"fecha_aplicacion","etiqueta_es":"Fecha de aplicación","etiqueta_way":null,"tipo":"fecha","obligatorio":true,"reglas_validacion":null},{"name":"geopunto","etiqueta_es":"Ubicación de la aplicación","etiqueta_way":null,"tipo":"geo","obligatorio":true,"reglas_validacion":null},{"name":"poblacion_total","etiqueta_es":"Población total estimada de la comunidad","etiqueta_way":null,"tipo":"num","obligatorio":true,"reglas_validacion":null},{"name":"familias","etiqueta_es":"Número de familias","etiqueta_way":null,"tipo":"num","obligatorio":true,"reglas_validacion":null},{"name":"acceso_agua","etiqueta_es":"¿La comunidad cuenta con acceso a agua?","etiqueta_way":null,"tipo":"bool","obligatorio":true,"reglas_validacion":null},{"name":"fuente_ingresos","etiqueta_es":"Principal fuente de ingresos","etiqueta_way":null,"tipo":"select","obligatorio":true,"reglas_validacion":null,"opciones":["Pastoreo","Artesanías","Pesca","Comercio","Jornaleo","Otra"]},{"name":"observaciones","etiqueta_es":"Observaciones generales","etiqueta_way":null,"tipo":"texto","obligatorio":false,"reglas_validacion":null}]'::jsonb) on conflict (id) do nothing;
insert into public.forms (id, tenant_id, codigo, nombre, version, linea_id, activo, campos) values ('frm-hocol-caracterizacion', 'ten-hocol', 'F-CAR', 'Ficha de caracterización comunitaria', 1, 'line-hocol-l1', true, '[{"name":"autoridad","etiqueta_es":"Autoridad tradicional de la comunidad","etiqueta_way":null,"tipo":"texto","obligatorio":true,"reglas_validacion":null},{"name":"estado_reconocimiento","etiqueta_es":"Estado de reconocimiento","etiqueta_way":null,"tipo":"select","obligatorio":true,"reglas_validacion":null,"opciones":["Legalizada","En proceso"]},{"name":"geopunto","etiqueta_es":"Coordenadas de la comunidad","etiqueta_way":null,"tipo":"geo","obligatorio":true,"reglas_validacion":null},{"name":"foto_panoramica","etiqueta_es":"Foto panorámica de la comunidad","etiqueta_way":null,"tipo":"foto","obligatorio":true,"reglas_validacion":null},{"name":"organizaciones","etiqueta_es":"Organizaciones presentes en la comunidad","etiqueta_way":null,"tipo":"texto","obligatorio":false,"reglas_validacion":null}]'::jsonb) on conflict (id) do nothing;
insert into public.forms (id, tenant_id, codigo, nombre, version, linea_id, activo, campos) values ('frm-hocol-asistencia', 'ten-hocol', 'F-ASI', 'Registro de asistencia', 1, 'line-hocol-l1', true, '[{"name":"actividad","etiqueta_es":"Nombre de la actividad","etiqueta_way":null,"tipo":"texto","obligatorio":true,"reglas_validacion":null},{"name":"fecha","etiqueta_es":"Fecha de la actividad","etiqueta_way":null,"tipo":"fecha","obligatorio":true,"reglas_validacion":null},{"name":"num_asistentes","etiqueta_es":"Número de asistentes","etiqueta_way":null,"tipo":"num","obligatorio":true,"reglas_validacion":null},{"name":"num_mujeres","etiqueta_es":"Número de mujeres asistentes","etiqueta_way":null,"tipo":"num","obligatorio":true,"reglas_validacion":null},{"name":"foto_asistencia","etiqueta_es":"Foto del listado de asistencia","etiqueta_way":null,"tipo":"foto","obligatorio":true,"reglas_validacion":null},{"name":"firma_responsable","etiqueta_es":"Firma del responsable","etiqueta_way":null,"tipo":"firma","obligatorio":true,"reglas_validacion":null}]'::jsonb) on conflict (id) do nothing;
insert into public.forms (id, tenant_id, codigo, nombre, version, linea_id, activo, campos) values ('frm-hocol-acta-entrega', 'ten-hocol', 'F-ACT', 'Acta de entrega', 1, 'line-hocol-l1', true, '[{"name":"bien_entregado","etiqueta_es":"Bien o servicio entregado","etiqueta_way":null,"tipo":"texto","obligatorio":true,"reglas_validacion":null},{"name":"receptor","etiqueta_es":"Persona/organización que recibe","etiqueta_way":null,"tipo":"texto","obligatorio":true,"reglas_validacion":null},{"name":"fecha_entrega","etiqueta_es":"Fecha de entrega","etiqueta_way":null,"tipo":"fecha","obligatorio":true,"reglas_validacion":null},{"name":"geopunto","etiqueta_es":"Lugar de la entrega","etiqueta_way":null,"tipo":"geo","obligatorio":true,"reglas_validacion":null},{"name":"foto_entrega","etiqueta_es":"Registro fotográfico de la entrega","etiqueta_way":null,"tipo":"foto","obligatorio":true,"reglas_validacion":null},{"name":"firma_receptor","etiqueta_es":"Firma de quien recibe","etiqueta_way":null,"tipo":"firma","obligatorio":true,"reglas_validacion":null}]'::jsonb) on conflict (id) do nothing;
insert into public.forms (id, tenant_id, codigo, nombre, version, linea_id, activo, campos) values ('frm-hocol-solicitud', 'ten-hocol', 'F-SOL', 'Registro de solicitud (L2)', 1, 'line-hocol-l2', true, '[{"name":"descripcion","etiqueta_es":"Descripción de la solicitud","etiqueta_way":null,"tipo":"texto","obligatorio":true,"reglas_validacion":null},{"name":"fecha_solicitud","etiqueta_es":"Fecha de la solicitud","etiqueta_way":null,"tipo":"fecha","obligatorio":true,"reglas_validacion":null},{"name":"solicitante","etiqueta_es":"Nombre del solicitante o autoridad","etiqueta_way":null,"tipo":"texto","obligatorio":true,"reglas_validacion":null},{"name":"priorizada","etiqueta_es":"¿Priorizada por el financiador?","etiqueta_way":null,"tipo":"bool","obligatorio":true,"reglas_validacion":null},{"name":"estado_atencion","etiqueta_es":"Estado de atención","etiqueta_way":null,"tipo":"select","obligatorio":true,"reglas_validacion":null,"opciones":["Registrada","En gestión","Atendida","Cerrada"]}]'::jsonb) on conflict (id) do nothing;
insert into public.forms (id, tenant_id, codigo, nombre, version, linea_id, activo, campos) values ('frm-hocol-apoyo-cultural', 'ten-hocol', 'F-CUL', 'Registro de apoyo cultural (L3)', 1, 'line-hocol-l3', true, '[{"name":"iniciativa","etiqueta_es":"Iniciativa o actividad cultural apoyada","etiqueta_way":null,"tipo":"texto","obligatorio":true,"reglas_validacion":null},{"name":"fecha","etiqueta_es":"Fecha de la actividad","etiqueta_way":null,"tipo":"fecha","obligatorio":true,"reglas_validacion":null},{"name":"participantes","etiqueta_es":"Número de participantes","etiqueta_way":null,"tipo":"num","obligatorio":true,"reglas_validacion":null},{"name":"foto_actividad","etiqueta_es":"Registro fotográfico","etiqueta_way":null,"tipo":"foto","obligatorio":true,"reglas_validacion":null},{"name":"satisfaccion","etiqueta_es":"Satisfacción de los participantes (1 a 5)","etiqueta_way":null,"tipo":"escala","obligatorio":true,"reglas_validacion":null}]'::jsonb) on conflict (id) do nothing;
insert into public.forms (id, tenant_id, codigo, nombre, version, linea_id, activo, campos) values ('frm-hocol-apoyo-humanitario', 'ten-hocol', 'F-HUM', 'Registro de apoyo humanitario (L4)', 1, 'line-hocol-l4', true, '[{"name":"tipo_apoyo","etiqueta_es":"Tipo de apoyo","etiqueta_way":null,"tipo":"select","obligatorio":true,"reglas_validacion":null,"opciones":["Humanitario","Usos y costumbres"]},{"name":"descripcion","etiqueta_es":"Descripción del apoyo entregado","etiqueta_way":null,"tipo":"texto","obligatorio":true,"reglas_validacion":null},{"name":"fecha_entrega","etiqueta_es":"Fecha de entrega","etiqueta_way":null,"tipo":"fecha","obligatorio":true,"reglas_validacion":null},{"name":"geopunto","etiqueta_es":"Lugar de entrega","etiqueta_way":null,"tipo":"geo","obligatorio":true,"reglas_validacion":null},{"name":"foto_entrega","etiqueta_es":"Registro fotográfico","etiqueta_way":null,"tipo":"foto","obligatorio":true,"reglas_validacion":null},{"name":"firma_receptor","etiqueta_es":"Firma de quien recibe","etiqueta_way":null,"tipo":"firma","obligatorio":true,"reglas_validacion":null}]'::jsonb) on conflict (id) do nothing;
insert into public.forms (id, tenant_id, codigo, nombre, version, linea_id, activo, campos) values ('frm-hocol-atencion-salud', 'ten-hocol', 'F-SAL', 'Registro de atención en salud (L5)', 1, 'line-hocol-l5', true, '[{"name":"tipo_jornada","etiqueta_es":"Tipo de jornada o acción de salud","etiqueta_way":null,"tipo":"texto","obligatorio":true,"reglas_validacion":null},{"name":"fecha","etiqueta_es":"Fecha de la jornada","etiqueta_way":null,"tipo":"fecha","obligatorio":true,"reglas_validacion":null},{"name":"personas_atendidas","etiqueta_es":"Personas atendidas","etiqueta_way":null,"tipo":"num","obligatorio":true,"reglas_validacion":null},{"name":"institucion","etiqueta_es":"Institución de salud articulada","etiqueta_way":null,"tipo":"texto","obligatorio":false,"reglas_validacion":null},{"name":"foto_jornada","etiqueta_es":"Registro fotográfico","etiqueta_way":null,"tipo":"foto","obligatorio":true,"reglas_validacion":null}]'::jsonb) on conflict (id) do nothing;
insert into public.forms (id, tenant_id, codigo, nombre, version, linea_id, activo, campos) values ('frm-hocol-mentoria', 'ten-hocol', 'F-MEN', 'Registro de mentoría / asistencia técnica', 1, 'line-hocol-l1', true, '[{"name":"tema","etiqueta_es":"Tema de la mentoría o asistencia","etiqueta_way":null,"tipo":"texto","obligatorio":true,"reglas_validacion":null},{"name":"fecha","etiqueta_es":"Fecha de la sesión","etiqueta_way":null,"tipo":"fecha","obligatorio":true,"reglas_validacion":null},{"name":"duracion_horas","etiqueta_es":"Duración (horas)","etiqueta_way":null,"tipo":"num","obligatorio":true,"reglas_validacion":null},{"name":"participantes","etiqueta_es":"Número de participantes","etiqueta_way":null,"tipo":"num","obligatorio":true,"reglas_validacion":null},{"name":"compromisos","etiqueta_es":"Compromisos acordados","etiqueta_way":null,"tipo":"texto","obligatorio":false,"reglas_validacion":null}]'::jsonb) on conflict (id) do nothing;

-- Verificación: debe devolver 3 tenants
select id, nombre from public.tenants order by id;
