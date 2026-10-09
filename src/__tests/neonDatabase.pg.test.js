// @vitest-environment node
//
// Gate 13.2-2 contra un PostgreSQL REAL (PGlite + PostGIS, en memoria):
// ejecuta neon/instalacion_neon.sql tal como lo hará el usuario en el SQL
// Editor de Neon y luego actúa como la Data API (rol `authenticated` + claim
// `sub` del JWT) para comprobar el aislamiento por tenant y las reglas del
// servidor. El entorno imita a Neon en lo que importa:
//   - el script corre como dueño de la base (neondb_owner), SIN superusuario
//     ni BYPASSRLS (peor caso: si Neon se lo diera, todo seguiría valiendo);
//   - existen los roles authenticated/anonymous y auth.user_id(), que en Neon
//     crea la Data API (pg_session_jwt);
//   - las cuentas viven en neon_auth."user" (Neon Auth / Better Auth).
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { postgis } from '@electric-sql/pglite-postgis';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { buildNeonSql } from '../../scripts/genNeonSql.mjs';
import { readFileSync } from 'node:fs';

const USERS = {
  admin: '11111111-1111-4111-8111-111111111111',   // platform_admin
  gestorHocol: '22222222-2222-4222-8222-222222222222',
  coordHocol: '33333333-3333-4333-8333-333333333333',
  gestorOtro: '44444444-4444-4444-8444-444444444444',
  intruso: '55555555-5555-4555-8555-555555555555'    // se registró solo, sin membresía
};

let pg;

// Ejecuta `fn` como lo haría la Data API para el usuario `sub` (o anónimo).
async function asUser(sub, fn) {
  const role = sub ? 'authenticated' : 'anonymous';
  await pg.exec(`set role ${role}`);
  await pg.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify(sub ? { sub } : {})]);
  try {
    return await fn();
  } finally {
    await pg.exec('reset role');
    await pg.query(`select set_config('request.jwt.claims', '{}', false)`);
  }
}
const rows = async (sql, params) => (await pg.query(sql, params)).rows;
const asOwner = async (fn) => {
  await pg.exec('set role neondb_owner');
  try { return await fn(); } finally { await pg.exec('reset role'); }
};

describe('Neon: instalacion_neon.sql sobre PostgreSQL real', () => {
  beforeAll(async () => {
    pg = await PGlite.create({ extensions: { postgis, pgcrypto } });
    // --- Lo que Neon trae de fábrica al habilitar Data API + Neon Auth ---
    await pg.exec(`
      create role neondb_owner nosuperuser nobypassrls createrole;
      grant create on database postgres to neondb_owner;
      grant all on schema public to neondb_owner;
      alter schema public owner to neondb_owner;
      create role authenticated nologin;
      create role anonymous nologin;
      create schema auth;
      create function auth.user_id() returns text language sql stable as
        $$ select nullif(current_setting('request.jwt.claims', true)::json->>'sub', '') $$;
      grant usage on schema auth to public;
      create schema neon_auth;
      create table neon_auth."user" (id uuid primary key, email text not null, name text);
      grant usage on schema neon_auth to neondb_owner;
      grant select on neon_auth."user" to neondb_owner;
    `);
    // PostGIS no es "trusted": en Neon la instala el dueño; aquí se precarga
    // como superusuario y se cede, para que el script la encuentre lista.
    await pg.exec(`create extension postgis; create extension pgcrypto;
                   alter table public.spatial_ref_sys owner to neondb_owner;`);
    await pg.exec(`insert into neon_auth."user" (id, email) values
      ('${USERS.admin}', 'admin@fundacionguajiracompetitiva.org'),
      ('${USERS.gestorHocol}', 'gestor.hocol@ejemplo.org'),
      ('${USERS.coordHocol}', 'coord.hocol@ejemplo.org'),
      ('${USERS.gestorOtro}', 'gestor.otro@ejemplo.org'),
      ('${USERS.intruso}', 'intruso@ejemplo.org');`);

    // --- El usuario pega el script en el SQL Editor (dueño de la base) ---
    await asOwner(() => pg.exec(buildNeonSql()));

    // Producción tiene un único proyecto (Hocol); para demostrar el aislamiento
    // se agrega aquí un segundo tenant mínimo, solo en esta base de prueba.
    await asOwner(() => pg.exec(`
      insert into public.tenants (id, nombre) values ('ten-prueba', 'Proyecto de prueba');
      insert into public.program_lines (id, tenant_id, codigo, nombre) values ('line-prueba-1', 'ten-prueba', 'LP', 'Línea de prueba');
      insert into public.units (id, tenant_id, nombre) values ('unit-prueba-1', 'ten-prueba', 'U1'), ('unit-prueba-2', 'ten-prueba', 'U2');
      insert into public.forms (id, tenant_id, codigo, nombre) values ('frm-prueba-1', 'ten-prueba', 'F-P1', 'Formulario de prueba');
    `));

    // --- Alta de usuarios por correo, como indica la guía ---
    await asOwner(() => pg.exec(`
      select public.meal_asignar_usuario('admin@fundacionguajiracompetitiva.org', 'ten-hocol', 'admin_tenant', 'platform_admin');
      select public.meal_asignar_usuario('GESTOR.HOCOL@ejemplo.org', 'ten-hocol', 'gestor');
      select public.meal_asignar_usuario('coord.hocol@ejemplo.org', 'ten-hocol', 'coordinador');
      select public.meal_asignar_usuario('gestor.otro@ejemplo.org', 'ten-prueba', 'gestor');
    `));
  }, 120000);

  it('el archivo generado está al día con las migraciones y el seed', () => {
    const onDisk = readFileSync('neon/instalacion_neon.sql', 'utf8').replace(/\r\n/g, '\n');
    expect(onDisk).toBe(buildNeonSql());
  });

  it('es idempotente: se puede volver a ejecutar completo sin error', async () => {
    await asOwner(() => pg.exec(buildNeonSql()));
    const [{ n }] = await rows(`select count(*)::int n from public.tenants where id = 'ten-hocol'`);
    expect(n).toBe(1);
  });

  it('siembra solo el convenio Hocol (Anexo E), sin datos operativos', async () => {
    const seeded = await rows(`select id from public.tenants where id <> 'ten-prueba' order by id`);
    expect(seeded.map((r) => r.id)).toEqual(['ten-hocol']);
    const [c] = await rows(`select
      (select count(*)::int from public.units where tenant_id = 'ten-hocol') units,
      (select count(*)::int from public.indicators where tenant_id = 'ten-hocol') indicators,
      (select count(*)::int from public.forms where tenant_id = 'ten-hocol') forms,
      (select count(*)::int from public.feedbacks) pqrs,
      (select count(*)::int from public.lessons_learned) lecciones`);
    expect(c).toEqual({ units: 36, indicators: 44, forms: 9, pqrs: 0, lecciones: 0 });
  });

  it('cada usuario ve SOLO los tenants de los que es miembro', async () => {
    const hocol = await asUser(USERS.gestorHocol, () => rows('select id from public.tenants'));
    expect(hocol.map((r) => r.id)).toEqual(['ten-hocol']);
    const otro = await asUser(USERS.gestorOtro, () => rows('select tenant_id from public.units'));
    expect(new Set(otro.map((r) => r.tenant_id))).toEqual(new Set(['ten-prueba']));
    const admin = await asUser(USERS.admin, () => rows('select id from public.tenants'));
    expect(admin).toHaveLength(2);
  });

  it('una cuenta registrada por su cuenta no ve nada y no puede auto-promoverse (007)', async () => {
    const seen = await asUser(USERS.intruso, () => rows('select id from public.units'));
    expect(seen).toHaveLength(0);
    await expect(asUser(USERS.intruso, () =>
      rows(`insert into public.profiles (id, email, role) values ($1, 'intruso@ejemplo.org', 'platform_admin')`, [USERS.intruso])
    )).rejects.toThrow(/row-level security/);
    // Sí puede crear su propio perfil básico (queda a la espera de que le asignen proyecto)
    await asUser(USERS.intruso, () =>
      rows(`insert into public.profiles (id, email, role) values ($1, 'intruso@ejemplo.org', 'user')`, [USERS.intruso]));
    await expect(asUser(USERS.intruso, () =>
      rows(`insert into public.memberships (id, usuario_id, tenant_id, rol) values ('m-x', $1, 'ten-hocol', 'admin_tenant')`, [USERS.intruso])
    )).rejects.toThrow(/row-level security/);
  });

  it('nadie de la app puede ejecutar la función de alta de usuarios', async () => {
    await expect(asUser(USERS.admin, () =>
      rows(`select public.meal_asignar_usuario('intruso@ejemplo.org', 'ten-hocol', 'admin_tenant', 'platform_admin')`)
    )).rejects.toThrow(/permission denied/);
  });

  it('sin sesión (anonymous) no se accede a ninguna tabla', async () => {
    await expect(asUser(null, () => rows('select id from public.tenants'))).rejects.toThrow(/permission denied/);
  });

  it('captura: el gestor escribe en su tenant y no en otro; la bitácora es append-only', async () => {
    const form = (await rows(`select id from public.forms where tenant_id = 'ten-hocol' limit 1`))[0].id;
    const insert = (sub, tenant, id) => asUser(sub, () => rows(
      `insert into public.field_records (id, tenant_id, formulario_id, autor_id, datos, capturado_at)
       values ($1, $2, $3, $4, '{"x":1}'::jsonb, now())`, [id, tenant, form, sub]));

    await insert(USERS.gestorHocol, 'ten-hocol', 'fr-1');
    await expect(insert(USERS.gestorOtro, 'ten-hocol', 'fr-2')).rejects.toThrow(/row-level security/);

    const audit = await asUser(USERS.gestorHocol, () =>
      rows(`select accion, actor_id from public.audit_log where entidad = 'field_records' and entidad_id = 'fr-1'`));
    expect(audit).toEqual([{ accion: 'INSERT', actor_id: USERS.gestorHocol }]);
    await expect(asUser(USERS.gestorHocol, () => rows('delete from public.audit_log'))).rejects.toThrow(/permission denied/);
  });

  it('validación: el autor no valida su propio dato; el coordinador sí (006)', async () => {
    const validate = (sub) => asUser(sub, () =>
      rows(`update public.field_records set estado_validacion = 'validado' where id = 'fr-1' returning validado_por`));
    await expect(validate(USERS.gestorHocol)).rejects.toThrow(/Separación de funciones/);
    const [r] = await validate(USERS.coordHocol);
    expect(r.validado_por).toBe(USERS.coordHocol);
  });

  it('suspender un tenant corta el acceso de sus miembros (005)', async () => {
    await asUser(USERS.admin, () => rows(`update public.tenants set estado = 'suspendido' where id = 'ten-prueba'`));
    const units = await asUser(USERS.gestorOtro, () => rows('select id from public.units'));
    expect(units).toHaveLength(0);
    const tenants = await asUser(USERS.gestorOtro, () => rows('select id, estado from public.tenants'));
    expect(tenants).toEqual([{ id: 'ten-prueba', estado: 'suspendido' }]); // sigue viendo que existe
    await asUser(USERS.admin, () => rows(`update public.tenants set estado = 'activo' where id = 'ten-prueba'`));
  });

  it('la regla de evidencias que usa la función de Netlify responde por tenant', async () => {
    const roles = ['gestor', 'coordinador', 'director', 'admin_fin', 'admin_tenant'];
    const can = (sub, t) => asUser(sub, () =>
      rows('select public.has_tenant_role($1, $2) ok', [t, roles])).then((r) => r[0].ok);
    expect(await can(USERS.gestorHocol, 'ten-hocol')).toBe(true);
    expect(await can(USERS.gestorHocol, 'ten-prueba')).toBe(false);
    expect(await can(USERS.intruso, 'ten-hocol')).toBe(false);
  });
});
