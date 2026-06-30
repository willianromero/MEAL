import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mockear el módulo Dexie como una clase constructora formal de ES6
vi.mock('dexie', () => {
  const mockTable = {
    add: vi.fn(() => Promise.resolve('ok')),
    put: vi.fn(() => Promise.resolve('ok')),
    get: vi.fn(() => Promise.resolve(null)),
    toArray: vi.fn(() => Promise.resolve([])),
    count: vi.fn(() => Promise.resolve(0)),
    clear: vi.fn(() => Promise.resolve()),
    bulkAdd: vi.fn(() => Promise.resolve()),
    where: vi.fn(() => ({
      equals: vi.fn(() => ({
        count: vi.fn(() => Promise.resolve(0)),
        toArray: vi.fn(() => Promise.resolve([]))
      }))
    }))
  };

  class MockDexie {
    constructor() {
      this.version = vi.fn().mockReturnThis();
      this.stores = vi.fn().mockReturnThis();
      this.projects = mockTable;
      this.logframes = mockTable;
      this.indicators = mockTable;
      this.surveys = mockTable;
      this.survey_responses = mockTable;
      this.feedbacks = mockTable;
      this.lessons_learned = mockTable;
      this.sync_meta = mockTable;
    }
  }

  return {
    default: MockDexie,
    Dexie: MockDexie,
    mockTableInstance: mockTable
  };
});

// Importar db y el inicializador semilla
import { db, seedLocalData } from '../db';

describe('Pruebas unitarias de base de datos local (Dexie.js Mock)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Debería inicializar las tablas de IndexedDB con sus nombres correctos', () => {
    expect(db.projects).toBeDefined();
    expect(db.indicators).toBeDefined();
    expect(db.surveys).toBeDefined();
    expect(db.feedbacks).toBeDefined();
  });

  it('Debería sembrar datos iniciales si el contador de proyectos es 0', async () => {
    // Simular base de datos vacía
    db.projects.count.mockResolvedValueOnce(0);
    db.projects.get.mockResolvedValueOnce(null);
    db.logframes.get.mockResolvedValueOnce(null);

    await seedLocalData();

    // Comprobar que se llamó a add/bulkAdd para poblar proyectos y otras tablas
    expect(db.projects.add).toHaveBeenCalled();
    expect(db.logframes.bulkAdd).toHaveBeenCalled();
    expect(db.indicators.bulkAdd).toHaveBeenCalled();
    expect(db.surveys.bulkAdd).toHaveBeenCalled();
  });

  it('NO debería volver a sembrar datos si ya existen proyectos en IndexedDB', async () => {
    // Simular que ya hay proyectos, el proyecto Wayuu, el de Maicao y el Impacto existen en IndexedDB
    db.projects.count.mockResolvedValueOnce(2);
    db.projects.get.mockResolvedValueOnce({ id: 'proj-wayuu-001', name: 'Guardianes del Mar' });
    db.projects.get.mockResolvedValueOnce({ id: 'proj-maicao-002', name: 'Clinica Maicao' });
    db.projects.get.mockResolvedValueOnce({ id: 'lf-wayuu-impact', type: 'impact' });

    await seedLocalData();

    // Comprobar que no se llamó a add ni bulkAdd para no sobreescribir datos locales del usuario
    expect(db.projects.add).not.toHaveBeenCalled();
    expect(db.projects.bulkAdd).not.toHaveBeenCalled();
  });
});
