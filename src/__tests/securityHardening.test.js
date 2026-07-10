import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Verifica estáticamente los 3 cierres de brecha de 006_security_hardening.sql,
// para que una futura migración no los revierta sin que un test lo note.
describe('006_security_hardening — brechas cerradas tras la auditoría general', () => {
  const sql = readFileSync('supabase/migrations/006_security_hardening.sql', 'utf8');

  it('el borrado definitivo de configuración exige admin_tenant (no coordinador)', () => {
    const deleteBlock = sql.slice(sql.indexOf('1) Borrado definitivo'), sql.indexOf('2) Validar un registro'));
    // Dentro de format(), SQL escapa la comilla simple duplicándola: array[''admin_tenant'']
    expect(deleteBlock).toMatch(/array\[''admin_tenant''\]/);
    expect(deleteBlock).not.toMatch(/coordinador/);
  });

  it('validar un registro de campo exige rol coordinador/admin_tenant, no solo "no ser el autor"', () => {
    expect(sql).toMatch(/has_tenant_role\(old\.tenant_id, array\['coordinador','admin_tenant'\]\)/);
    expect(sql).toMatch(/Solo el Coordinador o el Administrador del proyecto pueden validar/);
  });

  it('la separación de funciones (no auto-validarse) se conserva', () => {
    expect(sql).toMatch(/current_user_id\(\) = old\.autor_id/);
  });

  it('editar la fila de un tenant queda reservado a platform_admin', () => {
    const tenantsBlock = sql.slice(sql.indexOf('tenants_update'));
    expect(tenantsBlock).toMatch(/using \(public\.is_platform_admin\(\)\)/);
    expect(tenantsBlock).not.toMatch(/has_tenant_role/);
  });
});

describe('Reports.jsx — exportaciones respetan la reserva de identidad PQRS', () => {
  const src = readFileSync('src/views/Reports.jsx', 'utf8');

  it('exportAllJson y exportTableCsv aplican maskFeedback a la tabla feedbacks', () => {
    const occurrences = (src.match(/maskFeedback\(/g) || []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2); // una por cada función de export
  });
});

describe('007_postgis_rls_advisor — cierra el aviso "RLS Disabled in Public"', () => {
  const sql = readFileSync('supabase/migrations/007_postgis_rls_advisor.sql', 'utf8');

  it('activa RLS en spatial_ref_sys', () => {
    expect(sql).toMatch(/alter table public\.spatial_ref_sys enable row level security/);
  });

  it('permite lectura pública (necesaria para que PostGIS calcule coordenadas)', () => {
    expect(sql).toMatch(/for select using \(true\)/);
  });

  it('no agrega políticas de escritura (catálogo de solo lectura de la extensión)', () => {
    expect(sql).not.toMatch(/for (insert|update|delete)/);
  });
});

describe('Indicators.jsx — congelar línea base restringido al rol correcto', () => {
  const src = readFileSync('src/views/Indicators.jsx', 'utf8');

  it('canFreeze ya no incluye CAP.APPROVE (Director)', () => {
    const line = src.split('\n').find(l => l.includes('const canFreeze ='));
    expect(line).not.toMatch(/CAP\.APPROVE/);
    expect(line).toMatch(/CAP\.VALIDATE/);
  });
});
