// Application State Management
// Central store for all app data (no ES modules - loads as regular script)

window.state = {
  sensors: {
    temperature: 0.0,
    humidity: 0.0,
    lightIntensity: 0,
    motionDetected: 0,
  },
  device: {
    fanState: false,
    heaterState: false,
    bulbState: false,
    autoMode: true,
    connectionMode: 'online', // 'online' | 'bluetooth' | 'local'
  },
  thresholds: {
    minTemp: 22,
    maxTemp: 28,
  },
  theme: 'light',
  // State of the current connection: connected | connecting | disconnected
  link: { status: 'connected', error: '', detail: '' },
  localIp: '',
  localHostname: '',
  localDeviceId: null,
  localEndpoints: {},
  net: { state: null, ip: '', hostname: '', ssid: '', revision: 0 },
};

try {
  const savedEndpoints = JSON.parse(localStorage.getItem('localEndpoints') || '{}');
  window.state.localEndpoints =
    savedEndpoints && typeof savedEndpoints === 'object' && !Array.isArray(savedEndpoints)
      ? savedEndpoints
      : {};
  window.state.localIp = localStorage.getItem('localIp') || '';
  window.state.localHostname = localStorage.getItem('localHostname') || '';
  window.state.localDeviceId = localStorage.getItem('localDeviceId') || null;
} catch (e) { /* storage unavailable */ }

// Subscribers for state changes
window.state.subscribers = [];

window.state.subscribe = function (callback) {
  window.state.subscribers.push(callback);
  return function () {
    const index = window.state.subscribers.indexOf(callback);
    if (index > -1) window.state.subscribers.splice(index, 1);
  };
};

window.state.notify = function () {
  window.state.subscribers.forEach((cb) => cb(window.state));
};

// State mutation helpers
window.state.updateSensors = function (data) {
  window.state.sensors = { ...window.state.sensors, ...data };
  window.state.notify();
};

window.state.updateDevice = function (data) {
  window.state.device = { ...window.state.device, ...data };
  window.state.notify();
};

window.state.updateThresholds = function (data) {
  window.state.thresholds = { ...window.state.thresholds, ...data };
  window.state.notify();
};

window.state.setTheme = function (theme) {
  window.state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  window.state.notify();
};

window.state.setConnectionMode = function (mode) {
  window.state.device = { ...window.state.device, connectionMode: mode };
  window.state.notify();
};

window.state.setLink = function (link) {
  window.state.link = { status: 'connected', error: '', detail: '', ...link };
  window.state.notify();
};

window.state.setLocalIp = function (ip) {
  window.state.localIp = ip;
  try { localStorage.setItem('localIp', ip); } catch (e) { /* ignore */ }
};

window.state.setLocalEndpoint = function (deviceId, ip, hostname) {
  if (!deviceId || !ip) return;
  const endpoint = { ip: ip, hostname: hostname || '' };
  window.state.localEndpoints[deviceId] = endpoint;
  window.state.localDeviceId = deviceId;
  window.state.localIp = endpoint.ip;
  window.state.localHostname = endpoint.hostname;
  try {
    localStorage.setItem('localEndpoints', JSON.stringify(window.state.localEndpoints));
    localStorage.setItem('localDeviceId', deviceId);
    localStorage.setItem('localIp', endpoint.ip);
    localStorage.setItem('localHostname', endpoint.hostname);
  } catch (e) { /* ignore unavailable storage */ }
  window.state.notify();
};

window.state.clearLocalEndpoint = function (deviceId) {
  if (deviceId) delete window.state.localEndpoints[deviceId];
  const clearActive =
    !deviceId || !window.state.localDeviceId || window.state.localDeviceId === deviceId;
  if (clearActive) {
    window.state.localIp = '';
    window.state.localHostname = '';
    window.state.localDeviceId = null;
  }
  try {
    localStorage.setItem('localEndpoints', JSON.stringify(window.state.localEndpoints));
    if (clearActive) {
      localStorage.removeItem('localIp');
      localStorage.removeItem('localHostname');
      localStorage.removeItem('localDeviceId');
    }
  } catch (e) { /* ignore unavailable storage */ }
  window.state.notify();
};

window.state.setNetStatus = function (net) {
  window.state.net = { ...net, revision: window.state.net.revision + 1 };
  window.state.notify();
};

// After the user changes something, ignore values reported by the device for
// a few seconds, so a stale status report can't flip the control back.
const stateLocks = {};
window.state.lock = function (key, ms) {
  stateLocks[key] = Date.now() + (ms || 3000);
};
window.state.isLocked = function (key) {
  return (stateLocks[key] || 0) > Date.now();
};
