const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('@e965/xlsx');
const { createReportWorkbook, prepareReportData } = require('./reportExport');

const now = Date.UTC(2026, 10, 8, 12);

const entries = [
  { ts: now / 1000 - 180, temperature: 20, humidity: 45, lightIntensity: 10, motionDetected: false },
  { ts: now / 1000 - 120, temperature: 30, humidity: 65, lightIntensity: 30, motionDetected: true },
  { ts: now / 1000 - 60, temperature: 25, humidity: 55, lightIntensity: 20, motionDetected: true },
  { ts: now / 1000 - 30, temperature: 27, humidity: 50, lightIntensity: 15, motionDetected: false },
  { ts: now / 1000 + 5, temperature: 99, humidity: 99, lightIntensity: 99, motionDetected: true },
  { ts: 'not-a-date', temperature: 88 },
];

describe('report workbook export', () => {
  it('filters invalid and future timestamps and calculates accurate metrics and motion edges', () => {
    const { records, summary } = prepareReportData(entries, '24h', now);
    assert.equal(records.length, 4);
    assert.deepEqual(records.map((entry) => entry.timestamp), [
      now - 180000,
      now - 120000,
      now - 60000,
      now - 30000,
    ]);
    assert.deepEqual(summary.temperature, { count: 4, min: 20, max: 30, average: 25.5 });
    assert.deepEqual(summary.humidity, { count: 4, min: 45, max: 65, average: 53.75 });
    assert.deepEqual(summary.light, { count: 4, min: 10, max: 30, average: 18.75 });
    assert.equal(summary.motionDetections, 1);
  });

  it('includes all records and builds both workbook sheets from the filtered records', () => {
    const { workbook, records } = createReportWorkbook(entries, 'all', now);
    assert.deepEqual(workbook.SheetNames, ['Readings', 'Summary']);
    const readings = XLSX.utils.sheet_to_json(workbook.Sheets.Readings, { header: 1 });
    const summary = XLSX.utils.sheet_to_json(workbook.Sheets.Summary, { header: 1 });
    assert.equal(readings.length, records.length + 1);
    assert.equal(readings[1][2], 20);
    assert.equal(readings[1][5], 'Clear');
    assert.equal(summary.find((row) => row[0] === 'Readings')[1], records.length);
    assert.equal(summary.find((row) => row[0] === 'Motion detections')[1], 1);
  });

  it('supports metric-specific records, missing values, and first-positive motion readings', () => {
    const { records, summary } = prepareReportData([
      { timestamp: now - 1000, type: 'humidity', value: '40' },
      { timestamp: now, type: 'temperature', value: '21.5', motionDetected: 1 },
    ], 'all', now);
    assert.equal(records[0].humidity, 40);
    assert.equal(records[0].temperature, null);
    assert.equal(records[1].temperature, 21.5);
    assert.equal(summary.humidity.count, 1);
    assert.equal(summary.motionDetections, 1);
    assert.equal(summary.light.min, null);
    assert.equal(prepareReportData(entries.concat({
      ts: now / 1000 - 8 * 24 * 60 * 60,
      temperature: 18,
    }), '7d', now).records.length, 4);
  });

  it('serializes as a readable XLSX workbook', () => {
    const { workbook } = createReportWorkbook(entries, '24h', now);
    const bytes = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const parsed = XLSX.read(bytes, { type: 'buffer' });
    assert.deepEqual(parsed.SheetNames, ['Readings', 'Summary']);
  });
});
