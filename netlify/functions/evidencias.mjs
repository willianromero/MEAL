// Almacén de fotos de evidencia cuando el backend es Neon (Neon no tiene
// almacén de objetos). Guarda en Netlify Blobs con la MISMA regla que tenía el
// bucket "evidencias" de Supabase (supabase/migrations/002_rls.sql):
//   - ruta  <tenant_id>/<registro_id>/<evidencia_id>.jpg
//   - subir: tener rol de escritura en ESE tenant (gestor … admin_tenant)
//   - ver:   ser miembro activo de ESE tenant
//   - inmutable (principio 6.3-5): la primera subida gana; nunca se
//     sobrescribe ni se borra.
//
// La función no guarda ningún secreto: reenvía el JWT del usuario a la Data
// API de Neon, que lo valida contra Neon Auth y evalúa has_tenant_role() /
// is_member_of() bajo RLS, igual que cualquier otra consulta de la app.
import { getStore } from '@netlify/blobs';

export const config = { path: '/api/evidencias' };

const WRITE_ROLES = ['gestor', 'coordinador', 'director', 'admin_fin', 'admin_tenant'];
const ID = '[A-Za-z0-9_-]{1,64}';
const PATH_RE = new RegExp(`^(${ID})/(${ID})/(${ID})\\.jpg$`);
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
// Las Netlify Functions aceptan ~6 MB por petición; las fotos ya llegan
// comprimidas desde el dispositivo (src/lib/evidence.js).
const MAX_BYTES = 5 * 1024 * 1024;

export default async function handler(req) {
  const dataApiUrl = dataApiBase(process.env.VITE_NEON_DATA_API_URL || process.env.NEON_DATA_API_URL);
  if (!dataApiUrl) return reply(500, 'Falta VITE_NEON_DATA_API_URL en las variables de entorno de Netlify.');

  const path = new URL(req.url).searchParams.get('path') || '';
  const match = PATH_RE.exec(path);
  if (!match) return reply(400, 'Ruta de evidencia inválida.');
  const tenantId = match[1];

  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return reply(401, 'Falta la sesión.');

  const store = getStore({ name: 'evidencias', consistency: 'strong' });

  if (req.method === 'POST') {
    if (!(await serverSays(dataApiUrl, token, 'has_tenant_role', { t: tenantId, roles: WRITE_ROLES }))) {
      return reply(403, 'Sin permiso para subir evidencias a este proyecto.');
    }
    const contentType = (req.headers.get('content-type') || 'image/jpeg').split(';')[0].trim().toLowerCase();
    if (!ALLOWED_TYPES.has(contentType)) return reply(415, 'Tipo de archivo no permitido.');
    const body = await req.arrayBuffer();
    if (body.byteLength === 0) return reply(400, 'Archivo vacío.');
    if (body.byteLength > MAX_BYTES) return reply(413, 'Archivo demasiado grande.');

    // Reintentos del sync (misma ruta) son idempotentes y no pisan el original.
    if (await store.getMetadata(path)) return reply(200, 'Ya estaba guardada.', { path, existed: true });
    await store.set(path, body, {
      metadata: { contentType, bytes: body.byteLength, subidaEn: new Date().toISOString() }
    });
    return reply(201, 'Guardada.', { path });
  }

  if (req.method === 'GET') {
    if (!(await serverSays(dataApiUrl, token, 'is_member_of', { t: tenantId }))) {
      return reply(403, 'Sin permiso para ver evidencias de este proyecto.');
    }
    const entry = await store.getWithMetadata(path, { type: 'arrayBuffer' });
    if (!entry) return reply(404, 'Evidencia no encontrada.');
    return new Response(entry.data, {
      headers: {
        'Content-Type': entry.metadata?.contentType || 'image/jpeg',
        'Cache-Control': 'private, max-age=3600'
      }
    });
  }

  return reply(405, 'Método no permitido.');
}

// Pregunta a la Data API (como el usuario) por una función booleana de 002/005.
// Un JWT inválido o vencido hace que la Data API responda 401 → se niega.
async function serverSays(dataApiUrl, token, fn, args) {
  try {
    const res = await fetch(`${dataApiUrl}/rpc/${fn}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(args)
    });
    if (!res.ok) return false;
    return (await res.json()) === true;
  } catch {
    return false;
  }
}

function dataApiBase(url) {
  const clean = (url || '').trim().replace(/\/+$/, '');
  if (!clean) return '';
  return clean.endsWith('/rest/v1') ? clean : `${clean}/rest/v1`;
}

function reply(status, mensaje, extra = {}) {
  return Response.json({ mensaje, ...extra }, { status });
}
