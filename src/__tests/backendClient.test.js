// Selección del backend por variables de entorno y las dos operaciones que
// difieren entre Neon y Supabase (fotos de evidencia y cambio de contraseña).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

async function loadWith(env) {
  vi.resetModules();
  vi.unstubAllEnvs();
  for (const k of ['VITE_NEON_AUTH_URL', 'VITE_NEON_DATA_API_URL', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']) {
    vi.stubEnv(k, env[k] || '');
  }
  return import('../backendClient');
}

const NEON = {
  VITE_NEON_AUTH_URL: 'https://ep-x.neonauth.c-2.us-east-2.aws.neon.tech/neondb/auth/',
  VITE_NEON_DATA_API_URL: 'https://ep-x.apirest.c-2.us-east-2.aws.neon.tech/neondb'
};
const SUPA = { VITE_SUPABASE_URL: 'https://abc.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon' };

// El cliente de Neon Auth consulta la sesión en segundo plano (también después
// de cada prueba): ninguna llamada debe salir a la red real.
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

describe('backendClient', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => new Response('{}', { status: 401 }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('usa Neon cuando están sus dos URLs (aunque también haya Supabase)', async () => {
    const m = await loadWith({ ...NEON, ...SUPA });
    expect(m.backendKind).toBe('neon');
    expect(m.backendLabel).toBe('Neon');
    expect(m.isBackendConfigured).toBe(true);
    expect(typeof m.backend.from).toBe('function');
    expect(typeof m.backend.auth.signInWithPassword).toBe('function');
    expect(typeof m.backend.auth.onAuthStateChange).toBe('function');
  });

  it('cae a Supabase si no hay Neon, y a modo demo si no hay ninguno', async () => {
    expect((await loadWith(SUPA)).backendKind).toBe('supabase');
    const demo = await loadWith({});
    expect(demo.backendKind).toBe('mock');
    expect(demo.isBackendConfigured).toBe(false);
    expect(await demo.hasActiveSession()).toBe(true); // el demo no exige sesión de servidor
  });

  it('con Neon, la evidencia se envía a la función de Netlify con el JWT del usuario', async () => {
    const m = await loadWith(NEON);
    vi.spyOn(m.backend.auth, 'getSession').mockResolvedValue({ data: { session: { access_token: 'jwt-123' } }, error: null });
    fetchMock.mockImplementation(async () => new Response('{}', { status: 201 }));
    fetchMock.mockClear();
    const blob = new Blob([new Uint8Array([1, 2])], { type: 'image/jpeg' });

    await m.uploadEvidence('ten-hocol/reg-1/ev-1.jpg', blob, 'image/jpeg');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/evidencias?path=ten-hocol%2Freg-1%2Fev-1.jpg');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer jwt-123');
  });

  it('con Neon, un rechazo de la función se propaga como error (el sync reintenta)', async () => {
    const m = await loadWith(NEON);
    vi.spyOn(m.backend.auth, 'getSession').mockResolvedValue({ data: { session: { access_token: 'jwt-123' } }, error: null });
    fetchMock.mockImplementation(async () => new Response('sin permiso', { status: 403 }));
    await expect(m.uploadEvidence('ten-hocol/r/e.jpg', new Blob([]), 'image/jpeg')).rejects.toThrow(/403/);
  });

  it('con Neon, cambiar la contraseña usa changePassword de Neon Auth con la actual', async () => {
    const m = await loadWith(NEON);
    const changePassword = vi.fn(async () => ({ data: {}, error: null }));
    vi.spyOn(m.backend.auth, 'getBetterAuthInstance').mockReturnValue({ changePassword });
    await m.changePassword({ currentPassword: 'vieja-123', newPassword: 'nueva-1234' });
    expect(changePassword).toHaveBeenCalledWith({ currentPassword: 'vieja-123', newPassword: 'nueva-1234', revokeOtherSessions: false });

    changePassword.mockResolvedValueOnce({ data: null, error: { code: 'INVALID_PASSWORD', message: 'Invalid password' } });
    await expect(m.changePassword({ currentPassword: 'x', newPassword: 'nueva-1234' })).rejects.toThrow('La contraseña actual no es correcta.');
  });

  it('traduce los errores de autenticación que ve un usuario de campo', async () => {
    const { friendlyAuthError } = await loadWith({});
    expect(friendlyAuthError({ message: 'Invalid email or password' })).toBe('Correo o contraseña incorrectos.');
    expect(friendlyAuthError({ message: 'Invalid login credentials' })).toBe('Correo o contraseña incorrectos.');
    expect(friendlyAuthError({ code: 'USER_ALREADY_EXISTS' })).toMatch(/Ya existe una cuenta/);
    expect(friendlyAuthError(new TypeError('Failed to fetch'))).toMatch(/No hay conexión/);
  });
});
