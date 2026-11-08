const XLSX = require('@e965/xlsx');

const DAY_MS = 24 * 60 * 60 * 1000;
const PERIOD_DAYS = { '24h': 1, '7d': 7, '30d': 30 };

function toTimestampMs(value) {
  if (typeof value === 'string' && value.trim() && Number.isNaN(Number(value))) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return number < 1e12 ? number * 1000 : number;
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toBoolean(value) {
  if (value === true || value === 1 || value === '1' || value === 'true') return true;
  if (value === false || value === 0 || value === '0' || value === 'false') return false;
  return null;
}

function metricValue(entry, field, typeNames) {
  const direct = toNumber(entry[field]);
  if (direct !== null) return direct;

  const type = String(entry.type || entry.metric || entry.kind || '').toLowerCase();
  if (!typeNames.some((name) => type.includes(name))) return null;
  return toNumber(entry.value ?? entry.reading ?? entry.currentValue);
}

function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const timestamp = toTimestampMs(entry.ts ?? entry.timestamp ?? entry.time ?? entry.date);
  if (timestamp === null) return null;
  return {
    timestamp,
    sensor: String(entry.sensorName ?? entry.sensor_name ?? entry.sensorId ?? entry.sensor_id ?? ''),
    temperature: metricValue(entry, 'temperature', ['temperature', 'thermal', 'temp']),
    humidity: metricValue(entry, 'humidity', ['humidity', 'humid']),
    light: metricValue(entry, 'lightIntensity', ['light', 'lux']),
    motion: toBoolean(entry.motionDetected ?? entry.motion ?? entry.motion_detected),
  };
}

function summarize(records) {
  const stats = (field) => {
    const values = records.map((entry) => entry[field]).filter((value) => value !== null);
    return {
      count: values.length,
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null,
      average: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
    };
  };

  let motionDetections = 0;
  let previousMotion = null;
  for (const entry of records) {
    if (entry.motion === null) continue;
    if (entry.motion && previousMotion !== true) motionDetections += 1;
    previousMotion = entry.motion;
  }

  return {
    readings: records.length,
    temperature: stats('temperature'),
    humidity: stats('humidity'),
    light: stats('light'),
    motionDetections,
  };
}

function prepareReportData(entries, period, now = Date.now()) {
  if (!Array.isArray(entries)) throw new TypeError('Report readings must be an array.');
  const days = PERIOD_DAYS[period];
  const cutoff = days ? now - days * DAY_MS : -Infinity;
  const records = entries
    .map(normalizeEntry)
    .filter((entry) => entry && entry.timestamp >= cutoff && entry.timestamp <= now)
    .sort((a, b) => a.timestamp - b.timestamp);
  return { records, summary: summarize(records) };
}

function createReportWorkbook(entries, period, now = Date.now()) {
  const { records, summary } = prepareReportData(entries, period, now);
  const readings = [
    ['Timestamp (UTC)', 'Sensor', 'Temperature (°C)', 'Humidity (%)', 'Light (lux)', 'Motion'],
    ...records.map((entry) => [
      new Date(entry.timestamp).toISOString(),
      entry.sensor,
      entry.temperature,
      entry.humidity,
      entry.light,
      entry.motion === null ? '' : entry.motion ? 'Detected' : 'Clear',
    ]),
  ];
  const summaryRows = [
    ['Metric', 'Value', 'Unit'],
    ['Selected period', period, ''],
    ['Readings', summary.readings, 'records'],
    ['Temperature readings', summary.temperature.count, 'readings'],
    ['Minimum temperature', summary.temperature.min, '°C'],
    ['Maximum temperature', summary.temperature.max, '°C'],
    ['Average temperature', summary.temperature.average, '°C'],
    ['Humidity readings', summary.humidity.count, 'readings'],
    ['Minimum humidity', summary.humidity.min, '%'],
    ['Maximum humidity', summary.humidity.max, '%'],
    ['Average humidity', summary.humidity.average, '%'],
    ['Light readings', summary.light.count, 'readings'],
    ['Minimum light', summary.light.min, 'lux'],
    ['Maximum light', summary.light.max, 'lux'],
    ['Average light', summary.light.average, 'lux'],
    ['Motion detections', summary.motionDetections, 'events'],
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(readings), 'Readings');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary');
  return { workbook, records, summary };
}

module.exports = { createReportWorkbook, prepareReportData };
