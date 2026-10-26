// Main Application Entry Point
// No ES modules - loads as regular script, uses window.state, window.firebase, window.ui

// ---------- Theme Initialization ----------
const savedTheme = localStorage.getItem('theme');
const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const initialTheme = savedTheme || (systemDark ? 'dark' : 'light');
window.state.theme = initialTheme;
window.state.setTheme(initialTheme);

// ---------- Firebase Initialization ----------
let unsubscribeSensors, unsubscribeCommands, unsubscribeAutoMode, unsubscribeThresholds;

function isFirebaseReady() {
  if (!window.fbApi) {
    console.error('[App] Firebase not initialized! Check console for Firebase SDK errors.');
    return false;
  }
  return true;
}

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
}

// ---------- UI State Sync ----------
window.state.subscribe((currentState) => {
  console.log('[App] State updated:', currentState);
  // UI updates are handled by individual render functions called from Firebase listeners
  // and from event handlers. This subscription is available for future use.
});

// ---------- Event Handlers ----------

// Theme toggle
function onThemeToggle(isDark) {
  window.state.setTheme(isDark ? 'dark' : 'light');
  window.ui.renderTheme(window.state.theme);
}

// Connection mode toggle
async function onConnectionToggle(isBluetooth) {
  const mode = isBluetooth ? 'bluetooth' : 'online';
  window.state.setConnectionMode(mode);
  window.ui.renderStatus(mode);
  window.ui.renderConnectionModeSwitch(mode);

  stopFirebaseListeners();
  if (mode === 'online') startFirebaseListeners();

  if (isFirebaseReady()) {
    await window.fbApi.writeConnectionMode(mode);
  }
}

async function onAutoMode(checked) {
  window.state.updateDevice({ autoMode: checked });
  window.ui.renderDevices(window.state.device);
  if (isFirebaseReady()) await window.fbApi.writeValue('settings/autoMode', checked);
}

async function onFan(checked) {
  window.state.updateDevice({ fanState: checked });
  window.ui.renderDevices(window.state.device);
  if (isFirebaseReady()) await window.fbApi.writeValue('commands/fan', checked);
}

async function onHeater(checked) {
  window.state.updateDevice({ heaterState: checked });
  window.ui.renderDevices(window.state.device);
  if (isFirebaseReady()) await window.fbApi.writeValue('commands/heater', checked);
}

async function onBulb(checked) {
  window.state.updateDevice({ bulbState: checked });
  window.ui.renderDevices(window.state.device);
  if (isFirebaseReady()) await window.fbApi.writeValue('commands/bulb', checked);
}

async function onUpdateThresholds(min, max) {
  if (isNaN(min) || isNaN(max)) return;
  if (min >= max) {
    alert('Minimum must be lower than maximum.');
    return;
  }

  window.state.updateThresholds({ minTemp: min, maxTemp: max });
  window.ui.renderThresholds(window.state.thresholds);

  if (window.state.device.connectionMode === 'online' && isFirebaseReady()) {
    await window.fbApi.writeThresholds(min, max);
  }
}

// Tab change
function onTabChange(tabName) {
  window.ui.switchTab(tabName);
}

// ---------- Firebase Lifecycle ----------

function stopFirebaseListeners() {
  if (unsubscribeSensors) unsubscribeSensors();
  if (unsubscribeCommands) unsubscribeCommands();
  if (unsubscribeAutoMode) unsubscribeAutoMode();
  if (unsubscribeThresholds) unsubscribeThresholds();
  unsubscribeSensors = unsubscribeCommands = unsubscribeAutoMode = unsubscribeThresholds = null;
}

// ---------- Initialize ----------

function init() {
  console.log('[App] Initializing NestralQ Web...');
  console.log('[App] Firebase config:', window.firebaseConfig);
  console.log('[App] Firebase ready:', !!window.fbApi);
  console.log('[App] Initial state:', window.state);

  // Setup all event listeners
  window.ui.setupEventListeners({
    onThemeToggle,
    onConnectionToggle,
    onAutoMode,
    onFan,
    onHeater,
    onBulb,
    onUpdateThresholds,
    onTabChange,
  });

  // Set initial UI state
  window.ui.renderStatus(window.state.device.connectionMode);
  window.ui.renderConnectionModeSwitch(window.state.device.connectionMode);
  window.ui.renderTheme(window.state.theme);
  window.ui.renderSensors(window.state.sensors);
  window.ui.renderDevices(window.state.device);
  window.ui.renderThresholds(window.state.thresholds);
  window.ui.switchTab('home');

  // Start Firebase listeners
  startFirebaseListeners();
}

// Start the app
init();

// Export for debugging (optional)
window.nestralq = { state: window.state, fbApi: window.fbApi };