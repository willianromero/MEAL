# Backend en Neon

| Archivo | Qué es |
|---|---|
| `instalacion_neon.sql` | **Generado** (`npm run gen:neon`). Base completa para pegar en el SQL Editor de Neon: migraciones `supabase/migrations/001…` adaptadas + permisos de la Data API + alta de usuarios por correo + seed de los 3 tenants. Idempotente. |
| `fragmentos/00_prerequisitos.sql` | Detiene el script con un mensaje claro si la Data API con Neon Auth aún no está habilitada. |
| `fragmentos/90_permisos_neon.sql` | GRANTs para los roles `authenticated`/`anonymous` de la Data API; bitácora append-only. |
| `fragmentos/95_asignar_usuario.sql` | `meal_asignar_usuario(correo, tenant, rol, rol_plataforma)`: solo ejecutable por el dueño de la base. |

Guía completa para ponerlo en marcha: [`docs/MIGRACION_NEON.md`](../docs/MIGRACION_NEON.md).

No edites `instalacion_neon.sql` a mano: escribe la migración nueva en
`supabase/migrations/` (o el fragmento en `neon/fragmentos/`) y regenera.
La prueba `src/__tests/neonDatabase.pg.test.js` falla si el archivo quedó
desactualizado.
