import { describe, it, expect } from 'vitest';
import { maskFeedback } from '../lib/pqrsPrivacy';

describe('maskFeedback — reserva de identidad en PQRS (RF-PQR-4)', () => {
  const confidential = { id: 'f1', is_confidential: true, contact_info: 'Juan Pérez, 3001234567' };
  const publicOne = { id: 'f2', is_confidential: false, contact_info: 'María Gómez' };

  it('oculta el contacto de una PQRS confidencial si el rol NO tiene VIEW_PQRS_IDENTITY', () => {
    const masked = maskFeedback(confidential, false);
    expect(masked.contact_info).toBe('[RESERVADO]');
  });

  it('NO oculta el contacto si el rol SÍ tiene VIEW_PQRS_IDENTITY (coordinador/director/admin_tenant)', () => {
    const masked = maskFeedback(confidential, true);
    expect(masked.contact_info).toBe('Juan Pérez, 3001234567');
  });

  it('una PQRS no confidencial nunca se enmascara, sin importar el rol', () => {
    expect(maskFeedback(publicOne, false).contact_info).toBe('María Gómez');
    expect(maskFeedback(publicOne, true).contact_info).toBe('María Gómez');
  });

  it('no muta el objeto original', () => {
    const original = { ...confidential };
    maskFeedback(confidential, false);
    expect(confidential).toEqual(original);
  });
});
