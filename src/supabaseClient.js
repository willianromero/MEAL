import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey && supabaseUrl !== 'TU_SUPABASE_URL_AQUI');

// Si no está configurado, creamos un cliente simulado para posibilitar el desarrollo local sin bloqueos.
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createMockSupabase();

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
