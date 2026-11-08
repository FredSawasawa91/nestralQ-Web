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
let provision = { phase: 'idle', error: null };
let provisionTimer = null;
const notificationTracker = window.NestralQNotifications.createTracker();
let firebaseInitial = { sensors: true, commands: true, autoMode: true };

function checkDesktopNotifications(options) {
  if (!window.desktopNotifications) return;
  const notifications = notificationTracker.update({
    sensors: window.state.sensors,
    device: window.state.device,
    thresholds: window.state.thresholds,
  }, options);
  notifications.forEach((notification) => window.desktopNotifications.show(notification));
}

function currentMode() {
  return window.state.device.connectionMode;
}

function setLink(link) {
  window.state.setLink(link);
  window.ui.renderStatus(currentMode(), window.state.link);
  renderWifi();
}

function renderWifi() {
  window.ui.renderWifiSetup(
    window.state.net,
    provision,
    window.bleApi.isConnected()
  );
}

function setProvision(action) {
  const wasBusy = provision.phase === 'sending' || provision.phase === 'waiting';
  provision = window.NestralQNet.provisionReducer(provision, action);
  const busy = provision.phase === 'sending' || provision.phase === 'waiting';
  if (!wasBusy && busy) {
    provisionTimer = setTimeout(
      () => setProvision({ type: 'TIMEOUT' }),
      window.NestralQNet.PROVISION_TIMEOUT_MS
    );
  } else if (wasBusy && !busy) {
    clearTimeout(provisionTimer);
    provisionTimer = null;
  }
  renderWifi();
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
  notificationTracker.reset();
  firebaseInitial = { sensors: true, commands: true, autoMode: true };

  unsubscribeSensors = window.fbApi.startSensorsListener((data) => {
    window.state.updateSensors(data);
    window.ui.renderSensors(window.state.sensors);
    checkDesktopNotifications({
      sensorsReady: !firebaseInitial.sensors,
      actuatorsReady: false,
    });
    firebaseInitial.sensors = false;
  });

  unsubscribeCommands = window.fbApi.startCommandsListener((data) => {
    window.state.updateDevice({
      fanState: data.fan,
      heaterState: data.heater,
      bulbState: data.bulb,
    });
    window.ui.renderDevices(window.state.device);
    checkDesktopNotifications({
      sensorsReady: false,
      actuatorsReady: !firebaseInitial.commands && !firebaseInitial.autoMode,
    });
    firebaseInitial.commands = false;
  });

  unsubscribeAutoMode = window.fbApi.startAutoModeListener((value) => {
    window.state.updateDevice({ autoMode: value });
    window.ui.renderDevices(window.state.device);
    checkDesktopNotifications({
      sensorsReady: false,
      actuatorsReady: !firebaseInitial.commands && !firebaseInitial.autoMode,
    });
    firebaseInitial.autoMode = false;
  });

  unsubscribeThresholds = window.fbApi.startThresholdsListener((data) => {
    window.state.updateThresholds(data);
    window.ui.renderThresholds(window.state.thresholds);
    checkDesktopNotifications({ sensorsReady: false, actuatorsReady: false });
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
  checkDesktopNotifications();
  recordLocalHistory(s.sensors);
}

// ---------- Connection modes ----------
function leaveCurrentMode() {
  notificationTracker.reset();
  stopFirebaseListeners();
  window.bleApi.disconnect();
  window.localApi.stop();
}

function fallbackToOnline(message) {
  window.localApi.stop();
  window.state.setConnectionMode('online');
  setLink({ status: 'connected', error: message });
  startFirebaseListeners();
  flushHistoryToFirebase();
}

function applyNetReport(text) {
  const parsed = window.NestralQNet.parseNetStatus(text);
  if (!parsed) return;

  window.state.setNetStatus(parsed);
  if (parsed.state === 'CONNECTED' && window.localApi.isValidIp(parsed.ip)) {
    const deviceId = window.bleApi.getDeviceId();
    window.state.setLocalEndpoint(deviceId || 'default', parsed.ip, parsed.hostname);
    window.localApi.setFallbackHost(parsed.hostname);
    if (window.ui.elements.wifiSsid && !window.ui.elements.wifiSsid.value) {
      window.ui.elements.wifiSsid.value = parsed.ssid;
    }
    window.localApi.setTarget(parsed.ip);
  } else if (parsed.state === 'DISCONNECTED' && !parsed.ip) {
    window.state.clearLocalEndpoint(window.bleApi.getDeviceId());
    window.localApi.setTarget('');
    if (currentMode() === 'local') {
      fallbackToOnline('The device has no active Wi-Fi address. Switched to Online/Firebase mode.');
    }
  }

  if (parsed.state === 'CONNECTING' || parsed.state === 'CONNECTED' || parsed.state === 'FAILED') {
    setProvision({
      type: 'NET',
      state: parsed.state,
      revision: window.state.net.revision,
    });
  }
  renderWifi();
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
      onNet: (text) => {
        if (id === sessionId) applyNetReport(text);
      },
      onError: (error) => {
        if (id === sessionId) console.warn('[BLE] Status characteristic error:', error.message);
      },
      onConnectionChange: (connected) => {
        if (id !== sessionId) return;
        renderWifi();
        if (connected) return;
        setProvision({ type: 'BLE_LOST' });
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
    try {
      await window.bleApi.requestWifiStatus();
    } catch (error) {
      console.warn('[BLE] Could not request Wi-Fi status:', error.message);
    }
    renderWifi();
  } catch (error) {
    if (id !== sessionId) return;
    reportLocalError('Bluetooth: ' + error.message);
  }
}

async function startLocal(id) {
  const ip = (window.state.localIp || window.state.localHostname || '').trim();
  window.localApi.setFallbackHost(window.state.localHostname);
  setLink({ status: 'connecting', detail: ip || 'smarthome.local' });

  try {
    const started = await window.localApi.start(ip, {
      onStatus: (status) => {
        if (id === sessionId) applyReport(status);
      },
      onLinkChange: (up, message, address) => {
        if (id !== sessionId) return;
        if (!up) {
          fallbackToOnline(
            'Local Wi-Fi is unavailable (' + message + '). Switched to Online/Firebase mode.'
          );
          return;
        }
        setLink({
          status: 'connected',
          error: '',
          detail: address || ip || 'smarthome.local',
        });
      },
    });
    if (!started || id !== sessionId) return;
  } catch (error) {
    if (id !== sessionId) return;
    fallbackToOnline('Local Wi-Fi unavailable (' + error.message + '). Switched to Online/Firebase mode.');
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

async function onWifiConnect(ssid, password) {
  if (!window.bleApi.isConnected()) {
    setProvision({ type: 'ERROR', error: 'Connect to the device over Bluetooth first.' });
    return;
  }
  const invalid = window.NestralQNet.validateWifiInput(ssid, password);
  if (invalid) {
    window.ui.toast(invalid);
    renderWifi();
    return;
  }

  setProvision({ type: 'START', baselineRevision: window.state.net.revision });
  try {
    await window.bleApi.sendWifiSetup(ssid, password);
    setProvision({ type: 'SENT' });
  } catch (error) {
    setProvision({
      type: window.bleApi.isConnected() ? 'ERROR' : 'BLE_LOST',
      error: error.message,
    });
    window.ui.toast('Wi-Fi setup failed: ' + error.message);
  } finally {
    if (window.ui.elements.wifiPassword) window.ui.elements.wifiPassword.value = '';
  }
}

async function onWifiForget() {
  if (!window.bleApi.isConnected()) {
    window.ui.toast('Connect to the device over Bluetooth first.');
    return;
  }
  if (!window.confirm('Forget the saved Wi-Fi network on this device?')) return;
  try {
    await window.bleApi.forgetWifi();
    await window.bleApi.requestWifiStatus();
    window.ui.toast('Wi-Fi forget request sent.');
  } catch (error) {
    window.ui.toast('Could not forget Wi-Fi: ' + error.message);
  }
}

async function onWifiCopyIp(ip) {
  if (!ip) return;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(ip);
    } else {
      const input = document.createElement('textarea');
      input.value = ip;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      const copied = document.execCommand('copy');
      input.remove();
      if (!copied) throw new Error('Clipboard access is unavailable.');
    }
    window.ui.toast('Device IP copied.');
  } catch (error) {
    window.ui.toast('Could not copy IP: ' + error.message);
  }
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
    onWifiConnect,
    onWifiForget,
    onWifiCopyIp,
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
    onExportReportXlsx: async () => {
      const allEntries = window.state.history || [];
      if (allEntries.length === 0) {
        window.ui.toast('No report data to export.');
        return;
      }
      const period = (window.ui.elements.reportsPeriod && window.ui.elements.reportsPeriod.value)
        || window.state.reportsPeriod
        || 'all';
      try {
        if (!window.reportWorkbook || typeof window.reportWorkbook.save !== 'function') {
          throw new Error('Workbook export is unavailable. Restart the desktop app and try again.');
        }
        const result = await window.reportWorkbook.save({ entries: allEntries, period });
        if (result.status === 'empty') {
          window.ui.toast('No readings match the selected period.');
        } else if (result.status === 'saved') {
          window.ui.toast(`Report workbook saved with ${result.count} readings.`);
        }
      } catch (error) {
        console.error('[Reports] Workbook export failed:', error);
        window.ui.toast(`Report export failed: ${error.message || 'unknown error'}`);
      }
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
  window.ui.renderTheme(window.state.theme);
  window.ui.renderSensors(window.state.sensors);
  window.ui.renderDevices(window.state.device);
  window.ui.renderThresholds(window.state.thresholds);
  window.ui.renderStatus(currentMode(), window.state.link);
  renderWifi();
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
