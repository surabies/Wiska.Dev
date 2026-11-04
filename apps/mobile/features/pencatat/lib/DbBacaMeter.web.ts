/**
 * db.web.ts — Platform fallback untuk browser web (Google Chrome / Edge).
 *
 * Di browser web, expo-sqlite menggunakan web worker + WASM (wa-sqlite)
 * yang memicu "Worker chunk not found" di Metro dev server.
 * File ini bertindak sebagai mock database ringan yang aman dijalankan
 * di browser web, baik ketika di-import langsung maupun dialias dari expo-sqlite.
 */

class WebDatabaseMock {
  async execAsync(): Promise<void> {}
  async getAllAsync<T = unknown>(): Promise<T[]> {
    return [];
  }
  async getFirstAsync<T = unknown>(): Promise<T | null> {
    return null;
  }
  async runAsync(): Promise<{ lastInsertRowId: number; changes: number }> {
    return { lastInsertRowId: 0, changes: 0 };
  }
  async withTransactionAsync<T>(task: () => Promise<T>): Promise<T> {
    return task();
  }
  async closeAsync(): Promise<void> {}
}

const mockDb = new WebDatabaseMock();

export function bukaDb(): Promise<any> {
  return Promise.resolve(mockDb);
}

export async function tutupDb(): Promise<void> {}

// Ekspor kompatibilitas expo-sqlite untuk bundel web
export const openDatabaseAsync = async () => mockDb;
export const openDatabaseSync = () => mockDb;
export class SQLiteDatabase {}

export default {
  openDatabaseAsync,
  openDatabaseSync,
  bukaDb,
  tutupDb,
};
