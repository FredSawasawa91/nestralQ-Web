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
    'reports-table-body', 'reports-chart-card', 'reports-chart-tabs',
    'reports-chart-readout', 'reports-chart-body',
    // Pagination
    'history-pagination', 'history-page-prev', 'history-page-next', 'history-page-label',
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
  window.ui.elements.historyPagination = document.getElementById('history-pagination');
  window.ui.elements.historyPagePrev = document.getElementById('history-page-prev');
  window.ui.elements.historyPageNext = document.getElementById('history-page-next');
  window.ui.elements.historyPageLabel = document.getElementById('history-page-label');

  // Reports element references
  window.ui.elements.reportsPeriod = document.getElementById('reports-period');
  window.ui.elements.exportReportCsvBtn = document.getElementById('export-report-csv-btn');
  window.ui.elements.repTotalDays = document.getElementById('rep-total-days');
  window.ui.elements.repAvgTemp = document.getElementById('rep-avg-temp');
  window.ui.elements.repMinTemp = document.getElementById('rep-min-temp');
  window.ui.elements.repMaxTemp = document.getElementById('rep-max-temp');
  window.ui.elements.reportsTableBody = document.getElementById('reports-table-body');
  window.ui.elements.reportsChartCard = document.getElementById('reports-chart-card');
  window.ui.elements.reportsChartTabs = document.getElementById('reports-chart-tabs');
  window.ui.elements.reportsChartReadout = document.getElementById('reports-chart-readout');
  window.ui.elements.reportsChartBody = document.getElementById('reports-chart-body');
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

const MALAWI_TZ = 'Africa/Blantyre';
const MALAWI_OFFSET_MS = 2 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const HISTORY_ITEMS_PER_PAGE = 15;
const CHART_HEIGHT = 190;
const CHART_MAX_BARS = 20;
const DAILY_MAX_DAYS = 14;
const HEATMAP_DAYS = 7;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PERIOD_MS = {
  '24h': DAY_MS,
  '7d': 7 * DAY_MS,
  '30d': 30 * DAY_MS,
  all: Infinity,
};
const CHART_COLORS = {
  primary: '#0ea5e9',
  hot: '#ef4444',
  cold: '#3b82f6',
  ok: '#22c55e',
};

window.ui._historyPage = 1;
window.ui._reportsChartType = 'bars';
window.ui._chartSelection = null;
window.ui._chartReadings = [];

const formatTs = (ts) => {
  if (!ts) return '-';
  const d = new Date(Number(ts) * 1000);
  return d.toLocaleString(undefined, {
    timeZone: MALAWI_TZ,
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const timestampMs = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n < 1e12 ? n * 1000 : n;
};

const filterByPeriod = (entries, period) => {
  const rangeMs = PERIOD_MS[period] != null ? PERIOD_MS[period] : Infinity;
  const now = Date.now();
  return (entries || []).filter((en) => {
    const ms = timestampMs(en.ts);
    if (ms == null) return false;
    return now - ms <= rangeMs;
  });
};

let historyChart = null;

window.ui.renderHistory = function (entries) {
  const e = window.ui.elements;
  const rangeSel = e.historyRange;
  const range = rangeSel ? rangeSel.value : '24h';
  const filtered = filterByPeriod(entries, range);

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

  // Table (paginated, 15 rows — same as the mobile app)
  const body = e.historyTableBody;
  const totalPages = Math.max(1, Math.ceil(filtered.length / HISTORY_ITEMS_PER_PAGE));
  const page = Math.min(Math.max(1, window.ui._historyPage || 1), totalPages);
  window.ui._historyPage = page;
  const startIndex = (page - 1) * HISTORY_ITEMS_PER_PAGE;
  const pageEntries = filtered.slice(startIndex, startIndex + HISTORY_ITEMS_PER_PAGE);

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
      pageEntries.forEach((en) => {
        const tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' + formatTs(en.ts) + '</td>' +
          '<td>' + (en.temperature != null ? Number(en.temperature).toFixed(1) : '-') + '</td>' +
          '<td>' + (en.humidity != null ? Number(en.humidity).toFixed(1) : '-') + '</td>' +
          '<td>' + (en.lightIntensity != null ? Math.round(en.lightIntensity) : '-') + '</td>' +
          '<td><span class="' + (en.motionDetected ? 'motion-yes' : 'motion-no') + '">' +
          (en.motionDetected ? 'Yes' : 'No') + '</span></td>';
        body.appendChild(tr);
      });
    }
  }

  if (e.historyPagination) {
    const showPager = filtered.length > 0;
    e.historyPagination.hidden = !showPager;
    if (e.historyPageLabel) e.historyPageLabel.textContent = 'Page ' + page + ' of ' + totalPages;
    if (e.historyPagePrev) e.historyPagePrev.disabled = page <= 1;
    if (e.historyPageNext) e.historyPageNext.disabled = page >= totalPages;
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

const localDay = (ts) => Math.floor((ts + MALAWI_OFFSET_MS) / DAY_MS);
const localHour = (ts) =>
  Math.floor(((((ts + MALAWI_OFFSET_MS) % DAY_MS) + DAY_MS) % DAY_MS) / HOUR_MS);
const dayLabel = (dayNumber) => {
  const date = new Date(dayNumber * DAY_MS);
  return MONTHS[date.getUTCMonth()] + ' ' + date.getUTCDate();
};
const pad2 = (n) => String(n).padStart(2, '0');
const computeScale = (rawMin, rawMax) => {
  const pad = Math.max(1, (rawMax - rawMin) * 0.15);
  const min = rawMin - pad;
  const max = rawMax + pad;
  return { min, max, range: max - min || 1 };
};
const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const lerpColor = (from, to, t) => {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return 'rgb(' + c[0] + ', ' + c[1] + ', ' + c[2] + ')';
};
const heatColor = (t) => {
  if (t <= 0.5) return lerpColor(CHART_COLORS.cold, CHART_COLORS.ok, t * 2);
  return lerpColor(CHART_COLORS.ok, CHART_COLORS.hot, (t - 0.5) * 2);
};

const normalizeReadings = (entries) => {
  return (entries || [])
    .map((item, index) => {
      const timestamp = timestampMs(item.ts);
      const value = item.temperature == null || item.temperature === ''
        ? null
        : Number(item.temperature);
      return {
        id: String(item.id || item.key || (timestamp ?? 'unknown') + '-' + index),
        timestamp,
        value: Number.isFinite(value) ? value : null,
        sensorName: item.sensorName || item.deviceName || item.deviceId || 'Unknown sensor',
      };
    })
    .filter((item) => item.timestamp !== null)
    .sort((a, b) => b.timestamp - a.timestamp);
};

const setReadout = (title, meta, hint) => {
  const el = window.ui.elements.reportsChartReadout;
  if (!el) return;
  if (title) {
    el.innerHTML =
      '<div class="chart-readout-value">' + title + '</div>' +
      '<div class="chart-readout-meta">' + meta + '</div>';
  } else {
    el.innerHTML = '<div class="chart-readout-meta">' + hint + '</div>';
  }
};

const legendHtml = (items) => {
  return '<div class="chart-legend">' + items.map((item) => {
    const mark = item.tick
      ? '<span class="chart-legend-tick" style="background:' + item.color + '"></span>'
      : '<span class="chart-legend-dot" style="background:' + item.color + '"></span>';
    return '<span class="chart-legend-item">' + mark + item.label + '</span>';
  }).join('') + '</div>';
};

function renderReadingsBarChart(readings) {
  const body = window.ui.elements.reportsChartBody;
  const data = readings.filter((r) => r.value !== null).slice(0, CHART_MAX_BARS).reverse();
  if (data.length < 2) {
    setReadout(null, null, '');
    body.innerHTML = '<p class="chart-empty">Not enough data to draw a chart.</p>';
    return;
  }

  const vals = data.map((d) => d.value);
  const rawMin = Math.min.apply(null, vals);
  const rawMax = Math.max.apply(null, vals);
  const scale = computeScale(rawMin, rawMax);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const avgBottom = ((avg - scale.min) / scale.range) * CHART_HEIGHT;

  const barColor = (v) => {
    if (v >= avg + (rawMax - avg) * 0.5) return CHART_COLORS.hot;
    if (v <= avg - (avg - rawMin) * 0.5) return CHART_COLORS.cold;
    return CHART_COLORS.primary;
  };

  const selected = window.ui._chartSelection;
  const selectedItem = selected != null && selected < data.length ? data[selected] : null;
  setReadout(
    selectedItem ? selectedItem.value.toFixed(1) + '°' : null,
    selectedItem ? selectedItem.sensorName + ' · ' + formatTs(selectedItem.timestamp / 1000) : null,
    'Tap a bar to see its reading'
  );

  const bars = data.map((d, i) => {
    const h = Math.max(3, ((d.value - scale.min) / scale.range) * CHART_HEIGHT);
    const opacity = selected == null || selected === i ? 1 : 0.4;
    return (
      '<button type="button" class="chart-bar-slot" data-index="' + i + '">' +
        '<span class="chart-bar" style="height:' + h + 'px;background:' + barColor(d.value) +
        ';opacity:' + opacity + '"></span>' +
      '</button>'
    );
  }).join('');

  body.innerHTML =
    '<div class="chart-row">' +
      '<div class="chart-y-axis">' +
        '<span>' + scale.max.toFixed(0) + '°</span>' +
        '<span>' + ((scale.max + scale.min) / 2).toFixed(0) + '°</span>' +
        '<span>' + scale.min.toFixed(0) + '°</span>' +
      '</div>' +
      '<div class="chart-plot">' +
        '<div class="chart-avg-line" style="bottom:' + avgBottom + 'px"></div>' +
        bars +
      '</div>' +
    '</div>' +
    '<div class="chart-x-axis">' +
      '<span>' + formatTs(data[0].timestamp / 1000) + '</span>' +
      '<span>' + formatTs(data[data.length - 1].timestamp / 1000) + '</span>' +
    '</div>' +
    legendHtml([
      { color: CHART_COLORS.hot, label: 'High' },
      { color: CHART_COLORS.primary, label: 'Normal' },
      { color: CHART_COLORS.cold, label: 'Low' },
      { color: CHART_COLORS.ok, label: 'Average' },
    ]);

  body.querySelectorAll('.chart-bar-slot').forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.index);
      window.ui._chartSelection = window.ui._chartSelection === i ? null : i;
      renderReadingsBarChart(readings);
    });
  });
}

function renderDailyRangeChart(readings) {
  const body = window.ui.elements.reportsChartBody;
  const map = new Map();
  readings.forEach((r) => {
    if (r.value === null) return;
    const day = localDay(r.timestamp);
    const entry = map.get(day);
    if (!entry) {
      map.set(day, { day, min: r.value, max: r.value, sum: r.value, count: 1 });
    } else {
      entry.min = Math.min(entry.min, r.value);
      entry.max = Math.max(entry.max, r.value);
      entry.sum += r.value;
      entry.count += 1;
    }
  });
  const days = Array.from(map.values())
    .sort((a, b) => a.day - b.day)
    .slice(-DAILY_MAX_DAYS)
    .map((entry) => Object.assign({}, entry, { avg: entry.sum / entry.count }));

  if (days.length === 0) {
    setReadout(null, null, '');
    body.innerHTML = '<p class="chart-empty">No temperature readings in this period.</p>';
    return;
  }

  const rawMin = Math.min.apply(null, days.map((d) => d.min));
  const rawMax = Math.max.apply(null, days.map((d) => d.max));
  const scale = computeScale(rawMin, rawMax);
  const selected = window.ui._chartSelection;
  const selectedDay = selected != null && selected < days.length ? days[selected] : null;
  setReadout(
    selectedDay ? selectedDay.min.toFixed(1) + '° – ' + selectedDay.max.toFixed(1) + '°' : null,
    selectedDay
      ? dayLabel(selectedDay.day) + ' · avg ' + selectedDay.avg.toFixed(1) + '° · ' + selectedDay.count + ' readings'
      : null,
    'Tap a day to see its lowest, highest and average'
  );

  const bars = days.map((d, i) => {
    const bottom = ((d.min - scale.min) / scale.range) * CHART_HEIGHT;
    const height = Math.max(4, ((d.max - d.min) / scale.range) * CHART_HEIGHT);
    const avgInBar = Math.min(height - 2, Math.max(0, ((d.avg - d.min) / scale.range) * CHART_HEIGHT));
    const opacity = selected == null || selected === i ? 1 : 0.4;
    return (
      '<button type="button" class="chart-range-slot" data-index="' + i + '">' +
        '<span class="chart-range-bar" style="bottom:' + bottom + 'px;height:' + height +
        'px;opacity:' + opacity + '">' +
          '<span class="chart-range-avg" style="bottom:' + avgInBar + 'px"></span>' +
        '</span>' +
      '</button>'
    );
  }).join('');

  body.innerHTML =
    '<div class="chart-row">' +
      '<div class="chart-y-axis">' +
        '<span>' + scale.max.toFixed(0) + '°</span>' +
        '<span>' + ((scale.max + scale.min) / 2).toFixed(0) + '°</span>' +
        '<span>' + scale.min.toFixed(0) + '°</span>' +
      '</div>' +
      '<div class="chart-plot">' + bars + '</div>' +
    '</div>' +
    '<div class="chart-x-axis">' +
      '<span>' + dayLabel(days[0].day) + '</span>' +
      (days.length > 1 ? '<span>' + dayLabel(days[days.length - 1].day) + '</span>' : '') +
    '</div>' +
    legendHtml([
      { color: CHART_COLORS.primary, label: 'Lowest to highest' },
      { color: 'currentColor', label: 'Daily average', tick: true },
    ]);

  body.querySelectorAll('.chart-range-slot').forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.index);
      window.ui._chartSelection = window.ui._chartSelection === i ? null : i;
      renderDailyRangeChart(readings);
    });
  });
}

function renderHeatmapChart(readings) {
  const body = window.ui.elements.reportsChartBody;
  const valid = readings.filter((r) => r.value !== null);
  if (valid.length === 0) {
    setReadout(null, null, '');
    body.innerHTML = '<p class="chart-empty">No temperature readings in this period.</p>';
    return;
  }

  const lastDay = localDay(valid[0].timestamp);
  const firstDay = lastDay - (HEATMAP_DAYS - 1);
  const cellMap = new Map();
  valid.forEach((r) => {
    const day = localDay(r.timestamp);
    if (day < firstDay || day > lastDay) return;
    const key = day + '-' + localHour(r.timestamp);
    const entry = cellMap.get(key);
    if (!entry) cellMap.set(key, { sum: r.value, count: 1 });
    else { entry.sum += r.value; entry.count += 1; }
  });

  let rawMin = Infinity;
  let rawMax = -Infinity;
  cellMap.forEach((entry) => {
    const avg = entry.sum / entry.count;
    rawMin = Math.min(rawMin, avg);
    rawMax = Math.max(rawMax, avg);
  });

  if (rawMin === Infinity) {
    setReadout(null, null, '');
    body.innerHTML = '<p class="chart-empty">No temperature readings in this period.</p>';
    return;
  }

  const rows = [];
  for (let day = lastDay; day >= firstDay; day -= 1) {
    const cells = [];
    for (let hour = 0; hour < 24; hour += 1) {
      const entry = cellMap.get(day + '-' + hour);
      cells.push(entry ? { hour, avg: entry.sum / entry.count, count: entry.count } : null);
    }
    rows.push({ day, cells });
  }

  const selected = window.ui._chartSelection;
  const selectedCell = selected
    ? (rows.find((row) => row.day === selected.day) || { cells: [] }).cells[selected.hour]
    : null;
  setReadout(
    selectedCell ? selectedCell.avg.toFixed(1) + '°' : null,
    selectedCell
      ? dayLabel(selected.day) + ' · ' + pad2(selected.hour) + ':00 – ' +
        pad2((selected.hour + 1) % 24) + ':00 · ' + selectedCell.count + ' readings'
      : null,
    "Tap a cell to see that hour's average"
  );

  const spread = rawMax - rawMin;
  const hourLabels = Array.from({ length: 24 }, (_, hour) => {
    return '<div class="heat-hour-slot">' +
      (hour % 6 === 0 ? '<span class="heat-hour-text">' + pad2(hour) + '</span>' : '') +
      '</div>';
  }).join('');

  const emptyBg = getComputedStyle(document.documentElement).getPropertyValue('--bg-color').trim() || '#eee';
  const grid = rows.map((row) => {
    const cells = row.cells.map((cell, hour) => {
      const isSelected = selected && selected.day === row.day && selected.hour === hour;
      if (!cell) {
        return '<span class="heat-cell" style="background:' + emptyBg + '"></span>';
      }
      const t = spread > 0 ? (cell.avg - rawMin) / spread : 0.5;
      return (
        '<button type="button" class="heat-cell" data-day="' + row.day + '" data-hour="' + hour +
        '" style="background:' + heatColor(t) +
        (isSelected ? ';outline:1.5px solid currentColor' : '') + '"></button>'
      );
    }).join('');
    return '<div class="heat-row"><span class="heat-label">' + dayLabel(row.day) +
      '</span><div class="heat-cells">' + cells + '</div></div>';
  }).join('');

  const swatches = [0, 0.25, 0.5, 0.75, 1].map((t) =>
    '<span class="heat-legend-swatch" style="background:' + heatColor(t) + '"></span>'
  ).join('');

  body.innerHTML =
    '<div class="heat-hour-row">' + hourLabels + '</div>' +
    grid +
    '<div class="heat-legend">' +
      '<span>' + rawMin.toFixed(1) + '°</span>' + swatches +
      '<span>' + rawMax.toFixed(1) + '°</span>' +
      '<span class="heat-legend-empty">' +
        '<span class="heat-legend-swatch" style="background:' + emptyBg + '"></span>No data' +
      '</span>' +
    '</div>';

  body.querySelectorAll('.heat-cell[data-day]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = { day: Number(btn.dataset.day), hour: Number(btn.dataset.hour) };
      const cur = window.ui._chartSelection;
      window.ui._chartSelection = cur && cur.day === next.day && cur.hour === next.hour ? null : next;
      renderHeatmapChart(readings);
    });
  });
}

window.ui.renderReportsCharts = function (entries) {
  const e = window.ui.elements;
  if (!e.reportsChartBody) return;

  window.ui._chartSourceEntries = entries;
  const readings = normalizeReadings(entries);
  window.ui._chartReadings = readings;

  const type = window.ui._reportsChartType || 'bars';
  if (e.reportsChartTabs) {
    e.reportsChartTabs.querySelectorAll('.chart-segment-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.chart === type);
    });
  }

  if (type === 'range') renderDailyRangeChart(readings);
  else if (type === 'heatmap') renderHeatmapChart(readings);
  else renderReadingsBarChart(readings);
};

const formatDayKey = (key) => {
  if (!key) return '-';
  const d = new Date(key + 'T00:00:00Z');
  return d.toLocaleDateString(undefined, {
    timeZone: MALAWI_TZ,
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
};

window.ui.renderReports = function (entries) {
  const e = window.ui.elements;
  const periodSel = e.reportsPeriod;
  const period = periodSel ? periodSel.value : 'all';
  const filtered = filterByPeriod(entries, period);

  const groups = {};
  filtered.forEach((en) => {
    const ms = timestampMs(en.ts);
    if (ms == null) return;
    const key = new Date(ms + MALAWI_OFFSET_MS).toISOString().split('T')[0];
    if (!groups[key]) groups[key] = [];
    groups[key].push(en);
  });
  const keys = Object.keys(groups).sort().reverse();

  const computeStats = (groupEntries) => {
    const temps = groupEntries.map((en) => en.temperature).filter((v) => v != null && Number.isFinite(Number(v)));
    const humids = groupEntries.map((en) => en.humidity).filter((v) => v != null && Number.isFinite(Number(v)));
    const motions = groupEntries.filter((en) => en.motionDetected).length;
    return {
      count: groupEntries.length,
      avgTemp: temps.length ? (temps.reduce((a, b) => a + Number(b), 0) / temps.length).toFixed(1) : '-',
      minTemp: temps.length ? Math.min.apply(null, temps.map(Number)).toFixed(1) : '-',
      maxTemp: temps.length ? Math.max.apply(null, temps.map(Number)).toFixed(1) : '-',
      avgHumidity: humids.length
        ? (humids.reduce((a, b) => a + Number(b), 0) / humids.length).toFixed(1)
        : '-',
      motionCount: motions,
    };
  };

  const allTemps = filtered.map((en) => en.temperature).filter((v) => v != null && Number.isFinite(Number(v))).map(Number);
  if (e.repTotalDays) e.repTotalDays.textContent = keys.length;
  if (e.repAvgTemp) e.repAvgTemp.textContent = allTemps.length
    ? (allTemps.reduce((a, b) => a + b, 0) / allTemps.length).toFixed(1) + '°C'
    : '-';
  if (e.repMinTemp) e.repMinTemp.textContent = allTemps.length
    ? Math.min.apply(null, allTemps).toFixed(1) + '°C'
    : '-';
  if (e.repMaxTemp) e.repMaxTemp.textContent = allTemps.length
    ? Math.max.apply(null, allTemps).toFixed(1) + '°C'
    : '-';

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
          '<td>' + formatDayKey(key) + '</td>' +
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

  window.ui.renderReportsCharts(filtered);
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
      window.ui._historyPage = 1;
      if (callbacks.onRangeChange) callbacks.onRangeChange(e.historyRange.value);
    });
  }

  if (e.historyPagePrev) {
    e.historyPagePrev.addEventListener('click', () => {
      window.ui._historyPage = Math.max(1, (window.ui._historyPage || 1) - 1);
      window.ui.renderHistory(window.state.history || []);
    });
  }
  if (e.historyPageNext) {
    e.historyPageNext.addEventListener('click', () => {
      window.ui._historyPage = (window.ui._historyPage || 1) + 1;
      window.ui.renderHistory(window.state.history || []);
    });
  }

  if (e.reportsChartTabs) {
    e.reportsChartTabs.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-chart]');
      if (!btn) return;
      window.ui._reportsChartType = btn.dataset.chart;
      window.ui._chartSelection = null;
      window.ui.renderReportsCharts(window.ui._chartSourceEntries || window.state.history || []);
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
