/**
 * storage.js — IndexedDB persistence for game state.
 * One save slot ("current"). localStorage only for tiny settings.
 */

const DB_NAME = 'puzzle-talk';
const DB_VERSION = 1;
const STORE = 'saves';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveGame(data) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ ...data, savedAt: Date.now() }, 'current');
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function loadGame() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get('current');
    req.onsuccess = () => { db.close(); resolve(req.result || null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function clearGame() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete('current');
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/** Ask the browser to make our storage persistent (best effort). */
export async function requestPersistence() {
  if (navigator.storage && navigator.storage.persist) {
    try { return await navigator.storage.persist(); } catch { return false; }
  }
  return false;
}

// Tiny settings via localStorage
export function getSetting(key, fallback = null) {
  try {
    const v = localStorage.getItem('pt-' + key);
    return v === null ? fallback : JSON.parse(v);
  } catch { return fallback; }
}

export function setSetting(key, value) {
  try { localStorage.setItem('pt-' + key, JSON.stringify(value)); } catch {}
}
