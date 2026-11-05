const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  parseNetStatus,
  provisionReducer,
  validateWifiInput,
  FAILED_MESSAGE,
  TIMEOUT_MESSAGE,
  BLE_LOST_MESSAGE,
} = require('./netLogic.js');

describe('parseNetStatus', () => {
  it('parses a normal connected status', () => {
    assert.deepEqual(parseNetStatus('CONNECTED,192.168.0.177,smarthome.local,HomeWifi'), {
      state: 'CONNECTED',
      ip: '192.168.0.177',
      hostname: 'smarthome.local',
      ssid: 'HomeWifi',
    });
  });

  it('keeps commas in the SSID', () => {
    assert.deepEqual(parseNetStatus('CONNECTED,10.0.0.2,smarthome.local,Cafe, Floor 2'), {
      state: 'CONNECTED',
      ip: '10.0.0.2',
      hostname: 'smarthome.local',
      ssid: 'Cafe, Floor 2',
    });
  });

  it('accepts empty addresses for disconnected status', () => {
    assert.deepEqual(parseNetStatus('DISCONNECTED,,,OldNetwork'), {
      state: 'DISCONNECTED',
      ip: '',
      hostname: '',
      ssid: 'OldNetwork',
    });
  });

  it('ignores malformed status values', () => {
    assert.equal(parseNetStatus(null), null);
    assert.equal(parseNetStatus(''), null);
    assert.equal(parseNetStatus('CONNECTED,1.2.3.4'), null);
    assert.equal(parseNetStatus('CONNECTED,,,HomeWifi'), null);
    assert.equal(parseNetStatus('DISCONNECTED,1.2.3.4,host,HomeWifi'), null);
    assert.equal(parseNetStatus('UNKNOWN,1.2.3.4,host,ssid'), null);
  });
});

describe('Wi-Fi provisioning state machine', () => {
  const idle = { phase: 'idle', error: null };

  it('waits for the new attempt to connect, ignoring a previous connected state', () => {
    let state = provisionReducer(idle, { type: 'START', baselineRevision: 4 });
    state = provisionReducer(state, { type: 'NET', state: 'CONNECTED', revision: 4 });
    state = provisionReducer(state, { type: 'SENT' });
    state = provisionReducer(state, { type: 'NET', state: 'CONNECTED', revision: 5 });
    assert.equal(state.phase, 'waiting');
    state = provisionReducer(state, { type: 'NET', state: 'CONNECTING', revision: 6 });
    state = provisionReducer(state, { type: 'NET', state: 'CONNECTED', revision: 7 });
    assert.equal(state.phase, 'success');
  });

  it('handles a fast state transition while BLE writes are completing', () => {
    let state = provisionReducer(idle, { type: 'START' });
    state = provisionReducer(state, { type: 'NET', state: 'CONNECTING', revision: 1 });
    state = provisionReducer(state, { type: 'NET', state: 'CONNECTED', revision: 2 });
    state = provisionReducer(state, { type: 'SENT' });
    assert.equal(state.phase, 'success');
  });

  it('shows the previous-network failure message', () => {
    let state = provisionReducer(idle, { type: 'START' });
    state = provisionReducer(state, { type: 'SENT' });
    state = provisionReducer(state, { type: 'NET', state: 'CONNECTING', revision: 1 });
    state = provisionReducer(state, { type: 'NET', state: 'FAILED', revision: 2 });
    assert.equal(state.phase, 'failed');
    assert.equal(state.error, FAILED_MESSAGE);
  });

  it('times out active provisioning and reports Bluetooth disconnects', () => {
    let state = provisionReducer(idle, { type: 'START' });
    state = provisionReducer(state, { type: 'TIMEOUT' });
    assert.equal(state.error, TIMEOUT_MESSAGE);
    state = provisionReducer(idle, { type: 'START' });
    state = provisionReducer(state, { type: 'BLE_LOST' });
    assert.equal(state.error, BLE_LOST_MESSAGE);
  });
});

describe('Wi-Fi input validation', () => {
  it('validates presence and UTF-8 byte lengths without trimming SSIDs', () => {
    assert.equal(typeof validateWifiInput('', ''), 'string');
    assert.equal(validateWifiInput(' Home, 2nd floor', ''), null);
    assert.equal(validateWifiInput('😀'.repeat(8), ''), null);
    assert.equal(typeof validateWifiInput('😀'.repeat(9), ''), 'string');
  });
});
