# Migración a Neon — Guía paso a paso

**Por qué:** el proyecto gratuito de Supabase se **pausa solo** tras 7 días con
poca actividad, y entonces la app deja de iniciar sesión y de sincronizar. Así
ocurrió en 2026: `mealguajira.netlify.app` quedó apuntando a un Supabase
pausado. Neon es PostgreSQL igual que Supabase, pero en su plan gratuito la
base **se duerme a los 5 minutos sin uso y se despierta sola** en la siguiente
petición (tarda menos de un segundo). No hay que "restaurar" nada a mano.

**Qué cambia:**

| Pieza | Antes (Supabase) | Ahora (Neon) |
|---|---|---|
| Base de datos | PostgreSQL de Supabase | PostgreSQL de Neon (mismo esquema, mismas reglas RLS) |
| Inicio de sesión | Supabase Auth | Neon Auth |
| API de datos | API REST de Supabase | Data API de Neon (compatible) |
| Fotos de evidencia | Supabase Storage | Netlify Blobs (función `netlify/functions/evidencias.mjs`) |
| App web | Netlify | Netlify (sin cambios) |

**Qué NO cambia:** la app, sus pantallas, el modo offline y los datos que ya
están guardados en cada celular.

> Las **contraseñas no se pueden migrar** de Supabase a Neon (cada uno las
> cifra distinto). Cada persona crea su cuenta de nuevo en el Paso 5; los
> datos se conservan.

Tiempo estimado: 30–45 minutos. Sigue los pasos **en orden**. Si algo no sale
como dice el paso, **detente** y cópiame el mensaje exacto.

## Estado actual (9 de octubre de 2026)

Los pasos 1 a 4 ya están hechos sobre la cuenta de Neon y el sitio de Netlify
de la Fundación:

| Qué | Valor |
|---|---|
| Proyecto Neon | `meal-produccion` (id `square-sunset-67865502`), región São Paulo, Postgres 17 |
| URL de Neon Auth | `https://ep-aged-fog-b6lfibr6.neonauth.c-2.sa-east-1.aws.neon.tech/neondb/auth` |
| URL de la Data API | `https://ep-aged-fog-b6lfibr6.apirest.c-2.sa-east-1.aws.neon.tech/neondb/rest/v1` |
| Dominios de confianza (Auth) | `https://mealguajira.netlify.app`, `http://localhost:5173` |
| Base de datos | `instalacion_neon.sql` aplicado y verificado (huella md5 idéntica a la prueba local). Un solo proyecto activo: **Convenio Hocol** (36 comunidades, 44 indicadores, 9 formularios); 62 políticas RLS; **0 datos operativos**. Los proyectos de ejemplo Wayuu y Maicao quedaron **cerrados** (sin configuración, ocultos en la app; su historial sigue en la bitácora). Respaldo previo a esa limpieza: rama `respaldo-antes-de-solo-hocol`. |
| Netlify | variables `VITE_NEON_AUTH_URL` y `VITE_NEON_DATA_API_URL` creadas; el sitio publica desde GitHub (`main`) |

Los datos que había en Supabase eran de prueba y **no se migraron** (el Paso 0
no aplica). Los dispositivos que usaron la versión anterior borran su copia
local de prueba una sola vez al abrir la nueva versión.

Cuenta de administrador creada: `admin@fundacionguajiracompetitiva.org` (Administrador de Plataforma + Administrador del proyecto Hocol). Para el resto del equipo, sigue el **Paso 5**.

---

## Paso 0 — ¿Hay datos reales en Supabase? (hazlo HOY)

Si en Supabase había registros de campo, beneficiarios, PQRS, etc. que **no**
están en otro lado, hay que rescatarlos antes de que Supabase los borre:

1. Entra a https://supabase.com/dashboard e inicia sesión.
2. Abre el proyecto. Si dice **Paused**, pulsa **Restore project** (gratis,
   tarda unos minutos). Supabase solo deja restaurar durante **90 días** desde
   que se pausó.
3. Si ya no aparece el botón de restaurar, busca en la vista general del
   proyecto la opción para **descargar el respaldo** de la base y de Storage,
   y guárdalos.
4. Avísame cuando esté restaurado o descargado: preparo la copia hacia Neon
   (incluye reasignar los datos a las cuentas nuevas por correo).

Si allí solo había pruebas, salta este paso: la configuración de los 3
proyectos (comunidades, indicadores, formularios) se carga en el Paso 3.

---

## Paso 1 — Crear el proyecto en Neon

1. Entra a https://neon.com y crea una cuenta (puedes usar la de GitHub o Google).
2. **New project**:
   - Nombre: `meal-produccion`
   - Región: **AWS South America (São Paulo)** — la más cercana a Colombia.
   - Versión de Postgres: la que venga por defecto.
3. Clic en **Create project**.

---

## Paso 2 — Habilitar la Data API con Neon Auth

Esto crea el inicio de sesión y la API que usa la app. **Debe hacerse antes
del Paso 3.**

1. En tu proyecto, menú izquierdo → **Data API**.
2. Marca **Use Neon Auth** y también **Grant public schema access**.
3. Clic en **Enable Data API**.
4. Copia y guarda dos direcciones:
   - **URL de la Data API** (contiene `apirest`, p. ej.
     `https://ep-xxxx.apirest.c-2.sa-east-1.aws.neon.tech/neondb/rest/v1`).
   - **URL de Neon Auth** (contiene `neonauth` y termina en `/auth`, p. ej.
     `https://ep-xxxx.neonauth.c-2.sa-east-1.aws.neon.tech/neondb/auth`). Está
     en **Auth** → configuración del proyecto.

> Si en São Paulo no aparece la opción de Data API o de Neon Auth, borra el
> proyecto y créalo en **AWS US East (N. Virginia)**. Todo lo demás es igual.

---

## Paso 3 — Crear la base de datos (un solo archivo)

1. En tu PC abre `D:\MEAL\neon\instalacion_neon.sql` con el **Bloc de notas**.
2. Selecciona todo (`Ctrl+A`) y copia (`Ctrl+C`).
3. En Neon, menú izquierdo → **SQL Editor**, pega (`Ctrl+V`) y clic en **Run**.
4. **Resultado esperado:** termina sin errores en rojo.
   - Si dice *"Falta el rol authenticated"* o *"Falta la función
     auth.user_id()"*: no hiciste el Paso 2. Hazlo y vuelve a correr el archivo.
5. Comprueba: menú izquierdo → **Tables** → `tenants` debe tener **1 fila**
   (Convenio Asociación Guajira — Hocol) y `units` 36 filas.

El archivo se puede volver a ejecutar sin problema: no borra ni duplica nada.

---

## Paso 4 — Conectar Netlify con Neon

### 4.1 — Variables de entorno
1. Entra a https://app.netlify.com → sitio **mealguajira**.
2. **Site configuration** → **Environment variables** → **Add a variable**.
3. Crea estas dos (pega las URLs del Paso 2, sin espacios):

   | Key | Value |
   |---|---|
   | `VITE_NEON_AUTH_URL` | la URL de Neon Auth (`…neonauth…/auth`) |
   | `VITE_NEON_DATA_API_URL` | la URL de la Data API (`…apirest…`) |

   Si ya existen `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`, puedes
   dejarlas: cuando están las de Neon, la app usa Neon.

### 4.2 — Publicar desde GitHub (necesario para las fotos)
Las fotos de evidencia se guardan con una **función de Netlify**, y las
funciones solo se publican si el sitio se construye desde el repositorio (no
arrastrando la carpeta `dist`).

1. **Site configuration** → **Build & deploy** → **Continuous deployment**.
2. Si dice que el sitio no está enlazado a un repositorio: **Link repository**
   → GitHub → `willianromero/MEAL` → rama `main`. Netlify lee la configuración
   de `netlify.toml` (no hay que escribir el comando de build).
3. **Deploys** → **Trigger deploy** → **Deploy site**. Espera a que diga
   **Published**.
4. Comprueba: **Logs & metrics → Functions** debe listar `evidencias`.

---

## Paso 5 — Crear las cuentas y dar permisos

### 5.1 — Cada persona crea su cuenta
1. Abre https://mealguajira.netlify.app (con `Ctrl+F5` para que tome la
   versión nueva).
2. En la pantalla de ingreso: **¿Primera vez? Crear cuenta** → correo y
   contraseña (mínimo 8 caracteres) → **Crear Cuenta**.
3. La cuenta queda **sin acceso a nada** hasta el paso 5.2. Es intencional:
   aunque alguien desconocido se registre, no ve ningún dato.

### 5.2 — El administrador asigna proyecto y rol (SQL Editor de Neon)
Una línea por persona, con su correo:

```sql
-- Tú (Administrador de Plataforma + Administrador del proyecto Hocol):
select public.meal_asignar_usuario('admin@fundacionguajiracompetitiva.org', 'ten-hocol', 'admin_tenant', 'platform_admin');

-- Ejemplos para el equipo:
select public.meal_asignar_usuario('gestor@ejemplo.org', 'ten-hocol', 'gestor');
select public.meal_asignar_usuario('coordinadora@ejemplo.org', 'ten-hocol', 'coordinador');
```

- Proyecto: `ten-hocol` (el único de la plataforma).
- Roles dentro del proyecto: `gestor`, `coordinador`, `director`, `admin_fin`,
  `admin_tenant`, `financiador`, `auditor`.
- Para dar acceso a otro proyecto, repite la línea con el otro `ten-…`.
- Si dice *"No existe ninguna cuenta con el correo…"*, esa persona aún no hizo
  el paso 5.1 (o escribió otro correo).

---

## Paso 6 — Probar que todo funciona

1. Inicia sesión en la app con la cuenta del administrador.
2. Arriba debe verse el selector de proyecto y el indicador **ONLINE**; a los
   pocos segundos, **Última Sincronización** con fecha (no "Nunca").
3. **Catálogo Maestro** → las 36 comunidades de Hocol. **Indicadores MEAL** →
   los indicadores del proyecto.
4. **Captura Offline** → guarda un registro **con foto**. En unos segundos los
   pendientes vuelven a 0.
5. Comprueba la foto: Netlify → sitio → **Blobs** (si aparece en el menú) → almacén `evidencias`.
6. En Neon → **Tables** → `field_records`: aparece el registro.

---

## Si algo sale mal: volver atrás en 1 minuto

Netlify guarda todas las versiones publicadas. **Deploys** → elige el deploy
anterior → **Publish deploy**. La app vuelve a la versión con Supabase (útil
solo si restauraste Supabase en el Paso 0).

---

## Costos y límites (plan gratuito de Neon, oct-2026)

- 0,5 GB de base de datos por proyecto: alcanza de sobra para los registros
  (las fotos van a Netlify, no a Neon).
- 100 horas de cómputo al mes por proyecto. La base solo gasta mientras se
  usa (se duerme a los 5 min). Si un mes se agotara, la base se suspende hasta
  el mes siguiente. Para producción con varios equipos en campo, conviene el
  plan **Launch** (pago por uso, sin mínimo mensual).
- Las fotos usan **Netlify Blobs**, incluido en el plan de Netlify.
- Residencia de datos: Neon no tiene región en Colombia; São Paulo es la más
  cercana. Si el convenio exige servidores en Colombia, la ruta es el
  despliegue autoalojado (`deploy/docker-compose.yml`), que sigue soportado.

---

## Para quien programa

- `src/backendClient.js` elige el backend por variables de entorno: Neon
  (`VITE_NEON_AUTH_URL` + `VITE_NEON_DATA_API_URL`) → Supabase
  (`VITE_SUPABASE_*`) → modo local de desarrollo. El resto de la app usa la misma API
  (`backend.auth.*`, `backend.from()`), vía `@neondatabase/neon-js` con
  `SupabaseAuthAdapter`.
- `neon/instalacion_neon.sql` se **genera** con `npm run gen:neon` a partir de
  `supabase/migrations/` (001 en adelante) + `supabase/seed.sql` +
  `neon/fragmentos/`. Las migraciones nuevas se escriben una sola vez en
  `supabase/migrations/` y se regenera.
- Adaptaciones a Neon: `auth.uid()` → `auth.user_id()` (pg_session_jwt), RLS
  habilitada sin `FORCE` (no depende de que el dueño de la base tenga BYPASSRLS),
  sin bucket de Storage, permisos explícitos para los roles
  `authenticated`/`anonymous` de la Data API.
- `src/__tests/neonDatabase.pg.test.js` ejecuta el script completo en un
  PostgreSQL real (PGlite + PostGIS) imitando la Data API, y verifica
  aislamiento por tenant, auto-promoción bloqueada, bitácora append-only,
  separación de funciones y suspensión.
