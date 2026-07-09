# Plataforma MEAL — Fundación Guajira Competitiva

Plataforma **multi-tenant** de Monitoreo, Evaluación, Aprendizaje y Rendición de
Cuentas (MEAL) para proyectos de inversión social, construida según el
**Documento Rector Técnico v2.0 (DRT)**. Offline-first, 100% open source y sin
costos de licenciamiento.

> **Regla de oro:** nada específico de un proyecto vive en el código. Comunidades,
> líneas, indicadores, formularios, roles y PQRS son **configuración por tenant**.
> Dar de alta un convenio nuevo no requiere desarrollo ni despliegue (HU-12).

## Arquitectura

| Capa | Tecnología | Notas |
|---|---|---|
| App de campo / panel web | **React 19 PWA** (Vite) instalable en Android | Captura offline, cámara y GPS con APIs web estándar (RNF-10) |
| BD local offline | **Dexie / IndexedDB** (esquema v2 multi-tenant) | Fuente primaria en campo; cola de sync idempotente por UUID |
| Backend | **Supabase autoalojable** (PostgreSQL 15 + PostGIS + RLS, Storage S3, Auth JWT) | Open source, residencia de datos en Colombia (Ley 1581/2012) |
| Sync alterno | **WebRTC P2P** en LAN sin internet | Fusión firmada entre dispositivos en campo |
| Integridad | **SHA-256** por registro + bitácora append-only | Todo indicador reconstruible desde datos crudos (RNF-8) |

### Estructura del repositorio

```
src/
  db.js                 Esquema Dexie v2 multi-tenant + firmas SHA-256 + logAudit
  syncEngine.js         Push/pull idempotente, backoff, evidencias diferidas, P2P
  context/              TenantContext (tenant activo, membresías, capacidades)
  lib/
    roles.js            Roles plataforma/tenant y matriz de capacidades (RBAC 3.2)
    formEngine.js       Motor de formularios: 9 tipos de campo, validación, condicionales
    indicatorEngine.js  Fórmulas JSON (conteo/suma/promedio/%), semáforo, duplicados
    rulesEngine.js      Motor de reglas determinista (base de condicionales y filtros)
    crypto.js           AES-GCM para datos personales (Habeas Data) + hash de documento
    evidence.js         Compresión de fotos + hash de integridad, subida diferida
    exportCsv.js        Exportación CSV abierta de cualquier tabla
  seeds/                Configuración por tenant (Wayuu, Maicao, Hocol = Anexo E)
  views/                Dashboard (6 vistas 10.1), FieldCapture, Validation, FormBuilder,
                        Beneficiaries, Feedback (PQRS/SLA), Repository, AuditLog,
                        Reports, Catalog, TenantAdmin, Users, Projects, Indicators…
supabase/migrations/    001 esquema (7.2) · 002 RLS por tenant · 003 triggers de integridad
deploy/                 docker-compose (nginx + backups) y nginx.conf
docs/                   Manual de usuario por rol
```

## Puesta en marcha (desarrollo)

```bash
npm install
npm run dev        # http://localhost:5173 (modo demo local sin backend)
npm test           # vitest — incluye el gate de aislamiento multi-tenant
npm run build      # PWA de producción en dist/
```

Variables de entorno (`.env`) para conectar el backend:

```bash
VITE_SUPABASE_URL=https://<tu-instancia>
VITE_SUPABASE_ANON_KEY=<anon-key>
```

Sin estas variables la app opera en **modo demo local** (sembrado de los 3 tenants
y simulador de roles en la pantalla de acceso).

## Backend y despliegue autoalojado

1. Instalar Supabase self-hosted (open source) según `deploy/docker-compose.yml`
   (instrucciones en el encabezado del archivo).
2. Aplicar las migraciones de `supabase/migrations/` en orden (ver `supabase/README.md`).
3. `npm run build` y levantar `deploy/docker-compose.yml` (nginx sirve `dist/`,
   servicio de **backup diario** `pg_dump` con retención de 30 días — RNF-14).
4. Terminar TLS 1.2+ delante de nginx (RNF-6).

## Gates de aceptación (DRT 13.2 — si fallan, el sistema no se acepta)

1. **Aislamiento multi-tenant (13.2-2):** `npm test` ejecuta
   `src/__tests/tenantIsolation.test.js` — 3 tenants sembrados, cero fugas entre
   tenants, manipulación de identificadores sin efecto, y verificación de que las
   migraciones fuerzan RLS en todas las tablas. En despliegue, repetir la batería
   contra PostgreSQL real con dos usuarios de tenants distintos.
2. **Jornada offline (13.2-1):** procedimiento UAT en dispositivo real —
   ≥50 registros con fotos durante 8h sin señal (usar el botón *Simular Offline*
   para ensayos); al reconectar, el 100% concilia sin duplicados (idempotencia
   por UUID) ni pérdidas. La cola muestra estado por registro: local / en cola /
   sincronizado / error (RF-OFF-6).

## Seguridad y cumplimiento

- **RLS por tenant** en todas las tablas + membresías usuario×tenant×rol; el
  backend fuerza el aislamiento aunque el cliente se manipule (HU-11).
- **Separación de funciones** (11.3): quien captura no valida su propio dato
  (bloqueado en UI y por trigger en servidor).
- **Habeas Data (Ley 1581/2012):** datos personales cifrados AES-GCM en el
  cliente, consentimiento informado obligatorio, acceso a datos personales
  auditado, PQRS con reserva de identidad.
- **Inmutabilidad:** registros de campo y evidencias no se editan tras
  sincronizar; las correcciones crean registros nuevos encadenados (8.4).
  Bitácora append-only sin UPDATE/DELETE (M13).
- **Línea base congelable** con trazabilidad en bitácora (HU-05).

## Propiedad y salida (14.3)

Código, datos y documentación pertenecen a la Fundación / convenio. La vista
**Reportes y Export** entrega la exportación total en formatos abiertos
(JSON/CSV) y paquetes de auditoría verificables por unidad/período, sin lock-in.

## Documentación

- `docs/MANUAL_USUARIO.md` — flujos por rol (gestor, coordinador, director, admin).
- `supabase/README.md` — migraciones y garantías del backend.
- Documento rector: *DRT v2.0 — Plataforma MEAL multi-proyecto* (fuente única de verdad técnica).
