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
    'tab-home-btn', 'tab-history-btn', 'tab-reports-btn', 'tab-settings-btn',
    'tab-home', 'tab-history', 'tab-reports', 'tab-settings',
    'update-thresholds-btn', 'settings-update-thresholds-btn',
    'theme-toggle', 'theme-toggle-icon', 'dark-mode-icon',
    'toast',
    // History
    'history-range', 'export-csv-btn',
    'hist-count', 'hist-avg-temp', 'hist-min-max', 'hist-motion',
    'history-table-body', 'history-chart',
    // Reports
    'reports-period', 'export-report-csv-btn',
    'rep-total-days', 'rep-avg-temp', 'rep-min-temp', 'rep-max-temp',
    'reports-table-body',
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

  // History element references (HTML uses hyphenated IDs; keys are camelCase)
  window.ui.elements.historyRange = document.getElementById('history-range');
  window.ui.elements.exportCsvBtn = document.getElementById('export-csv-btn');
  window.ui.elements.histCount = document.getElementById('hist-count');
  window.ui.elements.histAvgTemp = document.getElementById('hist-avg-temp');
  window.ui.elements.histMinMax = document.getElementById('hist-min-max');
  window.ui.elements.histMotion = document.getElementById('hist-motion');
  window.ui.elements.historyTableBody = document.getElementById('history-table-body');
  window.ui.elements.historyChartCanvas = document.getElementById('history-chart');

  // Reports element references
  window.ui.elements.reportsPeriod = document.getElementById('reports-period');
  window.ui.elements.exportReportCsvBtn = document.getElementById('export-report-csv-btn');
  window.ui.elements.repTotalDays = document.getElementById('rep-total-days');
  window.ui.elements.repAvgTemp = document.getElementById('rep-avg-temp');
  window.ui.elements.repMinTemp = document.getElementById('rep-min-temp');
  window.ui.elements.repMaxTemp = document.getElementById('rep-max-temp');
  window.ui.elements.reportsTableBody = document.getElementById('reports-table-body');
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

// ---------- Sensor History & Reports ----------

const formatTs = (ts) => {
  if (!ts) return '-';
  const d = new Date(Number(ts) * 1000);
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

let historyChart = null;

window.ui.renderHistory = function (entries) {
  const e = window.ui.elements;
  const now = Date.now();
  const rangeSel = e.historyRange;
  const range = rangeSel ? rangeSel.value : '24h';

  const rangeMs = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    all: Infinity,
  }[range] || Infinity;

  const filtered = entries.filter((en) => {
    if (!en.ts) return false;
    return now - Number(en.ts) * 1000 <= rangeMs;
  });

  // Stats
  const temps = filtered.map((en) => en.temperature).filter((v) => v != null);
  const humids = filtered.map((en) => en.humidity).filter((v) => v != null);
  const avgTemp = temps.length ? (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1) : '-';
  const minTemp = temps.length ? Math.min(...temps).toFixed(1) : '-';
  const maxTemp = temps.length ? Math.max(...temps).toFixed(1) : '-';
  const avgHumidity = humids.length
    ? (humids.reduce((a, b) => a + b, 0) / humids.length).toFixed(1)
    : '-';

  if (e.histCount) e.histCount.textContent = filtered.length;
  if (e.histAvgTemp) e.histAvgTemp.textContent = avgTemp === '-' ? '-' : avgTemp + '°C';
  if (e.histMinMax) e.histMinMax.textContent = minTemp === '-' ? '- / -' : minTemp + ' / ' + maxTemp;
  if (e.histMotion) e.histMotion.textContent = filtered.filter((en) => en.motionDetected).length;

  // Table
  const body = e.historyTableBody;
  if (body) {
    body.innerHTML = '';
    if (filtered.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 5;
      td.textContent = 'No sensor history in this range.';
      td.style.textAlign = 'center';
      tr.appendChild(td);
      body.appendChild(tr);
    } else {
      // Show newest 200 rows in table
      filtered.slice(0, 200).forEach((en) => {
        const tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' + formatTs(en.ts) + '</td>' +
          '<td>' + (en.temperature != null ? en.temperature.toFixed(1) : '-') + '</td>' +
          '<td>' + (en.humidity != null ? en.humidity.toFixed(1) : '-') + '</td>' +
          '<td>' + (en.lightIntensity != null ? Math.round(en.lightIntensity) : '-') + '</td>' +
          '<td><span class="' + (en.motionDetected ? 'motion-yes' : 'motion-no') + '">' +
          (en.motionDetected ? 'Yes' : 'No') + '</span></td>';
        body.appendChild(tr);
      });
    }
  }

  // Chart (temperature line)
  const canvas = e.historyChartCanvas;
  if (canvas) {
    const ctx = canvas.getContext('2d');
    if (historyChart) {
      historyChart.destroy();
    }

    // Use newest 120 points for chart
    const chartData = filtered.slice(0, 120).reverse();
    const labels = chartData.map((en) => formatTs(en.ts));
    const tempValues = chartData.map((en) => (en.temperature != null ? en.temperature : null));
    const humValues = chartData.map((en) => (en.humidity != null ? en.humidity : null));

    historyChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Temperature (°C)',
            data: tempValues,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4,
          },
          {
            label: 'Humidity (%)',
            data: humValues,
            borderColor: '#0ea5e9',
            backgroundColor: 'rgba(14, 165, 233, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { color: getComputedStyle(document.documentElement).color || '#333' } },
          title: {
            display: true,
            text: 'Sensor History (' + range + ')',
            color: getComputedStyle(document.documentElement).color || '#333',
          },
        },
        scales: {
          x: { display: true, ticks: { maxRotation: 45, minRotation: 45 } },
          y: {
            beginAtZero: false,
            title: { display: true, text: 'Value', color: getComputedStyle(document.documentElement).color || '#333' },
          },
        },
      },
    });
  }
};

window.ui.renderChart = window.ui.renderHistory;

// ---------- Reports ----------

const formatPeriod = (key, period) => {
  if (!key) return '-';
  if (period === 'daily') {
    const d = new Date(key + 'T00:00:00Z');
    return d.toLocaleDateString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    });
  }
  return 'Week of ' + key;
};

window.ui.renderReports = function (entries) {
  const e = window.ui.elements;
  const periodSel = e.reportsPeriod;
  const period = periodSel ? periodSel.value : 'daily';

  // ---------- Aggregate ----------
  const groupByDay = (entries) => {
    const groups = {};
    entries.forEach((en) => {
      if (!en.ts) return;
      const d = new Date(Number(en.ts) * 1000);
      const key = d.toISOString().split('T')[0];
      if (!groups[key]) groups[key] = [];
      groups[key].push(en);
    });
    return groups;
  };

  const groupByWeek = (entries) => {
    const groups = {};
    entries.forEach((en) => {
      if (!en.ts) return;
      const d = new Date(Number(en.ts) * 1000);
      const dayOfWeek = d.getUTCDay();
      const startOfWeek = new Date(d);
      startOfWeek.setUTCDate(d.getUTCDate() - dayOfWeek);
      const key = startOfWeek.toISOString().split('T')[0];
      if (!groups[key]) groups[key] = [];
      groups[key].push(en);
    });
    return groups;
  };

  const groups = period === 'daily' ? groupByDay(entries) : groupByWeek(entries);
  const keys = Object.keys(groups).sort().reverse();

  // ---------- Stats per group ----------
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

  // ---------- Overall stats ----------
  const allTemps = entries.map((en) => en.temperature).filter((v) => v != null);
  if (e.repTotalDays) e.repTotalDays.textContent = keys.length;
  if (e.repAvgTemp) e.repAvgTemp.textContent = allTemps.length
    ? (allTemps.reduce((a, b) => a + b, 0) / allTemps.length).toFixed(1) + '°C'
    : '-';
  if (e.repMinTemp) e.repMinTemp.textContent = allTemps.length
    ? Math.min(...allTemps).toFixed(1) + '°C'
    : '-';
  if (e.repMaxTemp) e.repMaxTemp.textContent = allTemps.length
    ? Math.max(...allTemps).toFixed(1) + '°C'
    : '-';

  // ---------- Table ----------
  const body = e.reportsTableBody;
  if (body) {
    body.innerHTML = '';
    if (keys.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 7;
      td.textContent = 'No report data available.';
      td.style.textAlign = 'center';
      tr.appendChild(td);
      body.appendChild(tr);
    } else {
      keys.forEach((key) => {
        const stats = computeStats(groups[key]);
        const tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' + formatPeriod(key, period) + '</td>' +
          '<td>' + stats.count + '</td>' +
          '<td>' + stats.avgTemp + '°C</td>' +
          '<td>' + stats.minTemp + '°C</td>' +
          '<td>' + stats.maxTemp + '°C</td>' +
          '<td>' + stats.avgHumidity + '%</td>' +
          '<td>' + stats.motionCount + '</td>';
        body.appendChild(tr);
      });
    }
  }
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

  // Deactivate all tab buttons and panels
  const allTabs = ['home', 'history', 'reports', 'settings'];
  allTabs.forEach((t) => {
    const btn = e['tab' + t.charAt(0).toUpperCase() + t.slice(1) + 'Btn'];
    const panel = e['tab' + t.charAt(0).toUpperCase() + t.slice(1)];
    if (btn) btn.classList.toggle('active', t === tabName);
    if (panel) panel.classList.toggle('active', t === tabName);
  });

  // Re-render the active tab's dynamic content
  if (tabName === 'history' && e.historyRange) {
    window.ui.renderHistory(window.state.history || []);
  }
  if (tabName === 'reports' && e.reportsPeriod) {
    window.ui.renderReports(window.state.history || []);
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

  // History range selector
  if (e.historyRange) {
    e.historyRange.addEventListener('change', () => {
      if (callbacks.onRangeChange) callbacks.onRangeChange(e.historyRange.value);
    });
  }

  // Export History CSV
  if (e.exportCsvBtn) {
    e.exportCsvBtn.addEventListener('click', () => {
      if (callbacks.onExportCsv) callbacks.onExportCsv();
    });
  }

  // Reports period selector
  if (e.reportsPeriod) {
    e.reportsPeriod.addEventListener('change', () => {
      if (callbacks.onPeriodChange) callbacks.onPeriodChange(e.reportsPeriod.value);
    });
  }

  // Export Reports CSV
  if (e.exportReportCsvBtn) {
    e.exportReportCsvBtn.addEventListener('click', () => {
      if (callbacks.onExportReportCsv) callbacks.onExportReportCsv();
    });
  }

  // Tab navigation
  if (e.tabHomeBtn) {
    e.tabHomeBtn.addEventListener('click', () => {
      if (callbacks.onTabChange) callbacks.onTabChange('home');
    });
  }
  if (e.tabHistoryBtn) {
    e.tabHistoryBtn.addEventListener('click', () => {
      if (callbacks.onTabChange) callbacks.onTabChange('history');
    });
  }
  if (e.tabReportsBtn) {
    e.tabReportsBtn.addEventListener('click', () => {
      if (callbacks.onTabChange) callbacks.onTabChange('reports');
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
