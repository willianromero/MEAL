import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient as createNeonClient, SupabaseAuthAdapter } from '@neondatabase/neon-js';

// Cliente del servidor central. Toda la app le habla con la API de supabase-js
// (auth.* y from()); cuál backend hay detrás se decide por variables de entorno
// al compilar, sin tocar el resto del código:
//   1. Neon (Data API + Neon Auth):  VITE_NEON_AUTH_URL + VITE_NEON_DATA_API_URL
//   2. Supabase (respaldo / autoalojado): VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
//   3. Ninguno: modo demo local con un cliente simulado.
// Lo que NO es igual entre backends (fotos de evidencia y cambio de
// contraseña) está encapsulado abajo en uploadEvidence() y changePassword().
const env = import.meta.env;
const neonAuthUrl = trimSlash(env.VITE_NEON_AUTH_URL);
const neonDataApiUrl = withRestPath(trimSlash(env.VITE_NEON_DATA_API_URL));
const supabaseUrl = env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || '';

export const backendKind =
  neonAuthUrl && neonDataApiUrl ? 'neon'
  : supabaseUrl && supabaseAnonKey && supabaseUrl !== 'TU_SUPABASE_URL_AQUI' ? 'supabase'
  : 'mock';

export const isBackendConfigured = backendKind !== 'mock';
export const backendLabel = { neon: 'Neon', supabase: 'Supabase', mock: 'Demo local' }[backendKind];

export const backend =
  backendKind === 'neon'
    ? createNeonClient({
        auth: { adapter: SupabaseAuthAdapter(), url: neonAuthUrl },
        dataApi: { url: neonDataApiUrl }
      })
    : backendKind === 'supabase'
      ? createSupabaseClient(supabaseUrl, supabaseAnonKey)
      : createMockSupabase();

// Ruta de la función de Netlify que guarda las fotos cuando el backend es Neon
// (Neon no tiene almacén de objetos). Ver netlify/functions/evidencias.mjs.
export const EVIDENCE_ENDPOINT = '/api/evidencias';

function trimSlash(url) {
  return (url || '').trim().replace(/\/+$/, '');
}

// La consola de Neon muestra la URL de la Data API con o sin "/rest/v1".
function withRestPath(url) {
  if (!url) return '';
  return url.endsWith('/rest/v1') ? url : `${url}/rest/v1`;
}

export async function getAccessToken() {
  const { data } = await backend.auth.getSession();
  return data?.session?.access_token || null;
}

export async function hasActiveSession() {
  if (!isBackendConfigured) return true; // el modo demo no tiene sesión de servidor
  try {
    return !!(await getAccessToken());
  } catch {
    return false;
  }
}

// Sube el binario de una evidencia. `path` = <tenant_id>/<registro_id>/<id>.jpg
// (la primera carpeta es el tenant: el servidor exige pertenecer a él).
export async function uploadEvidence(path, blob, contentType) {
  if (backendKind === 'supabase') {
    const { error } = await backend.storage.from('evidencias').upload(path, blob, { contentType, upsert: true });
    if (error) throw new Error(error.message);
    return;
  }
  if (backendKind === 'neon') {
    const token = await getAccessToken();
    if (!token) throw new Error('Sin sesión activa para subir la evidencia');
    const res = await fetch(`${EVIDENCE_ENDPOINT}?path=${encodeURIComponent(path)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType },
      body: blob
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text().catch(() => '')}`.trim());
  }
  // modo demo: no hay almacén remoto
}

// Neon Auth (Better Auth) exige la contraseña actual; Supabase no la pide.
export async function changePassword({ currentPassword, newPassword }) {
  if (backendKind === 'neon') {
    const { error } = await backend.auth.getBetterAuthInstance().changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: false
    });
    if (error) throw new Error(friendlyAuthError(error));
    return;
  }
  const { error } = await backend.auth.updateUser({ password: newPassword });
  if (error) throw new Error(friendlyAuthError(error));
}

// Los servicios de autenticación responden en inglés; se traducen los casos
// que un usuario de campo realmente ve.
export function friendlyAuthError(error) {
  const msg = (error && (error.message || error.code)) || String(error || '');
  if (/invalid (email or password|login credentials)|INVALID_EMAIL_OR_PASSWORD/i.test(msg)) return 'Correo o contraseña incorrectos.';
  if (/INVALID_PASSWORD|invalid password/i.test(msg)) return 'La contraseña actual no es correcta.';
  if (/already exists|already registered|USER_ALREADY_EXISTS/i.test(msg)) return 'Ya existe una cuenta con ese correo. Inicia sesión.';
  if (/password.*(short|least)|PASSWORD_TOO_SHORT/i.test(msg)) return 'La contraseña es demasiado corta (mínimo 8 caracteres).';
  if (/failed to fetch|network/i.test(msg)) return 'No hay conexión con el servidor. Intenta de nuevo con señal.';
  return msg || 'Error de autenticación.';
}

function createMockSupabase() {
  console.warn(
    'Supabase no está configurado o contiene valores por defecto en variables de entorno. Se ha activado la simulación local.'
  );

  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      signInWithPassword: async ({ email, password }) => {
        // Roles por correo electrónico ficticio para la simulación
        let role = 'officer';
        if (email.startsWith('admin')) role = 'admin';
        if (email.startsWith('viewer')) role = 'viewer';

        const mockUser = {
          id: 'mock-user-uuid-1111-2222',
          email: email,
          user_metadata: { role: role }
        };

        return {
          data: {
            user: mockUser,
            session: {
              access_token: 'mock-access-token-xyz',
              user: mockUser
            }
          },
          error: null
        };
      },
      signUp: async ({ email, password, options }) => {
        const role = options?.data?.role || 'officer';
        const mockUser = {
          id: 'mock-user-uuid-' + Math.random().toString(36).substr(2, 9),
          email: email,
          user_metadata: { role }
        };
        return {
          data: { user: mockUser, session: { access_token: 'mock-token' } },
          error: null
        };
      },
      signOut: async () => ({ error: null }),
      onAuthStateChange: (callback) => {
        // En una simulación no notificamos cambios reactivos de auth automáticos
        return { data: { subscription: { unsubscribe: () => {} } } };
      }
    },
    // Simula una base de datos PostgreSQL remota.
    // Para que la simulación sea realista, podemos mantener un almacén temporal en memoria si lo deseamos,
    // pero para simular el sync engine bastará con simular retornos vacíos o exitosos.
    from: (table) => {
      return {
        select: (columns) => {
          const chain = {
            eq: (col, val) => {
              const chain2 = {
                order: (orderCol, { ascending } = {}) => {
                  return Promise.resolve({ data: [], error: null });
                },
                then: (cb) => cb({ data: [], error: null })
              };
              return chain2;
            },
            gt: (col, val) => Promise.resolve({ data: [], error: null }),
            order: (col, { ascending } = {}) => Promise.resolve({ data: [], error: null }),
            then: (cb) => cb({ data: [], error: null })
          };
          return chain;
        },
        upsert: (records) => {
          console.log(`[Mock Supabase] UPSERT en tabla "${table}":`, records);
          return Promise.resolve({ data: records, error: null });
        },
        insert: (records) => {
          console.log(`[Mock Supabase] INSERT en tabla "${table}":`, records);
          return Promise.resolve({ data: records, error: null });
        },
        update: (fields) => {
          return {
            eq: (col, val) => {
              console.log(`[Mock Supabase] UPDATE en tabla "${table}" set`, fields, `donde ${col} = ${val}`);
              return Promise.resolve({ data: fields, error: null });
            }
          };
        },
        delete: () => {
          return {
            eq: (col, val) => {
              console.log(`[Mock Supabase] DELETE en tabla "${table}" donde ${col} = ${val}`);
              return Promise.resolve({ error: null });
            }
          };
        }
      };
    }
  };
}
