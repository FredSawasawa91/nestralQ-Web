// Main Application Entry Point
// No ES modules - uses window.state, window.ui, window.fbApi, window.bleApi, window.localApi

// ---------- Theme Initialization ----------
const savedTheme = localStorage.getItem('theme');
const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const initialTheme = savedTheme || (systemDark ? 'dark' : 'light');
window.state.theme = initialTheme;
window.state.setTheme(initialTheme);

// ---------- Helpers ----------
let sessionId = 0; // bumped on every mode change, so late async results can be ignored

function currentMode() {
  return window.state.device.connectionMode;
}

function setLink(link) {
  window.state.setLink(link);
  window.ui.renderStatus(currentMode(), window.state.link);
}

function isFirebaseReady() {
  if (!window.fbApi) {
    console.error('[App] Firebase not initialized! Check console for Firebase SDK errors.');
    return false;
  }
  return true;
}

// ---------- Firebase (Online mode) ----------
let unsubscribeSensors, unsubscribeCommands, unsubscribeAutoMode, unsubscribeThresholds, unsubscribeHistory;

function startFirebaseListeners() {
  if (!isFirebaseReady()) return;
  console.log('[App] Starting Firebase listeners...');

  unsubscribeSensors = window.fbApi.startSensorsListener((data) => {
    window.state.updateSensors(data);
    window.ui.renderSensors(window.state.sensors);
  });

  unsubscribeCommands = window.fbApi.startCommandsListener((data) => {
    window.state.updateDevice({
      fanState: data.fan,
      heaterState: data.heater,
      bulbState: data.bulb,
    });
    window.ui.renderDevices(window.state.device);
  });

  unsubscribeAutoMode = window.fbApi.startAutoModeListener((value) => {
    window.state.updateDevice({ autoMode: value });
    window.ui.renderDevices(window.state.device);
  });

  unsubscribeThresholds = window.fbApi.startThresholdsListener((data) => {
    window.state.updateThresholds(data);
    window.ui.renderThresholds(window.state.thresholds);
  });

  unsubscribeHistory = window.fbApi.startHistoryListener((data) => {
    applyRemoteHistory(data);
  });
}

function stopFirebaseListeners() {
  if (unsubscribeSensors) unsubscribeSensors();
  if (unsubscribeCommands) unsubscribeCommands();
  if (unsubscribeAutoMode) unsubscribeAutoMode();
  if (unsubscribeThresholds) unsubscribeThresholds();
  if (unsubscribeHistory) unsubscribeHistory();
  unsubscribeSensors = unsubscribeCommands = unsubscribeAutoMode = unsubscribeThresholds = unsubscribeHistory = null;
}

// ---------- Offline history (Bluetooth / Local Wi-Fi) ----------
window.state.remoteHistory = window.state.remoteHistory || [];
let historyFlushInFlight = false;

function refreshHistoryUi(entries) {
  window.state.history = entries || [];
  window.ui.renderHistory(window.state.history);
  window.ui.renderReports(window.state.history);
}

async function applyRemoteHistory(data) {
  window.state.remoteHistory = data || [];
  if (window.historyStore) {
    await window.historyStore.markPresentInRemote(window.state.remoteHistory);
    refreshHistoryUi(window.historyStore.merge(window.state.remoteHistory));
  } else {
    refreshHistoryUi(window.state.remoteHistory);
  }
}

async function recordLocalHistory(sensors) {
  if (!window.historyStore) return;
  const mode = currentMode();
  if (mode !== 'bluetooth' && mode !== 'local') return;
  const entry = await window.historyStore.record(sensors);
  if (!entry) return;
  refreshHistoryUi(window.historyStore.merge(window.state.remoteHistory || []));
  flushHistoryToFirebase();
}

async function flushHistoryToFirebase() {
  if (historyFlushInFlight) return;
  if (!window.historyStore || !isFirebaseReady()) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  const pending = window.historyStore.pending();
  if (!pending.length) return;

  historyFlushInFlight = true;
  const synced = [];
  try {
    for (const entry of pending) {
      const ok = await window.fbApi.writeSensorLog(entry);
      if (ok) synced.push(entry.ts);
      else break;
    }
    if (synced.length) await window.historyStore.markSynced(synced);
  } finally {
    historyFlushInFlight = false;
  }
}

// ---------- Reports from the device (Bluetooth / Local Wi-Fi) ----------
function applyReport(r) {
  const s = window.state;

  const sensors = {};
  ['temperature', 'humidity', 'lightIntensity', 'motionDetected'].forEach((k) => {
    if (r[k] !== undefined) sensors[k] = r[k];
  });
  s.updateSensors(sensors);

  const dev = {};
  if (r.fanState !== undefined && !s.isLocked('fan')) dev.fanState = r.fanState;
  if (r.heaterState !== undefined && !s.isLocked('heater')) dev.heaterState = r.heaterState;
  if (r.bulbState !== undefined && !s.isLocked('bulb')) dev.bulbState = r.bulbState;
  if (r.autoMode !== undefined && !s.isLocked('auto')) dev.autoMode = r.autoMode;
  s.updateDevice(dev);

  // Only touch the threshold inputs when the value really changed,
  // otherwise polling would wipe what the user is typing
  if (
    !s.isLocked('thresholds') &&
    Number.isFinite(r.minTemp) && Number.isFinite(r.maxTemp) &&
    (r.minTemp !== s.thresholds.minTemp || r.maxTemp !== s.thresholds.maxTemp)
  ) {
    s.updateThresholds({ minTemp: r.minTemp, maxTemp: r.maxTemp });
    window.ui.renderThresholds(s.thresholds);
  }

  window.ui.renderSensors(s.sensors);
  window.ui.renderDevices(s.device);
  recordLocalHistory(s.sensors);
}

// ---------- Connection modes ----------
function leaveCurrentMode() {
  stopFirebaseListeners();
  window.bleApi.disconnect();
  window.localApi.stop();
}

function reportLocalError(message) {
  // Stay in the current mode (Bluetooth or Local Wi-Fi) and just report the error.
  // Do not silently switch to Online mode.
  window.state.setLink({ status: 'disconnected', error: message });
}

async function startBluetooth(id) {
  if (!window.bleApi.isSupported()) {
    reportLocalError('Bluetooth: this browser does not support Web Bluetooth. Use Chrome or Edge, or the desktop app.');
    return;
  }

  setLink({ status: 'connecting' });
  try {
    const name = await window.bleApi.connect({
      onData: (text) => {
        if (id !== sessionId) return;
        const parsed = window.bleApi.parseData(text);
        if (parsed) applyReport(parsed);
      },
      onConnectionChange: (connected) => {
        if (id !== sessionId || connected) return;
        setLink({
          status: 'disconnected',
          error: 'Bluetooth connection lost. Select Bluetooth again to reconnect.',
        });
      },
    });

    if (id !== sessionId) {
      window.bleApi.disconnect();
      return;
    }
    setLink({ status: 'connected', detail: name });

    // Tell the ESP32 the automation mode shown in the app
    try {
      await window.bleApi.writeCommand('AUTO:' + (window.state.device.autoMode ? 1 : 0));
    } catch (error) {
      console.warn('[BLE] Could not sync automation mode:', error.message);
    }
  } catch (error) {
    if (id !== sessionId) return;
    reportLocalError('Bluetooth: ' + error.message);
  }
}

async function startLocal(id) {
  const ip = (window.state.localIp || '').trim();
  setLink({ status: 'connecting', detail: ip });

  try {
    const started = await window.localApi.start(ip, {
      onStatus: (status) => {
        if (id === sessionId) applyReport(status);
      },
      onLinkChange: (up, message) => {
        if (id !== sessionId) return;
        setLink({ status: up ? 'connected' : 'disconnected', error: up ? '' : message, detail: ip });
      },
    });
    if (!started || id !== sessionId) return;
  } catch (error) {
    if (id !== sessionId) return;
    reportLocalError('Local Wi-Fi: ' + error.message);
  }
}

// IMPORTANT: no await before startBluetooth(), the browser only shows the
// Bluetooth picker while the click that started it is still fresh.
function onSelectMode(mode) {
  const sameMode = mode === currentMode();
  if (sameMode && window.state.link.status === 'connected') return;

  const id = ++sessionId;
  leaveCurrentMode();
  window.state.setConnectionMode(mode);

  if (mode === 'online') {
    setLink({ status: 'connected' });
    startFirebaseListeners();
    flushHistoryToFirebase();
  } else if (mode === 'bluetooth') {
    startBluetooth(id);
  } else {
    startLocal(id);
  }
}

function onIpChange(ip) {
  window.state.setLocalIp(ip);
}

// ---------- Commands ----------
const ACTUATORS = {
  auto: { key: 'autoMode', path: 'settings/autoMode', cmd: (v) => 'AUTO:' + (v ? 1 : 0) },
  fan: { key: 'fanState', path: 'commands/fan', cmd: (v) => 'FAN:' + (v ? 1 : 0) },
  heater: { key: 'heaterState', path: 'commands/heater', cmd: (v) => 'HEATER:' + (v ? 1 : 0) },
  bulb: { key: 'bulbState', path: 'commands/bulb', cmd: (v) => 'BULB:' + (v ? 1 : 0) },
};

// Sends one command through whichever mode is active
async function dispatchCommand(mode, firebaseWrite, command) {
  if (mode === 'online') {
    if (isFirebaseReady()) await firebaseWrite();
  } else if (mode === 'bluetooth') {
    await window.bleApi.writeCommand(command);
  } else {
    const result = await window.localApi.sendCommand(command);
    // Apply the device's real state from the response (same as BLE notifications)
    if (result) applyReport(result);
  }
}

async function sendActuator(name, value) {
  const a = ACTUATORS[name];
  const mode = currentMode();

  if (mode !== 'online' && window.state.link.status !== 'connected') {
    window.ui.toast('Not connected to the ESP32.');
    window.ui.renderDevices(window.state.device); // put the switch back
    return;
  }

  if (mode !== 'online') window.state.lock(name);
  window.state.updateDevice({ [a.key]: value });
  window.ui.renderDevices(window.state.device);

  try {
    await dispatchCommand(mode, () => window.fbApi.writeValue(a.path, value), a.cmd(value));
  } catch (error) {
    window.ui.toast('Command failed: ' + error.message);
  }
}

async function onUpdateThresholds(min, max) {
  if (isNaN(min) || isNaN(max)) {
    window.ui.toast('Enter valid numbers.');
    return;
  }
  if (min >= max) {
    window.ui.toast('Minimum must be lower than maximum.');
    return;
  }

  const mode = currentMode();
  if (mode !== 'online' && window.state.link.status !== 'connected') {
    window.ui.toast('Not connected to the ESP32.');
    return;
  }

  if (mode !== 'online') window.state.lock('thresholds');
  window.state.updateThresholds({ minTemp: min, maxTemp: max });
  window.ui.renderThresholds(window.state.thresholds);

  try {
    await dispatchCommand(mode, () => window.fbApi.writeThresholds(min, max), 'TEMP:' + min + ',' + max);
    window.ui.toast('Thresholds updated: ' + min + '°C to ' + max + '°C');
  } catch (error) {
    window.ui.toast('Command failed: ' + error.message);
  }
}

function onThemeToggle(isDark) {
  window.state.setTheme(isDark ? 'dark' : 'light');
  window.ui.renderTheme(window.state.theme);
}

function onTabChange(tabName) {
  window.ui.switchTab(tabName);
}

// ---------- Initialize ----------
async function init() {
  console.log('[App] Initializing NestralQ Web...');
  if (window.historyStore) await window.historyStore.init();

  window.ui.setupEventListeners({
    onThemeToggle,
    onSelectMode,
    onIpChange,
    onAutoMode: (v) => sendActuator('auto', v),
    onFan: (v) => sendActuator('fan', v),
    onHeater: (v) => sendActuator('heater', v),
    onBulb: (v) => sendActuator('bulb', v),
    onUpdateThresholds,
    onTabChange,
    onRangeChange: (v) => {
      window.ui.renderHistory(window.state.history || []);
    },
    onExportCsv: () => {
      const entries = window.state.history || [];
      if (entries.length === 0) {
        window.ui.toast('No history to export.');
        return;
      }
      const header = 'Timestamp,Temperature (°C),Humidity (%),Light (lux),Motion';
      const rows = entries.map((en) =>
        [
          new Date(Number(en.ts || 0) * 1000).toISOString(),
          en.temperature ?? '',
          en.humidity ?? '',
          en.lightIntensity ?? '',
          en.motionDetected ? 'Yes' : 'No',
        ].join(',')
      );
      const csv = [header, ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'nestralq-sensor-history.csv';
      a.click();
      URL.revokeObjectURL(url);
      window.ui.toast('History exported to CSV.');
    },
    onPeriodChange: (v) => {
      window.state.reportsPeriod = v;
      window.ui.renderReports(window.state.history || []);
    },
    onExportReportCsv: () => {
      const allEntries = window.state.history || [];
      if (allEntries.length === 0) {
        window.ui.toast('No report data to export.');
        return;
      }
      const period = (window.ui.elements.reportsPeriod && window.ui.elements.reportsPeriod.value)
        || window.state.reportsPeriod
        || 'all';
      const periodMs = {
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
        all: Infinity,
      }[period] || Infinity;
      const now = Date.now();
      const entries = allEntries.filter((en) => {
        const n = Number(en.ts);
        if (!Number.isFinite(n) || n <= 0) return false;
        const ms = n < 1e12 ? n * 1000 : n;
        return now - ms <= periodMs;
      });

      const groups = {};
      entries.forEach((en) => {
        const n = Number(en.ts);
        const ms = n < 1e12 ? n * 1000 : n;
        const key = new Date(ms + 2 * 60 * 60 * 1000).toISOString().split('T')[0];
        if (!groups[key]) groups[key] = [];
        groups[key].push(en);
      });
      const keys = Object.keys(groups).sort().reverse();

      const computeStats = (groupEntries) => {
        const temps = groupEntries.map((en) => en.temperature).filter((v) => v != null);
        const humids = groupEntries.map((en) => en.humidity).filter((v) => v != null);
        const motions = groupEntries.filter((en) => en.motionDetected).length;
        return {
          count: groupEntries.length,
          avgTemp: temps.length ? (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1) : '-',
          minTemp: temps.length ? Math.min(...temps).toFixed(1) : '-',
          maxTemp: temps.length ? Math.max(...temps).toFixed(1) : '-',
          avgHumidity: humids.length
            ? (humids.reduce((a, b) => a + b, 0) / humids.length).toFixed(1)
            : '-',
          motionCount: motions,
        };
      };

      const header = 'Period,Readings,Avg Temp (°C),Min Temp (°C),Max Temp (°C),Avg Humidity (%),Motion Events';
      const rows = keys.map((key) => {
        const stats = computeStats(groups[key]);
        const label = new Date(key + 'T00:00:00Z').toLocaleDateString(undefined, {
          timeZone: 'Africa/Blantyre',
          weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
        });
        return [label, stats.count, stats.avgTemp, stats.minTemp, stats.maxTemp, stats.avgHumidity, stats.motionCount].join(',');
      });
      const csv = [header, ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'nestralq-report-' + period + '.csv';
      a.click();
      URL.revokeObjectURL(url);
      window.ui.toast('Report exported to CSV.');
    },
  });

  window.state.remoteHistory = window.state.remoteHistory || [];
  window.state.history =
    (window.historyStore && window.historyStore.merge(window.state.remoteHistory)) || [];
  window.state.reportsPeriod = window.state.reportsPeriod || 'all';

  window.ui.renderAvailability({
    bluetooth: window.bleApi.isSupported(),
    local: window.localApi.isAvailable(),
  });
  window.ui.renderIp(window.state.localIp);
  window.ui.renderTheme(window.state.theme);
  window.ui.renderSensors(window.state.sensors);
  window.ui.renderDevices(window.state.device);
  window.ui.renderThresholds(window.state.thresholds);
  window.ui.renderStatus(currentMode(), window.state.link);
  window.ui.switchTab('home');
  window.ui.renderHistory(window.state.history);
  window.ui.renderReports(window.state.history);

  startFirebaseListeners();
  flushHistoryToFirebase();
  window.addEventListener('online', () => flushHistoryToFirebase());
  setInterval(() => flushHistoryToFirebase(), 15000);
}

init();

// Export for debugging (optional)
window.nestralq = {
  state: window.state,
  fbApi: window.fbApi,
  bleApi: window.bleApi,
  localApi: window.localApi,
};
