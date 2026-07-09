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
