// UI Module - DOM Manipulation
// No ES modules - loads as regular script, uses window.state

window.ui = {};

// DOM element references
window.ui.elements = {};

// Initialize all DOM references safely
window.ui.initElements = function () {
  const ids = [
    'temp-value', 'humidity-value', 'light-value', 'motion-value',
    'auto-mode-switch', 'fan-switch', 'heater-switch', 'bulb-switch',
    'min-temp-input', 'max-temp-input',
    'settings-min-temp', 'settings-max-temp',
    'dark-mode-switch', 'connection-mode-switch',
    'status-badge', 'connection-toggle',
    'tab-home-btn', 'tab-settings-btn',
    'tab-home', 'tab-settings',
    'update-thresholds-btn', 'settings-update-thresholds-btn',
    'theme-toggle', 'theme-toggle-icon', 'dark-mode-icon',
    'status-badge-icon', 'status-badge-text',
    'mode-toggle-icon', 'connection-mode-icon',
  ];

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      const key = id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      window.ui.elements[key] = el;
    }
  });

  // Special case for mode-text
  window.ui.elements.connectionModeText = document.querySelector('.mode-text');
};

window.ui.setIcon = function (svgEl, name) {
  if (!svgEl) return;
  const use = svgEl.querySelector('use');
  if (use) use.setAttribute('href', '#i-' + name);
};

// ---------- Render Functions ----------

window.ui.renderSensors = function (data) {
  const e = window.ui.elements;
  if (e.tempValue)
    e.tempValue.textContent = data.temperature.toFixed(1) + '°C';
  if (e.humidityValue)
    e.humidityValue.textContent = Math.round(data.humidity) + '%';
  if (e.lightValue)
    e.lightValue.textContent = Math.round(data.lightIntensity) + ' lux';

  const motionEl = e.motionValue;
  if (motionEl) {
    if (data.motionDetected === 1) {
      motionEl.textContent = 'Detected!';
      motionEl.className = 'sensor-value motion-value detected';
    } else {
      motionEl.textContent = 'Clear';
      motionEl.className = 'sensor-value motion-value clear';
    }
  }
};

window.ui.renderDevices = function (data) {
  const e = window.ui.elements;
  if (e.autoModeSwitch)
    e.autoModeSwitch.checked = !!data.autoMode;
  if (e.fanSwitch)
    e.fanSwitch.checked = !!data.fanState;
  if (e.heaterSwitch)
    e.heaterSwitch.checked = !!data.heaterState;
  if (e.bulbSwitch)
    e.bulbSwitch.checked = !!data.bulbState;
};

window.ui.renderThresholds = function (data) {
  const e = window.ui.elements;
  if (e.minTempInput)
    e.minTempInput.value = data.minTemp ?? 22;
  if (e.maxTempInput)
    e.maxTempInput.value = data.maxTemp ?? 28;
  if (e.settingsMinTemp)
    e.settingsMinTemp.value = data.minTemp ?? 22;
  if (e.settingsMaxTemp)
    e.settingsMaxTemp.value = data.maxTemp ?? 28;
};

window.ui.renderTheme = function (theme) {
  const isDark = theme === 'dark';
  const e = window.ui.elements;
  document.documentElement.setAttribute('data-theme', theme);

  if (e.darkModeSwitch) e.darkModeSwitch.checked = isDark;
  window.ui.setIcon(e.darkModeIcon, isDark ? 'moon' : 'sun');
  window.ui.setIcon(e.themeToggleIcon, isDark ? 'sun' : 'moon'); // shows what a click switches to
};

window.ui.renderStatus = function (mode) {
  const e = window.ui.elements;
  const isOnline = mode === 'online';
  const icon = isOnline ? 'wifi' : 'bluetooth';
  const label = isOnline ? 'Online' : 'Bluetooth';

  if (e.statusBadge) e.statusBadge.className = 'status-badge' + (isOnline ? '' : ' bluetooth');
  if (e.statusBadgeText) e.statusBadgeText.textContent = label;
  if (e.connectionModeText) e.connectionModeText.textContent = label;
  if (e.connectionToggle) e.connectionToggle.className = 'mode-toggle' + (isOnline ? '' : ' mode-bluetooth');

  window.ui.setIcon(e.statusBadgeIcon, icon);
  window.ui.setIcon(e.modeToggleIcon, icon);
  window.ui.setIcon(e.connectionModeIcon, icon);
};

window.ui.renderConnectionModeSwitch = function (mode) {
  const e = window.ui.elements;
  if (e.connectionModeSwitch)
    e.connectionModeSwitch.checked = mode === 'bluetooth';
};

// ---------- Tab Switching ----------

window.ui.switchTab = function (tabName) {
  const e = window.ui.elements;

  // Update buttons
  if (e.tabHomeBtn && e.tabSettingsBtn) {
    if (tabName === 'home') {
      e.tabHomeBtn.classList.add('active');
      e.tabSettingsBtn.classList.remove('active');
    } else {
      e.tabHomeBtn.classList.remove('active');
      e.tabSettingsBtn.classList.add('active');
    }
  }

  // Update panels
  if (e.tabHome && e.tabSettings) {
    if (tabName === 'home') {
      e.tabHome.classList.add('active');
      e.tabSettings.classList.remove('active');
    } else {
      e.tabHome.classList.remove('active');
      e.tabSettings.classList.add('active');
    }
  }
};

// ---------- Event Listener Setup ----------

window.ui.setupEventListeners = function (callbacks) {
  // Theme toggle
  const darkModeSwitch = window.ui.elements.darkModeSwitch;
  if (darkModeSwitch) {
    darkModeSwitch.addEventListener('change', () => {
      if (callbacks.onThemeToggle) callbacks.onThemeToggle(darkModeSwitch.checked);
    });
  }

  const themeToggle = window.ui.elements.themeToggle;
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      if (callbacks.onThemeToggle) callbacks.onThemeToggle(window.state.theme !== 'dark');
    });
  }

  // Connection mode toggle
  const connectionModeSwitch = window.ui.elements.connectionModeSwitch;
  if (connectionModeSwitch) {
    connectionModeSwitch.addEventListener('change', () => {
      if (callbacks.onConnectionToggle) callbacks.onConnectionToggle(connectionModeSwitch.checked);
    });
  }

  const connectionToggle = window.ui.elements.connectionToggle;
  if (connectionToggle) {
    connectionToggle.addEventListener('click', () => {
      const isBluetooth = connectionModeSwitch ? !connectionModeSwitch.checked : false;
      if (callbacks.onConnectionToggle) callbacks.onConnectionToggle(isBluetooth);
    });
  }

  // Device switches
  const autoModeSwitch = window.ui.elements.autoModeSwitch;
  if (autoModeSwitch) {
    autoModeSwitch.addEventListener('change', () => {
      if (callbacks.onAutoMode) callbacks.onAutoMode(autoModeSwitch.checked);
    });
  }
  const fanSwitch = window.ui.elements.fanSwitch;
  if (fanSwitch) {
    fanSwitch.addEventListener('change', () => {
      if (callbacks.onFan) callbacks.onFan(fanSwitch.checked);
    });
  }
  const heaterSwitch = window.ui.elements.heaterSwitch;
  if (heaterSwitch) {
    heaterSwitch.addEventListener('change', () => {
      if (callbacks.onHeater) callbacks.onHeater(heaterSwitch.checked);
    });
  }
  const bulbSwitch = window.ui.elements.bulbSwitch;
  if (bulbSwitch) {
    bulbSwitch.addEventListener('change', () => {
      if (callbacks.onBulb) callbacks.onBulb(bulbSwitch.checked);
    });
  }

  // Thresholds - Home tab
  const updateThresholdsBtn = window.ui.elements.updateThresholdsBtn;
  if (updateThresholdsBtn) {
    updateThresholdsBtn.addEventListener('click', () => {
      const min = parseFloat(window.ui.elements.minTempInput.value);
      const max = parseFloat(window.ui.elements.maxTempInput.value);
      if (callbacks.onUpdateThresholds) callbacks.onUpdateThresholds(min, max);
    });
  }

  // Thresholds - Settings tab
  const settingsUpdateThresholdsBtn = window.ui.elements.settingsUpdateThresholdsBtn;
  if (settingsUpdateThresholdsBtn) {
    settingsUpdateThresholdsBtn.addEventListener('click', () => {
      const min = parseFloat(window.ui.elements.settingsMinTemp.value);
      const max = parseFloat(window.ui.elements.settingsMaxTemp.value);
      if (callbacks.onUpdateThresholds) callbacks.onUpdateThresholds(min, max);
    });
  }

  // Tab navigation
  const tabHomeBtn = window.ui.elements.tabHomeBtn;
  if (tabHomeBtn) {
    tabHomeBtn.addEventListener('click', () => {
      if (callbacks.onTabChange) callbacks.onTabChange('home');
    });
  }
  const tabSettingsBtn = window.ui.elements.tabSettingsBtn;
  if (tabSettingsBtn) {
    tabSettingsBtn.addEventListener('click', () => {
      if (callbacks.onTabChange) callbacks.onTabChange('settings');
    });
  }
};

// Initialize elements on load
window.ui.initElements();