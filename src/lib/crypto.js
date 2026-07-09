// ============================================================================
// Cifrado de campos sensibles en cliente (DRT M12, 11.2, 8.6).
// AES-GCM sobre los datos personales de beneficiarios ANTES de sincronizar, de
// modo que el servidor y otros tenants nunca ven el dato en claro.
//
// NOTA DE PRODUCCIÓN: la clave se deriva de una frase por tenant. En despliegue
// real esa frase debe provenir de un KMS / secreto gestionado, no del cliente.
// Aquí se deriva de forma determinista por tenant para habilitar la operación
// offline; el mecanismo (PBKDF2 + AES-GCM) es el definitivo.
// ============================================================================

const keyCache = new Map();
const enc = new TextEncoder();
const dec = new TextDecoder();

async function getKey(tenantId) {
  if (keyCache.has(tenantId)) return keyCache.get(tenantId);
  const material = await globalThis.crypto.subtle.importKey(
    'raw', enc.encode(`meal-habeas-data:${tenantId}`), 'PBKDF2', false, ['deriveKey']
  );
  const key = await globalThis.crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode(`salt:${tenantId}`), iterations: 100000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  keyCache.set(tenantId, key);
  return key;
}

function toB64(bytes) {
  let s = '';
  bytes.forEach(b => { s += String.fromCharCode(b); });
  return btoa(s);
}
function fromB64(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

// Cifra un texto → base64(iv[12] + ciphertext). Devuelve null si no hay texto.
export async function encryptField(text, tenantId) {
  if (text == null || text === '') return null;
  const key = await getKey(tenantId);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, enc.encode(String(text))
  ));
  const packed = new Uint8Array(iv.length + ct.length);
  packed.set(iv, 0); packed.set(ct, iv.length);
  return toB64(packed);
}

// Descifra base64(iv + ciphertext) → texto. Devuelve '' ante error/entrada nula.
export async function decryptField(packedB64, tenantId) {
  if (!packedB64) return '';
  try {
    const key = await getKey(tenantId);
    const packed = fromB64(packedB64);
    const iv = packed.slice(0, 12);
    const ct = packed.slice(12);
    const pt = await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return dec.decode(pt);
  } catch {
    return '';
  }
}

// Hash SHA-256 de un documento para deduplicación sin exponer el dato (7.2).
export async function documentHash(documento, tenantId) {
  if (!documento) return null;
  const buf = await globalThis.crypto.subtle.digest('SHA-256', enc.encode(`${tenantId}:${documento}`));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
