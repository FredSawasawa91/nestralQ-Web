// Local sensor history + pending Firebase sync (IndexedDB, localStorage fallback).
// Used in Bluetooth and Local Wi-Fi so History/Reports keep data until the internet is back.

(function () {
  const DB_NAME = 'nestralq';
  const STORE = 'sensorLog';
  const LS_KEY = 'nestralq-sensorLog';
  const SAMPLE_INTERVAL_S = 60;
  const MAX_ENTRIES = 2000;

  let db = null;
  let memory = [];
  let lastSampleTs = 0;
  let ready = null;

  function toEntry(sensors, ts) {
    return {
      id: String(ts),
      ts: ts,
      temperature: Number(sensors.temperature ?? 0),
      humidity: Number(sensors.humidity ?? 0),
      lightIntensity: Number(sensors.lightIntensity ?? 0),
      motionDetected: !!sensors.motionDetected,
      synced: false,
    };
  }

  function sortDesc(list) {
    return list.slice().sort((a, b) => Number(b.ts) - Number(a.ts));
  }

  function cap(list) {
    const sorted = sortDesc(list);
    return sorted.length > MAX_ENTRIES ? sorted.slice(0, MAX_ENTRIES) : sorted;
  }

  function readLocalStorage() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function writeLocalStorage(list) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(list));
    } catch (e) {
      /* quota or private mode */
    }
  }

  function openIndexedDb() {
    return new Promise((resolve) => {
      if (!window.indexedDB) {
        resolve(null);
        return;
      }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const next = req.result;
        if (!next.objectStoreNames.contains(STORE)) {
          next.createObjectStore(STORE, { keyPath: 'ts' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  }

  function idbAll() {
    return new Promise((resolve) => {
      if (!db) {
        resolve(readLocalStorage());
        return;
      }
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
      req.onerror = () => resolve(readLocalStorage());
    });
  }

  function idbPut(entry) {
    return new Promise((resolve) => {
      if (!db) {
        memory = cap(memory.filter((e) => Number(e.ts) !== Number(entry.ts)).concat(entry));
        writeLocalStorage(memory);
        resolve();
        return;
      }
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  function idbPutMany(entries) {
    return new Promise((resolve) => {
      if (!entries.length) {
        resolve();
        return;
      }
      if (!db) {
        const map = new Map(memory.map((e) => [Number(e.ts), e]));
        entries.forEach((e) => map.set(Number(e.ts), e));
        memory = cap(Array.from(map.values()));
        writeLocalStorage(memory);
        resolve();
        return;
      }
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      entries.forEach((e) => store.put(e));
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  async function persistMemory() {
    memory = cap(memory);
    if (!db) {
      writeLocalStorage(memory);
      return;
    }
    await idbPutMany(memory);
  }

  async function init() {
    if (ready) return ready;
    ready = (async () => {
      db = await openIndexedDb();
      memory = cap(await idbAll());
      if (!memory.length) memory = cap(readLocalStorage());
      const last = memory[0];
      lastSampleTs = last ? Number(last.ts) : 0;
    })();
    return ready;
  }

  function merge(remote) {
    const map = new Map();
    (remote || []).forEach((e) => {
      const ts = Number(e.ts || e.id);
      if (!Number.isFinite(ts) || ts <= 0) return;
      map.set(ts, {
        id: String(e.id || ts),
        ts: ts,
        temperature: e.temperature,
        humidity: e.humidity,
        lightIntensity: e.lightIntensity,
        motionDetected: !!e.motionDetected,
        synced: true,
      });
    });
    memory.forEach((e) => {
      const ts = Number(e.ts);
      if (!map.has(ts)) map.set(ts, e);
    });
    return cap(Array.from(map.values()));
  }

  async function record(sensors) {
    await init();
    const ts = Math.floor(Date.now() / 1000);
    if (lastSampleTs && ts - lastSampleTs < SAMPLE_INTERVAL_S) return null;
    if (!sensors) return null;
    lastSampleTs = ts;
    const entry = toEntry(sensors, ts);
    memory = cap(memory.filter((e) => Number(e.ts) !== ts).concat(entry));
    await idbPut(entry);
    if (!db) writeLocalStorage(memory);
    return entry;
  }

  function pending() {
    return memory.filter((e) => !e.synced);
  }

  async function markSynced(timestamps) {
    if (!timestamps || !timestamps.length) return;
    const set = new Set(timestamps.map(Number));
    memory = memory.map((e) => (set.has(Number(e.ts)) ? { ...e, synced: true } : e));
    await persistMemory();
  }

  async function markPresentInRemote(remote) {
    const remoteTs = new Set(
      (remote || []).map((e) => Number(e.ts || e.id)).filter((n) => Number.isFinite(n))
    );
    if (!remoteTs.size) return;
    let changed = false;
    memory = memory.map((e) => {
      if (remoteTs.has(Number(e.ts)) && !e.synced) {
        changed = true;
        return { ...e, synced: true };
      }
      return e;
    });
    if (changed) await persistMemory();
  }

  window.historyStore = {
    SAMPLE_INTERVAL_S,
    init,
    record,
    pending,
    merge,
    markSynced,
    markPresentInRemote,
    all: () => memory.slice(),
  };
})();
