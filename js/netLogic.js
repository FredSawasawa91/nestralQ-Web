// NET characteristic parser + Wi-Fi provisioning state machine.
(function (root) {
  const PROVISION_TIMEOUT_MS = 25000;
  const MAX_SSID_BYTES = 32;
  const MAX_PASS_BYTES = 63;
  const NET_STATES = ['DISCONNECTED', 'CONNECTING', 'CONNECTED', 'FAILED'];

  function utf8ByteLength(str) {
    const s = String(str);
    let n = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c < 0x80) n += 1;
      else if (c < 0x800) n += 2;
      else if (c >= 0xd800 && c <= 0xdbff) {
        const next = s.charCodeAt(i + 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          n += 4;
          i += 1;
        } else n += 3;
      } else n += 3;
    }
    return n;
  }

  function parseNetStatus(raw) {
    if (typeof raw !== 'string') return null;
    const parts = [];
    let rest = raw;
    for (let i = 0; i < 3; i++) {
      const idx = rest.indexOf(',');
      if (idx < 0) return null;
      parts.push(rest.slice(0, idx));
      rest = rest.slice(idx + 1);
    }
    parts.push(rest);
    const state = parts[0];
    if (NET_STATES.indexOf(state) === -1) return null;
    if (state === 'CONNECTED' ? !parts[1] : (parts[1] || parts[2])) return null;
    return {
      state: state,
      ip: parts[1],
      hostname: parts[2],
      ssid: parts[3],
    };
  }

  function netStatusLabel(net) {
    if (!net || !net.state || net.state === 'DISCONNECTED') return 'Not connected';
    if (net.state === 'CONNECTING') return 'Connecting...';
    if (net.state === 'CONNECTED') {
      const ssid = net.ssid || 'Wi-Fi';
      const ip = net.ip || '';
      return ip ? 'Connected to ' + ssid + ' at ' + ip : 'Connected to ' + ssid;
    }
    if (net.state === 'FAILED') return 'Failed: check name/password';
    return 'Not connected';
  }

  const FAILED_MESSAGE =
    'Could not connect. Check the name and password. The device kept its previous Wi-Fi.';
  const TIMEOUT_MESSAGE = 'Timed out waiting for the device. You can retry.';
  const BLE_LOST_MESSAGE =
    'Bluetooth disconnected during Wi-Fi setup. Reconnect and retry.';
  const IDLE = {
    phase: 'idle',
    error: null,
    baselineRevision: -1,
    lastRevision: -1,
    sawConnecting: false,
    pendingState: null,
  };

  function terminalState(state) {
    if (state === 'CONNECTED') return { phase: 'success', error: null };
    if (state === 'FAILED') return { phase: 'failed', error: FAILED_MESSAGE };
    return null;
  }

  function provisionReducer(state, action) {
    const s = state || IDLE;
    const type = action && action.type;
    const busy = s.phase === 'sending' || s.phase === 'waiting';

    switch (type) {
      case 'START':
        return {
          phase: 'sending',
          error: null,
          baselineRevision: Number.isInteger(action.baselineRevision) ? action.baselineRevision : -1,
          lastRevision: Number.isInteger(action.baselineRevision) ? action.baselineRevision : -1,
          sawConnecting: false,
          pendingState: null,
        };
      case 'SENT':
        if (s.phase !== 'sending') return s;
        return s.pendingState
          ? terminalState(s.pendingState)
          : { ...s, phase: 'waiting', error: null };
      case 'NET': {
        if (!busy) return s;
        const revision = Number.isInteger(action.revision) ? action.revision : s.lastRevision + 1;
        if (revision <= s.lastRevision || revision <= s.baselineRevision) return s;
        if (action.state === 'CONNECTING') {
          return { ...s, lastRevision: revision, sawConnecting: true };
        }
        if (
          (action.state !== 'CONNECTED' && action.state !== 'FAILED') ||
          !s.sawConnecting
        ) return { ...s, lastRevision: revision };
        if (s.phase === 'sending') {
          return { ...s, lastRevision: revision, pendingState: action.state };
        }
        return terminalState(action.state);
      }
      case 'TIMEOUT':
        if (!busy) return s;
        return { phase: 'timeout', error: TIMEOUT_MESSAGE };
      case 'BLE_LOST':
        if (!busy) return s;
        return { phase: 'error', error: BLE_LOST_MESSAGE };
      case 'ERROR':
        if (!busy) return s;
        return { phase: 'error', error: action.error || 'Wi-Fi setup failed. You can retry.' };
      case 'RESET':
        return { ...IDLE };
      default:
        return s;
    }
  }

  function validateWifiInput(ssid, password) {
    if (typeof ssid !== 'string' || ssid.length === 0) {
      return 'Enter the Wi-Fi name.';
    }
    if (utf8ByteLength(ssid) > MAX_SSID_BYTES) {
      return 'Wi-Fi name is too long.';
    }
    if (utf8ByteLength(password || '') > MAX_PASS_BYTES) {
      return 'Password is too long.';
    }
    return null;
  }

  const api = {
    parseNetStatus: parseNetStatus,
    netStatusLabel: netStatusLabel,
    provisionReducer: provisionReducer,
    validateWifiInput: validateWifiInput,
    utf8ByteLength: utf8ByteLength,
    PROVISION_TIMEOUT_MS: PROVISION_TIMEOUT_MS,
    MAX_SSID_BYTES: MAX_SSID_BYTES,
    MAX_PASS_BYTES: MAX_PASS_BYTES,
    FAILED_MESSAGE: FAILED_MESSAGE,
    TIMEOUT_MESSAGE: TIMEOUT_MESSAGE,
    BLE_LOST_MESSAGE: BLE_LOST_MESSAGE,
  };

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.NestralQNet = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
