// @vitest-environment node
//
// Función de Netlify que guarda las fotos de evidencia con backend Neon.
// Debe reproducir la regla del bucket "evidencias" de Supabase: subir solo
// con rol de escritura en el tenant de la ruta, ver solo siendo miembro, y
// nunca sobrescribir una evidencia ya guardada (inmutabilidad, 6.3-5).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const blobs = new Map();
vi.mock('@netlify/blobs', () => ({
  getStore: () => ({
    getMetadata: async (key) => (blobs.has(key) ? { metadata: blobs.get(key).metadata } : null),
    set: async (key, data, { metadata }) => { blobs.set(key, { data, metadata }); },
    getWithMetadata: async (key) => (blobs.has(key) ? blobs.get(key) : null)
  })
}));

const { default: handler } = await import('../../netlify/functions/evidencias.mjs');

const DATA_API = 'https://ep-x.apirest.c-2.us-east-2.aws.neon.tech/neondb/rest/v1';
const PATH = 'ten-hocol/0f8e2a1c-1111-4111-8111-aaaaaaaaaaaa/ev-1.jpg';

// Simula la Data API: responde a has_tenant_role / is_member_of según `grants`.
function mockDataApi(grants) {
  globalThis.fetch = vi.fn(async (url, init) => {
    const fn = url.split('/rpc/')[1];
    const auth = init.headers.Authorization;
    if (auth !== 'Bearer jwt-valido') return new Response('{"message":"JWT invalid"}', { status: 401 });
    const args = JSON.parse(init.body);
    return Response.json(Boolean(grants[fn]?.includes(args.t)));
  });
}

const request = (method, { path = PATH, token = 'jwt-valido', body, type = 'image/jpeg' } = {}) =>
  new Request(`https://mealguajira.netlify.app/api/evidencias?path=${encodeURIComponent(path)}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': type },
    body
  });

describe('netlify/functions/evidencias', () => {
  beforeEach(() => {
    blobs.clear();
    process.env.VITE_NEON_DATA_API_URL = DATA_API;
  });

  it('guarda la foto si el usuario tiene rol de escritura en ese tenant', async () => {
    mockDataApi({ has_tenant_role: ['ten-hocol'] });
    const res = await handler(request('POST', { body: new Uint8Array([1, 2, 3]) }));
    expect(res.status).toBe(201);
    expect(blobs.get(PATH).metadata).toMatchObject({ contentType: 'image/jpeg', bytes: 3 });
    // La autorización se pidió a la Data API con el JWT del usuario y el tenant de la ruta
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toBe(`${DATA_API}/rpc/has_tenant_role`);
    expect(JSON.parse(init.body)).toEqual({ t: 'ten-hocol', roles: ['gestor', 'coordinador', 'director', 'admin_fin', 'admin_tenant'] });
  });

  it('rechaza subir a un tenant ajeno, sin sesión o con JWT inválido', async () => {
    mockDataApi({ has_tenant_role: ['ten-otro'] });
    expect((await handler(request('POST', { body: new Uint8Array([1]) }))).status).toBe(403);
    expect((await handler(request('POST', { body: new Uint8Array([1]), token: null }))).status).toBe(401);
    expect((await handler(request('POST', { body: new Uint8Array([1]), token: 'jwt-falso' }))).status).toBe(403);
    expect(blobs.size).toBe(0);
  });

  it('es inmutable: un reintento no sobrescribe la evidencia original', async () => {
    mockDataApi({ has_tenant_role: ['ten-hocol'] });
    await handler(request('POST', { body: new Uint8Array([1, 2, 3]) }));
    const res = await handler(request('POST', { body: new Uint8Array([9]) }));
    expect(res.status).toBe(200);
    expect((await res.json()).existed).toBe(true);
    expect(new Uint8Array(blobs.get(PATH).data)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('valida la ruta y el tipo de archivo', async () => {
    mockDataApi({ has_tenant_role: ['ten-hocol'] });
    expect((await handler(request('POST', { path: '../ten-hocol/x.jpg', body: new Uint8Array([1]) }))).status).toBe(400);
    expect((await handler(request('POST', { path: 'ten-hocol/x.jpg', body: new Uint8Array([1]) }))).status).toBe(400);
    expect((await handler(request('POST', { body: new Uint8Array([1]), type: 'text/html' }))).status).toBe(415);
  });

  it('solo los miembros del tenant pueden ver la foto', async () => {
    mockDataApi({ has_tenant_role: ['ten-hocol'], is_member_of: ['ten-hocol'] });
    await handler(request('POST', { body: new Uint8Array([7, 7]) }));
    const ok = await handler(request('GET'));
    expect(ok.status).toBe(200);
    expect(new Uint8Array(await ok.arrayBuffer())).toEqual(new Uint8Array([7, 7]));

    mockDataApi({ is_member_of: ['ten-otro'] });
    expect((await handler(request('GET'))).status).toBe(403);
  });

  it('explica el problema si falta la URL de la Data API en Netlify', async () => {
    delete process.env.VITE_NEON_DATA_API_URL;
    const res = await handler(request('POST', { body: new Uint8Array([1]) }));
    expect(res.status).toBe(500);
    expect((await res.json()).mensaje).toMatch(/VITE_NEON_DATA_API_URL/);
  });
});
