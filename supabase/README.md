# Backend de la Plataforma MEAL (Supabase / PostgreSQL)

Este directorio contiene las migraciones SQL de la plataforma multi-tenant
descritas en el Documento Rector Técnico (DRT v2.0).

## Migraciones

| Archivo | Contenido |
|---|---|
| `migrations/001_schema.sql` | Esquema completo (diccionario 7.2 del DRT): tenants, membresías, catálogos, formularios, registros de campo, evidencias, indicadores, PQRS, bitácora. |
| `migrations/002_rls.sql` | Aislamiento multi-tenant con Row-Level Security + políticas por rol + bucket de evidencias segregado por tenant. |
| `migrations/003_audit_triggers.sql` | Triggers de bitácora automática, congelación de línea base, inmutabilidad de registros/evidencias, separación de funciones y consentimiento obligatorio. |

## Cómo aplicar

### Opción A — Supabase CLI (desarrollo y cloud)

```bash
npx supabase db push          # contra el proyecto vinculado
# o, contra una instancia local:
npx supabase start
npx supabase db reset         # aplica migrations/ en orden
```

### Opción B — psql directo (VPS autoalojado)

```bash
psql "$DATABASE_URL" -f migrations/001_schema.sql
psql "$DATABASE_URL" -f migrations/002_rls.sql
psql "$DATABASE_URL" -f migrations/003_audit_triggers.sql
```

## Principios que el esquema garantiza en servidor

- **Aislamiento por tenant (M0):** RLS fuerza que ningún usuario vea filas de
  un tenant al que no pertenece, aunque manipule identificadores (HU-11).
- **Bitácora append-only (M13):** `audit_log` no admite UPDATE/DELETE.
- **Inmutabilidad (8.4):** registros de campo y evidencias no se editan tras
  sincronizar; las correcciones crean registros nuevos encadenados.
- **Separación de funciones (11.3):** el autor de un registro no puede validarlo.
- **Habeas Data (M12):** beneficiarios solo con consentimiento otorgado; campos
  sensibles llegan cifrados desde el cliente.
- **Línea base congelada (HU-05):** protegida por trigger; todo cambio queda auditado.

## Residencia de datos

Para producción se recomienda una instancia autoalojada de Supabase
(open source, Docker) en un VPS con residencia en Colombia, conforme a la
Ley 1581/2012. El `docker-compose` de despliegue se entrega en la Fase 5.
