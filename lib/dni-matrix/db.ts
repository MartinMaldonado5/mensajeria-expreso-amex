/**
 * IndexedDB Persistence for DNI Matrix Express
 * Allows storing hundreds of high-res photos without localStorage limits.
 */

export interface DniSlotData {
  id: number;
  anverso?: string | null;
  reverso?: string | null;
  label?: string;
  clienteId?: string;
  paqueteId?: string;
  anversoRotation?: number;
  reversoRotation?: number;
  updatedAt?: number;
}

const DB_NAME = 'DniMatrixExpressDB';
const DB_VERSION = 1;
const STORE_SLOTS = 'slots';
const STORE_SETTINGS = 'settings';

class DniMatrixDB {
  private dbInstance: IDBDatabase | null = null;

  async open(): Promise<IDBDatabase> {
    if (typeof window === 'undefined') {
      throw new Error('IndexedDB is only available in the browser.');
    }
    if (this.dbInstance) return this.dbInstance;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_SLOTS)) {
          db.createObjectStore(STORE_SLOTS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
        }
      };

      request.onsuccess = (e) => {
        this.dbInstance = (e.target as IDBOpenDBRequest).result;
        resolve(this.dbInstance);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async saveSlot(slot: DniSlotData): Promise<boolean> {
    try {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_SLOTS, 'readwrite');
        const store = tx.objectStore(STORE_SLOTS);
        const req = store.put({ ...slot, updatedAt: Date.now() });
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.error('Error saving slot to IndexedDB:', e);
      return false;
    }
  }

  async loadAllSlots(): Promise<DniSlotData[]> {
    try {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_SLOTS, 'readonly');
        const store = tx.objectStore(STORE_SLOTS);
        const req = store.getAll();
        req.onsuccess = () => resolve((req.result as DniSlotData[]) || []);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.error('Error loading slots from IndexedDB:', e);
      return [];
    }
  }

  async clearAllSlots(): Promise<boolean> {
    try {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_SLOTS, 'readwrite');
        const store = tx.objectStore(STORE_SLOTS);
        const req = store.clear();
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.error('Error clearing slots in IndexedDB:', e);
      return false;
    }
  }

  async deleteSlot(id: number): Promise<boolean> {
    try {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_SLOTS, 'readwrite');
        const store = tx.objectStore(STORE_SLOTS);
        const req = store.delete(id);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.error('Error deleting slot in IndexedDB:', e);
      return false;
    }
  }

  async saveSetting(key: string, val: unknown): Promise<boolean> {
    try {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_SETTINGS, 'readwrite');
        const store = tx.objectStore(STORE_SETTINGS);
        const req = store.put({ key, val });
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.error('Error saving setting:', e);
      return false;
    }
  }

  async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const db = await this.open();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_SETTINGS, 'readonly');
        const store = tx.objectStore(STORE_SETTINGS);
        const req = store.get(key);
        req.onsuccess = () => {
          if (req.result && req.result.val !== undefined) {
            resolve(req.result.val as T);
          } else {
            resolve(defaultValue);
          }
        };
        req.onerror = () => resolve(defaultValue);
      });
    } catch (e) {
      return defaultValue;
    }
  }
}

export const dniDb = new DniMatrixDB();
