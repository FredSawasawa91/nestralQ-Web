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
    'dark-mode-switch',
    'status-badge', 'status-badge-icon', 'status-badge-text',
    'connection-toggle', 'mode-toggle-icon',
    'mode-status', 'mode-error', 'mode-note', 'local-ip-input',
    'tab-home-btn', 'tab-settings-btn',
    'tab-home', 'tab-settings',
    'update-thresholds-btn', 'settings-update-thresholds-btn',
    'theme-toggle', 'theme-toggle-icon', 'dark-mode-icon',
    'toast',
  ];

  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      const key = id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      window.ui.elements[key] = el;
    }
  });

  window.ui.elements.connectionModeText = document.querySelector('.mode-text');
  window.ui.elements.modeButtons = Array.from(document.querySelectorAll('.mode-btn'));
};

window.ui.setIcon = function (svgEl, name) {
  if (!svgEl) return;
  const use = svgEl.querySelector('use');
  if (use) use.setAttribute('href', '#i-' + name);
};

// Small message at the bottom of the screen
let toastTimer = null;
window.ui.toast = function (message) {
  const el = window.ui.elements.toast;
  if (!el) {
    console.warn('[UI]', message);
    return;
  }
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 4000);
};

// ---------- Render Functions ----------

window.ui.renderSensors = function (data) {
  const e = window.ui.elements;
  if (e.tempValue) e.tempValue.textContent = Number(data.temperature || 0).toFixed(1) + '°C';
  if (e.humidityValue) e.humidityValue.textContent = Math.round(data.humidity || 0) + '%';
  if (e.lightValue) e.lightValue.textContent = Math.round(data.lightIntensity || 0) + ' lux';

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
  if (e.autoModeSwitch) e.autoModeSwitch.checked = !!data.autoMode;

  const manualOff = !!data.autoMode;
  [
    [e.fanSwitch, data.fanState],
    [e.heaterSwitch, data.heaterState],
    [e.bulbSwitch, data.bulbState],
  ].forEach(([el, val]) => {
    if (!el) return;
    el.checked = !!val;
    el.disabled = manualOff;
  });
};

// Controls are locked while the link is down (Bluetooth / Local Wi-Fi),
// and the manual switches are locked while automation is on.
window.ui.renderControlsEnabled = function () {
  const e = window.ui.elements;
  const s = window.state;
  const linkDown = s.device.connectionMode !== 'online' && s.link.status !== 'connected';
  const manualOff = linkDown || !!s.device.autoMode;

  if (e.autoModeSwitch) e.autoModeSwitch.disabled = linkDown;
  [e.fanSwitch, e.heaterSwitch, e.bulbSwitch].forEach((el) => {
    if (el) el.disabled = manualOff;
  });
  [e.updateThresholdsBtn, e.settingsUpdateThresholdsBtn].forEach((el) => {
    if (el) el.disabled = linkDown;
  });
};

window.ui.renderThresholds = function (data) {
  const e = window.ui.elements;
  if (e.minTempInput) e.minTempInput.value = data.minTemp ?? 22;
  if (e.maxTempInput) e.maxTempInput.value = data.maxTemp ?? 28;
  if (e.settingsMinTemp) e.settingsMinTemp.value = data.minTemp ?? 22;
  if (e.settingsMaxTemp) e.settingsMaxTemp.value = data.maxTemp ?? 28;
};

window.ui.renderTheme = function (theme) {
  const isDark = theme === 'dark';
  const e = window.ui.elements;
  document.documentElement.setAttribute('data-theme', theme);

  if (e.darkModeSwitch) e.darkModeSwitch.checked = isDark;
  window.ui.setIcon(e.darkModeIcon, isDark ? 'moon' : 'sun');
  window.ui.setIcon(e.themeToggleIcon, isDark ? 'sun' : 'moon'); // shows what a click switches to
};

window.ui.renderIp = function (ip) {
  if (window.ui.elements.localIpInput) window.ui.elements.localIpInput.value = ip || '';
};

// ---------- Connection status ----------

const MODE_META = {
  online: { label: 'Online', icon: 'cloud' },
  bluetooth: { label: 'Bluetooth', icon: 'bluetooth' },
  local: { label: 'Local Wi-Fi', icon: 'wifi' },
};

function statusLine(mode, link) {
  const status = (link && link.status) || 'connected';
  if (mode === 'bluetooth') {
    if (status === 'connected') return 'Connected to ' + (link.detail || 'ESP32') + ' over Bluetooth';
    if (status === 'connecting') return 'Choose your ESP32 in the Bluetooth picker...';
    return 'Bluetooth disconnected. Select Bluetooth again to reconnect.';
  }
  if (mode === 'local') {
    const ip = (link && link.detail) || window.state.localIp;
    if (status === 'connected') return 'Connected to ' + ip + ' over local Wi-Fi';
    if (status === 'connecting') return 'Connecting to ' + ip + '...';
    return 'Lost connection to ' + ip + '. Retrying automatically...';
  }
  return 'Online via Firebase (needs internet)';
}

window.ui.renderStatus = function (mode, link) {
  const e = window.ui.elements;
  const meta = MODE_META[mode] || MODE_META.online;
  const status = (link && link.status) || 'connected';

  const cls = status === 'connecting' ? ' is-connecting' : status === 'disconnected' ? ' is-down' : '';
  const suffix = status === 'connecting' ? ' · Connecting...' : status === 'disconnected' ? ' · Disconnected' : '';

  if (e.statusBadge) e.statusBadge.className = 'status-badge' + cls;
  if (e.statusBadgeText) e.statusBadgeText.textContent = meta.label + suffix;
  if (e.connectionModeText) e.connectionModeText.textContent = meta.label + suffix;
  if (e.connectionToggle) e.connectionToggle.className = 'mode-toggle' + cls;

  window.ui.setIcon(e.statusBadgeIcon, meta.icon);
  window.ui.setIcon(e.modeToggleIcon, meta.icon);

  if (e.modeStatus) e.modeStatus.textContent = statusLine(mode, link);
  if (e.modeError) e.modeError.textContent = (link && link.error) || '';

  (e.modeButtons || []).forEach((btn) => {
    const on = btn.dataset.mode === mode;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });

  window.ui.renderControlsEnabled();
};

// Disable modes this browser/page can't use, and say why
window.ui.renderAvailability = function (avail) {
  const e = window.ui.elements;
  const notes = [];

  (e.modeButtons || []).forEach((btn) => {
    if (btn.dataset.mode === 'bluetooth') {
      btn.disabled = !avail.bluetooth;
      if (!avail.bluetooth) {
        notes.push('Bluetooth needs Chrome or Edge (or the desktop app) and a Bluetooth adapter.');
      }
    }
    if (btn.dataset.mode === 'local') {
      btn.disabled = !avail.local;
      if (!avail.local) {
        notes.push('Local Wi-Fi is not available on this https page, because browsers block requests to http devices. Use the desktop app.');
      }
    }
  });

  if (e.modeNote) e.modeNote.textContent = notes.join(' ');
};

// ---------- Tab Switching ----------

window.ui.switchTab = function (tabName) {
  const e = window.ui.elements;
  const home = tabName === 'home';

  if (e.tabHomeBtn && e.tabSettingsBtn) {
    e.tabHomeBtn.classList.toggle('active', home);
    e.tabSettingsBtn.classList.toggle('active', !home);
  }
  if (e.tabHome && e.tabSettings) {
    e.tabHome.classList.toggle('active', home);
    e.tabSettings.classList.toggle('active', !home);
  }
};

// ---------- Event Listener Setup ----------

window.ui.setupEventListeners = function (callbacks) {
  const e = window.ui.elements;

  // Theme
  if (e.darkModeSwitch) {
    e.darkModeSwitch.addEventListener('change', () => {
      if (callbacks.onThemeToggle) callbacks.onThemeToggle(e.darkModeSwitch.checked);
    });
  }
  if (e.themeToggle) {
    e.themeToggle.addEventListener('click', () => {
      if (callbacks.onThemeToggle) callbacks.onThemeToggle(window.state.theme !== 'dark');
    });
  }

  // Connection mode selector (Settings tab)
  (e.modeButtons || []).forEach((btn) => {
    btn.addEventListener('click', () => {
      if (callbacks.onSelectMode) callbacks.onSelectMode(btn.dataset.mode);
    });
  });

  // The chip on the Home tab opens Settings, where the mode is chosen
  if (e.connectionToggle) {
    e.connectionToggle.addEventListener('click', () => {
      if (callbacks.onTabChange) callbacks.onTabChange('settings');
    });
  }

  // ESP32 IP address
  if (e.localIpInput) {
    e.localIpInput.addEventListener('input', () => {
      if (callbacks.onIpChange) callbacks.onIpChange(e.localIpInput.value.trim());
    });
  }

  // Device switches
  const bind = (el, cb) => {
    if (el) el.addEventListener('change', () => { if (cb) cb(el.checked); });
  };
  bind(e.autoModeSwitch, callbacks.onAutoMode);
  bind(e.fanSwitch, callbacks.onFan);
  bind(e.heaterSwitch, callbacks.onHeater);
  bind(e.bulbSwitch, callbacks.onBulb);

  // Thresholds - Home tab
  if (e.updateThresholdsBtn) {
    e.updateThresholdsBtn.addEventListener('click', () => {
      const min = parseFloat(e.minTempInput.value);
      const max = parseFloat(e.maxTempInput.value);
      if (callbacks.onUpdateThresholds) callbacks.onUpdateThresholds(min, max);
    });
  }

  // Thresholds - Settings tab
  if (e.settingsUpdateThresholdsBtn) {
    e.settingsUpdateThresholdsBtn.addEventListener('click', () => {
      const min = parseFloat(e.settingsMinTemp.value);
      const max = parseFloat(e.settingsMaxTemp.value);
      if (callbacks.onUpdateThresholds) callbacks.onUpdateThresholds(min, max);
    });
  }

  // Tab navigation
  if (e.tabHomeBtn) {
    e.tabHomeBtn.addEventListener('click', () => {
      if (callbacks.onTabChange) callbacks.onTabChange('home');
    });
  }
  if (e.tabSettingsBtn) {
    e.tabSettingsBtn.addEventListener('click', () => {
      if (callbacks.onTabChange) callbacks.onTabChange('settings');
    });
  }
};

// Initialize elements on load
window.ui.initElements();
