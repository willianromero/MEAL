# Puesta en marcha — Guía paso a paso (a prueba de errores)

Esta guía es para **ti** (no requiere programar). Cubre todo lo que falta para
llevar la Plataforma MEAL a producción: aplicar la base de datos, crear el
primer usuario, conectar la app y probarla.

> Sigue los pasos **en orden**. Si algo no sale como dice el paso, **detente** y
> no avances: casi siempre es el orden o un dato mal copiado.

Tiempo estimado total: 45–60 minutos la primera vez.

---

## PARTE A — Lo que necesitas tener a mano

Antes de empezar, consigue estos 3 accesos y anótalos:

1. **Cuenta de Supabase** con acceso al proyecto (https://supabase.com → inicia sesión).
   - Si aún no tienes proyecto: botón **New project**, elige región **South America (São Paulo)** (la más cercana a Colombia), ponle nombre "meal-produccion" y una contraseña de base de datos (guárdala).
2. La carpeta del proyecto en tu PC: **`D:\MEAL`**.
3. El archivo **`D:\MEAL\.env`** (lo crearemos/editaremos en la Parte E).

Ten abierto el **Explorador de archivos de Windows** en `D:\MEAL\supabase\migrations\`.
Verás 7 archivos:
- `000_reset.sql`  ← solo si tu Supabase ya tenía tablas de una versión anterior
- `001_schema.sql`
- `002_rls.sql`
- `003_audit_triggers.sql`
- `004_config_edit.sql`  ← habilita editar/archivar/eliminar configuración desde la app
- `005_tenant_suspend.sql`  ← hace que "Suspender" un proyecto bloquee de verdad el acceso
- `006_security_hardening.sql`  ← cierra 3 brechas de permisos encontradas en auditoría general
- `007_postgis_rls_advisor.sql`  ← cierra el aviso "RLS Disabled in Public" del Security Advisor de Supabase

> **Nota:** si ya tenías la base montada de antes, basta con aplicar los nuevos
> `006_security_hardening.sql` y `007_postgis_rls_advisor.sql` (SQL Editor →
> pegar → Run, uno tras otro). El 006 cierra: (1) el borrado definitivo de
> configuración, que un Coordinador podía ejecutar vía API aunque la app no se
> lo mostrara; (2) la validación de registros de campo, que no exigía rol de
> Coordinador/Administrador para validar el dato de otra persona (solo
> bloqueaba auto-validarse); (3) la edición directa de la fila de un proyecto
> en `tenants`, que un Administrador de Tenant podía hacer vía API sin que
> ninguna pantalla se lo permitiera. El 007 activa RLS de solo lectura sobre
> `spatial_ref_sys` (tabla de catálogo de PostGIS, sin datos propios) para que
> el Advisor de Supabase deje de marcarla como error. Ambos son idempotentes.

---

## PARTE B — Crear las tablas en Supabase (aplicar las migraciones)

Esto crea toda la estructura de la base de datos. Se hace **desde el navegador**,
sin instalar nada.

### B.1 — Abrir el editor SQL
1. Entra a https://supabase.com y abre tu proyecto **meal-produccion**.
2. En el menú de la izquierda, clic en **SQL Editor** (icono `</>`).
3. Clic en **+ New query** (arriba).

### B.1-bis — Limpiar tablas viejas (SOLO si te dio el error de "incompatible types")
> Si tu Supabase ya tenía una versión anterior de la app, primero hay que borrar
> esas tablas viejas. **Solo hazlo en una instalación nueva / de pruebas**
> (borra datos de esas tablas).
1. Abre `000_reset.sql` con Bloc de notas, copia **todo** (`Ctrl+A`, `Ctrl+C`).
2. Pégalo en el SQL Editor y clic en **Run**.
3. **Resultado esperado:** "Success. No rows returned".
4. Ahora sí, continúa con B.2.

### B.2 — Aplicar el archivo 001 (el esquema)
1. En tu PC, abre `001_schema.sql` con el **Bloc de notas** (clic derecho → Abrir con → Bloc de notas).
2. Selecciona **TODO** el texto (`Ctrl+A`) y cópialo (`Ctrl+C`).
3. Vuelve al SQL Editor de Supabase, haz clic en el área de texto y **pega** (`Ctrl+V`).
4. Clic en **Run** (botón verde abajo a la derecha, o `Ctrl+Enter`).
5. **Resultado esperado:** abajo aparece **"Success. No rows returned"**.
   - Si aparece un error en rojo, **no continúes**: cópiame el texto del error.

### B.3 — Aplicar el archivo 002 (la seguridad / aislamiento)
1. Borra el texto anterior del editor (`Ctrl+A` y `Supr`).
2. Abre `002_rls.sql`, copia todo (`Ctrl+A`, `Ctrl+C`), pégalo en el editor.
3. Clic en **Run**.
4. **Resultado esperado:** "Success. No rows returned".

### B.4 — Aplicar el archivo 003 (las reglas automáticas)
1. Borra el texto del editor.
2. Abre `003_audit_triggers.sql`, copia todo, pégalo, **Run**.
3. **Resultado esperado:** "Success. No rows returned".

> **Importante:** siempre en este orden: 001 → 002 → 003. Si te equivocas de
> orden dará error; simplemente vuelve a correr el que falte en el orden correcto.

### B.5 — Comprobar que quedó bien
1. Menú izquierdo → **Table Editor**.
2. Deberías ver la lista de tablas: `tenants`, `units`, `indicators`,
   `field_records`, `feedbacks`, `audit_log`, etc. Si están, la base quedó lista.
3. Menú izquierdo → **Storage**. Debe existir un bucket llamado **`evidencias`**.

---

## PARTE C — Cargar la configuración del primer proyecto (tenant Hocol)

Las tablas están vacías. Hay que cargar la configuración del convenio Hocol
(36 comunidades, 44 indicadores, 9 formularios del Anexo E) y los otros dos
proyectos de ejemplo.

> **Este archivo SQL te lo genero yo** a partir de la configuración ya escrita
> en el código (`src/seeds/`). Pídemelo con: *"genérame el seed SQL"* y crearé
> `supabase/seed.sql`. Luego:
>
> 1. Ábrelo con Bloc de notas, copia todo.
> 2. SQL Editor → New query → pega → **Run**.
> 3. Verifica en **Table Editor → tenants**: deben aparecer 3 filas
>    (Hocol, Clínica Maicao, Guardianes del Mar Wayuu).

*(Alternativa sin este paso: la app también siembra esta configuración
localmente en cada dispositivo la primera vez que se abre, así que puedes probar
sin el seed SQL. Pero para que la configuración sea la misma en todos los
dispositivos y quede respaldada en el servidor, conviene cargar el seed SQL.)*

---

## PARTE D — Crear tu primer usuario administrador

### D.1 — Crear el usuario de acceso
1. Menú izquierdo → **Authentication** → pestaña **Users**.
2. Botón **Add user** → **Create new user**.
3. Escribe un **correo** (ej. `admin@guajiracompetitiva.org`) y una **contraseña**.
4. **Marca la casilla "Auto Confirm User"** (para no tener que confirmar por email).
5. Clic en **Create user**.
6. En la lista, haz clic en el usuario recién creado y **copia su "User UID"**
   (un texto largo tipo `a1b2c3d4-...`). Lo necesitas en el siguiente paso.

### D.2 — Darle rol y permisos (SQL)
1. SQL Editor → New query.
2. Pega esto **reemplazando** `PEGA_AQUI_EL_UID` y el correo por los tuyos:

   ```sql
   -- Perfil del usuario (rol de plataforma = ve la Consola de Proyectos)
   insert into public.profiles (id, email, role)
   values ('PEGA_AQUI_EL_UID', 'admin@guajiracompetitiva.org', 'platform_admin');

   -- Además, darle rol dentro del proyecto Hocol como Administrador de Tenant
   insert into public.memberships (id, usuario_id, tenant_id, rol, activo)
   values (gen_random_uuid()::text, 'PEGA_AQUI_EL_UID', 'ten-hocol', 'admin_tenant', true);
   ```
3. Clic en **Run**. Debe decir "Success".

> Para crear más usuarios (gestores, coordinadores…): repite D.1, y en D.2 usa
> `role` = `'user'` en `profiles`, y en `memberships` el `rol` que corresponda:
> `gestor`, `coordinador`, `director`, `admin_fin`, `admin_tenant`, `financiador`
> o `auditor`. El `tenant_id` es `ten-hocol` (o el del proyecto que quieras).

---

## PARTE E — Conectar la aplicación con tu Supabase

### E.1 — Obtener las 2 llaves
1. En Supabase, menú izquierdo → **Project Settings** (engranaje) → **API**.
2. Copia dos valores:
   - **Project URL** (ej. `https://xxxxx.supabase.co`).
   - **anon public** (una clave larga bajo "Project API keys").

### E.2 — Poner las llaves en el archivo .env
1. En `D:\MEAL`, busca el archivo **`.env`**. Si no existe, créalo:
   clic derecho → Nuevo → Documento de texto → nómbralo exactamente `.env`
   (sin `.txt` al final).
2. Ábrelo con Bloc de notas y escribe (pegando tus valores):

   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...tu_clave_anon...
   ```
3. Guarda y cierra.

> Sin este archivo la app funciona en "modo demo" local. Con él, se conecta a tu
> base real y sincroniza.

---

## PARTE F — Probar que todo funciona (localmente)

1. Abre la app (si ya la tienes corriendo, ciérrala y vuelve a abrirla para que
   tome el nuevo `.env`).
   - Si trabajas con quien programa: `npm run dev` y abrir http://localhost:5173
2. En la pantalla de acceso, entra con el **correo y contraseña** que creaste en D.1.
3. Verifica:
   - Arriba aparece el selector de proyecto con **"Convenio Asociación Guajira (Ecopetrol–Hocol)"**.
   - En el menú lateral ves **Consola de Proyectos**, **Catálogo Maestro**, etc.
   - El indicador de sincronización arriba dice **ONLINE** y, al pasar unos
     segundos, **"Última Sincronización"** con fecha (ya no "Nunca").
4. **Prueba de humo:** ve a **Catálogo Maestro** → deben verse las 36 comunidades
   de Hocol; ve a **Indicadores MEAL** → deben verse los 44 indicadores.

Si el indicador de sincronización muestra error, revisa que las 2 llaves del
`.env` estén bien copiadas (sin espacios) y que aplicaste las 3 migraciones.

---

## PARTE G — Prueba de campo obligatoria (gate offline del DRT)

Esta es la prueba que el documento rector exige aprobar (jornada offline).

1. En un **celular Android** real, abre la app en el navegador Chrome.
2. Menú del navegador → **"Agregar a pantalla de inicio"** (la instala como app).
3. Inicia sesión estando con internet (para que baje catálogos y formularios).
4. **Activa el modo avión** (o usa el botón **"Simular Offline"** de la app).
5. Durante la jornada, captura registros en **Captura Offline**: llena
   formularios, toma fotos y captura el GPS. Haz **al menos 50** a lo largo del día.
6. Al final, **desactiva el modo avión** (recupera señal).
7. Abre la app y observa el indicador de sincronización: los pendientes deben
   bajar a **0** solos, sin errores.
8. **Criterio de aprobación:** el 100% de los registros llegó al servidor, sin
   duplicados ni pérdidas. (Puedes confirmarlo en Supabase → Table Editor →
   `field_records`, contando las filas.)

---

## PARTE H — Publicar la app para que otros la usen (opcional)

Cuando quieras que el equipo la use desde internet (no solo en tu PC):

**Opción sencilla (recomendada para empezar):** publicar en un hosting estático.
1. Genera la versión de producción: `npm run build` (crea la carpeta `dist/`).
2. Sube la carpeta `dist/` a un hosting como **Netlify** o **Vercel**
   (arrastrar y soltar la carpeta). Te dan una URL https lista.

**Opción servidor propio (con residencia en Colombia):** usa
`deploy/docker-compose.yml` (requiere a alguien técnico; instrucciones dentro del archivo).

---

## PARTE I — Respaldos (para no perder datos)

- Supabase Cloud ya hace respaldos automáticos (Project Settings → Database → Backups).
- Si usas servidor propio, el `deploy/docker-compose.yml` incluye un respaldo
  diario automático.
- **Recomendación mensual:** entra a la app como administrador → **Reportes y
  Export** → **Export total JSON**, y guarda ese archivo en un lugar seguro.
  Es tu copia de seguridad en formato abierto (no dependes de nadie).

---

## Resumen de "¿lo hice bien?"

| Paso | Cómo sé que quedó bien |
|---|---|
| B (migraciones) | En Table Editor aparecen las tablas y el bucket `evidencias` |
| C (seed) | En `tenants` hay 3 filas |
| D (usuario) | El SQL dice "Success" |
| E (.env) | El archivo tiene las 2 líneas con tus llaves |
| F (prueba) | Entras, ves Hocol y sincroniza (fecha, no "Nunca") |
| G (offline) | Los 50 registros llegan a `field_records` sin duplicados |

Si cualquier paso falla, cópiame el mensaje de error exacto y te digo qué hacer.
