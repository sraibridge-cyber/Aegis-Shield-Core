// Append-only local storage for the device monitor.
// The only write path is appendIfHead(): a record is written only if the chain
// head is still the one it was built on, so two tabs cannot fork the chain.
// There is no update or delete method, and IndexedDB's add() refuses to
// overwrite an existing sequence number.

import { GENESIS_PREV } from "./chain.js";

const DB_NAME = "aegis-monitor";
const DB_VERSION = 1;

export class MemoryStore {
  constructor() {
    this.records = [];
    this.meta = new Map();
    this.durable = false;
  }
  async head() {
    return this.records.length ? this.records[this.records.length - 1] : null;
  }
  async all() {
    return this.records.map((r) => structuredClone(r));
  }
  async appendIfHead(expectedSeq, expectedHash, record) {
    const h = await this.head();
    const hs = h ? h.seq : 0;
    const hh = h ? h.hash : null;
    if (hs !== expectedSeq || hh !== expectedHash) return { ok: false, reason: "HEAD_MOVED" };
    if (record.seq !== hs + 1 || record.prevHash !== (hh ?? GENESIS_PREV)) {
      return { ok: false, reason: "BAD_LINK" };
    }
    this.records.push(structuredClone(record));
    return { ok: true };
  }
  async getMeta(key) {
    return this.meta.has(key) ? structuredClone(this.meta.get(key)) : undefined;
  }
  async setMeta(key, value) {
    this.meta.set(key, structuredClone(value));
  }
}

export function openIdbStore() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error("IndexedDB is not available in this browser"));
      return;
    }
    const req = globalThis.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("records")) db.createObjectStore("records", { keyPath: "seq" });
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
    };
    req.onsuccess = () => resolve(new IdbStore(req.result));
    req.onerror = () => reject(req.error || new Error("could not open local storage"));
    req.onblocked = () => reject(new Error("local storage is blocked by another open page"));
  });
}

class IdbStore {
  constructor(db) {
    this.db = db;
    this.durable = true;
  }

  tx(stores, mode) {
    return this.db.transaction(stores, mode);
  }

  head() {
    return new Promise((resolve, reject) => {
      const req = this.tx("records", "readonly").objectStore("records").openCursor(null, "prev");
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => reject(req.error);
    });
  }

  all() {
    return new Promise((resolve, reject) => {
      const out = [];
      const req = this.tx("records", "readonly").objectStore("records").openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (c) {
          out.push(c.value);
          c.continue();
        } else {
          resolve(out);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  appendIfHead(expectedSeq, expectedHash, record) {
    return new Promise((resolve) => {
      const tx = this.tx("records", "readwrite");
      const store = tx.objectStore("records");
      let reason = "STORAGE_ERROR";
      const cur = store.openCursor(null, "prev");
      cur.onsuccess = () => {
        const h = cur.result ? cur.result.value : null;
        const hs = h ? h.seq : 0;
        const hh = h ? h.hash : null;
        if (hs !== expectedSeq || hh !== expectedHash) {
          reason = "HEAD_MOVED";
          tx.abort();
          return;
        }
        if (record.seq !== hs + 1 || record.prevHash !== (hh ?? GENESIS_PREV)) {
          reason = "BAD_LINK";
          tx.abort();
          return;
        }
        store.add(record);
      };
      tx.oncomplete = () => resolve({ ok: true });
      tx.onabort = () => resolve({ ok: false, reason });
      tx.onerror = () => {
        reason = "STORAGE_ERROR";
      };
    });
  }

  getMeta(key) {
    return new Promise((resolve, reject) => {
      const req = this.tx("meta", "readonly").objectStore("meta").get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : undefined);
      req.onerror = () => reject(req.error);
    });
  }

  setMeta(key, value) {
    return new Promise((resolve, reject) => {
      const tx = this.tx("meta", "readwrite");
      tx.objectStore("meta").put({ key, value });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
}
