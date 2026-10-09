// Generador de neon/instalacion_neon.sql: la base de datos completa para Neon
// en UN solo archivo (se pega en el SQL Editor de Neon y se ejecuta una vez).
//
// Fuente única de verdad: supabase/migrations/ (001 en adelante) y
// supabase/seed.sql. Este script solo los adapta a Neon (Data API + Neon Auth)
// y les agrega los fragmentos de neon/fragmentos/. Reejecutar cuando cambie
// una migración o la configuración sembrada:  node scripts/genNeonSql.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations');
const FRAGMENTS_DIR = join(ROOT, 'neon', 'fragmentos');
export const OUTPUT_FILE = join(ROOT, 'neon', 'instalacion_neon.sql');

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

// Sección del bucket de Supabase Storage (al final de 002). Neon no tiene
// almacén de objetos: las fotos van a Netlify Blobs vía
// netlify/functions/evidencias.mjs, que aplica la misma regla por tenant.
const STORAGE_SECTION =
  /-- -+\n-- Almacén de objetos[\s\S]*?-- Sin políticas de UPDATE\/DELETE: la evidencia es inmutable \(principio 6\.3-5\)\.\n?/;
const AUDIT_REVOKE = 'revoke update, delete on public.audit_log from authenticated, anon;';

// Adapta el SQL de una migración de Supabase a Neon. Falla en voz alta si la
// fuente cambió de forma que el adaptador ya no reconoce (mejor un error al
// generar que un script que se rompe en la consola del usuario).
export function adaptMigration(fileName, sql) {
  let out = sql;

  if (fileName.startsWith('002_')) {
    if (!STORAGE_SECTION.test(out)) throw new Error(`${fileName}: no se encontró la sección de Storage a retirar.`);
    out = out.replace(STORAGE_SECTION,
      '-- (Neon) Sin almacén de objetos en la base: las fotos de evidencia van a\n' +
      '-- Netlify Blobs (netlify/functions/evidencias.mjs), con la misma regla por tenant.\n');
    if (!out.includes(AUDIT_REVOKE)) throw new Error(`${fileName}: no se encontró el revoke de audit_log.`);
    out = out.replace(AUDIT_REVOKE, '-- (Neon) El revoke de audit_log está en la sección 90 (permisos de la Data API).');
  }

  // Identidad del usuario: en Neon la entrega pg_session_jwt (claim `sub` del JWT).
  out = out.replaceAll('auth.uid()::text', 'auth.user_id()');

  // RLS habilitada pero NO forzada sobre el dueño de la base, para no depender
  // de que el dueño tenga BYPASSRLS (Supabase y hoy Neon se lo dan; otro
  // Postgres o un cambio de plataforma podría no hacerlo, y con FORCE las
  // funciones SECURITY DEFINER —is_member_of…— y la carga del seed quedarían
  // sometidas a RLS). La app entra como `authenticated`: a ella RLS se le
  // aplica igual.
  out = out.replaceAll(
    "'alter table public.%I force row level security'",
    "'alter table public.%I no force row level security'");

  for (const leftover of ['storage.', 'auth.uid()', ' anon;', '%I force row level security']) {
    if (out.includes(leftover)) throw new Error(`${fileName}: quedó "${leftover}" sin adaptar a Neon.`);
  }
  return out;
}

export function buildNeonSql() {
  const migrations = readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{3}_.+\.sql$/.test(f) && !f.startsWith('000_')) // 000 = reset del prototipo v1
    .sort();
  const fragment = (name) => read(join(FRAGMENTS_DIR, name));

  const parts = [
    `-- ============================================================================
-- instalacion_neon.sql — Base de datos COMPLETA de la Plataforma MEAL para Neon
-- (GENERADO por scripts/genNeonSql.mjs. No editar a mano.)
--
-- Uso: Consola Neon -> SQL Editor -> pegar TODO este archivo -> Run.
-- Antes: habilitar la Data API con Neon Auth (docs/MIGRACION_NEON.md, Paso 2).
-- Es idempotente: se puede volver a ejecutar sin perder datos.
--
-- Contenido: prerrequisitos · migraciones ${migrations.map((f) => f.slice(0, 3)).join(', ')}
-- (adaptadas a Neon) · permisos de la Data API · alta de usuarios por correo ·
-- configuración sembrada de los tenants (seed).
-- ============================================================================
`,
    fragment('00_prerequisitos.sql'),
    ...migrations.map((f) =>
      `\n-- ############################################################################\n-- ## ${f}\n-- ############################################################################\n\n` +
      adaptMigration(f, read(join(MIGRATIONS_DIR, f)))),
    '\n' + fragment('90_permisos_neon.sql'),
    '\n' + fragment('95_asignar_usuario.sql'),
    `\n-- ############################################################################\n-- ## seed.sql (configuración inicial de los tenants)\n-- ############################################################################\n\n` +
      read(join(ROOT, 'supabase', 'seed.sql'))
  ];
  return parts.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(OUTPUT_FILE, buildNeonSql());
  console.log('neon/instalacion_neon.sql generado.');
}
