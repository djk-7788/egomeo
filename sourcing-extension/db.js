// IndexedDB 헬퍼 — popup.js / queue.js 양쪽에서 공유

const DB_NAME = 'egomeo-sourcing-db';
const DB_VERSION = 1;
const STORE = 'queue';

function dbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function dbGetAll() {
  const db = await dbOpen();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    req.onsuccess = () =>
      resolve(req.result.sort((a, b) => a.order - b.order));
    req.onerror = () => reject(req.error);
  });
}

async function dbAdd(item) {
  const db = await dbOpen();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readwrite').objectStore(STORE).add(item);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(item) {
  const db = await dbOpen();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readwrite').objectStore(STORE).put(item);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbDelete(id) {
  const db = await dbOpen();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function dbCount() {
  const db = await dbOpen();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// 전체 order 재정렬 (드래그 후 DOM 순서 기준)
async function dbReorder(orderedIds) {
  const db = await dbOpen();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);

  return new Promise((resolve, reject) => {
    const getAll = store.getAll();
    getAll.onsuccess = () => {
      const items = getAll.result;
      const map = {};
      items.forEach((item) => { map[item.id] = item; });

      orderedIds.forEach((id, idx) => {
        if (map[id]) {
          map[id].order = idx;
          store.put(map[id]);
        }
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
  });
}
