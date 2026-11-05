// Local Wi-Fi connection: talks straight to the ESP32 web server on the LAN.
//   GET /status          -> JSON with sensors, outputs, auto mode, thresholds
//   GET /cmd?c=FAN:1     -> same command strings as Bluetooth
// Works in the Electron app. NOT available on https pages (mixed content).

(function () {
  const TIMEOUT_MS = 8000;
  const POLL_MS = 1500;
  const RETRY_MS = 3000;
  const MAX_FAILS = 3;

  let gen = 0; // bumped by stop(), cancels any older start() or poll loop
  let active = false;
  let timer = null;
  let ip = null;
  let failures = 0;
  let linked = false;
  let handlers = {};

  const isAvailable = () => location.protocol !== 'https:';

  const isValidIp = (value) =>
    /^(\d{1,3}\.){3}\d{1,3}$/.test(value) && value.split('.').every((n) => Number(n) <= 255);

  function unreachable(address) {
    return new Error(
      'Cannot reach ' + address + '. Check that this computer and the ESP32 are on the same Wi-Fi.'
    );
  }

  function isReachabilityError(error) {
    const name = error && error.name;
    const msg = String((error && error.message) || error || '');
    return (
      name === 'AbortError' ||
      error instanceof TypeError ||
      /canceled|cancelled|aborted|timeout|failed to fetch|network|ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|ETIMEDOUT/i.test(msg)
    );
  }

  function parseJson(body) {
    try {
      return JSON.parse(body);
    } catch {
      throw new Error('ESP32 sent a reply that was not JSON.');
    }
  }

  async function requestViaMain(address, path) {
    const res = await window.esp32http.request('http://' + address + path);
    if (res.status < 200 || res.status >= 300) {
      throw new Error('ESP32 replied with status ' + res.status);
    }
    return parseJson(res.body);
  }

  async function requestViaFetch(address, path) {
    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch('http://' + address + path, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store',
        mode: 'cors',
        targetAddressSpace: 'local',
      });
      if (!res.ok) throw new Error('ESP32 replied with status ' + res.status);
      return await res.json();
    } finally {
      clearTimeout(abortTimer);
    }
  }

  async function request(address, path) {
    try {
      if (window.esp32http && typeof window.esp32http.request === 'function') {
        return await requestViaMain(address, path);
      }
      return await requestViaFetch(address, path);
    } catch (error) {
      if (isReachabilityError(error)) throw unreachable(address);
      throw error;
    }
  }

  async function getStatus(address) {
    const d = await request(address, '/status');
    return {
      temperature: Number(d.temperature) || 0,
      humidity: Number(d.humidity) || 0,
      lightIntensity: Number(d.light) || 0,
      motionDetected: d.motion ? 1 : 0,
      fanState: !!d.fan,
      heaterState: !!d.heater,
      bulbState: !!d.bulb,
      autoMode: !!d.auto,
      minTemp: Number(d.min),
      maxTemp: Number(d.max),
    };
  }

  async function tick(my) {
    if (my !== gen || !active) return;
    try {
      const status = await getStatus(ip);
      if (my !== gen) return;
      failures = 0;
      if (!linked) {
        linked = true;
        if (handlers.onLinkChange) handlers.onLinkChange(true, '');
      }
      if (handlers.onStatus) handlers.onStatus(status);
    } catch (error) {
      if (my !== gen) return;
      failures += 1;
      if (failures >= MAX_FAILS && linked) {
        linked = false;
        if (handlers.onLinkChange) handlers.onLinkChange(false, error.message);
      }
    }
    // keeps retrying by itself, so it recovers when the ESP32 or router comes back
    if (my === gen) timer = setTimeout(() => tick(my), linked ? POLL_MS : RETRY_MS);
  }

  function stop() {
    gen += 1;
    active = false;
    linked = false;
    if (timer) clearTimeout(timer);
    timer = null;
  }

  async function start(address, h) {
    const target = (address || '').trim();
    if (!isAvailable()) {
      throw new Error('Not available on this https page. Use the desktop app.');
    }
    if (!isValidIp(target)) {
      throw new Error('Enter the ESP32 IP address, for example 192.168.1.50.');
    }
    stop();
    const my = gen;
    handlers = h || {};

    const status = await getStatus(target); // fail fast on a wrong IP
    if (my !== gen) return false;

    ip = target;
    active = true;
    failures = 0;
    linked = true;
    if (handlers.onLinkChange) handlers.onLinkChange(true, '');
    if (handlers.onStatus) handlers.onStatus(status);
    timer = setTimeout(() => tick(my), POLL_MS);
    return true;
  }

  function sendCommand(command) {
    if (!active || !ip) return Promise.reject(new Error('Not connected to the ESP32.'));
    return request(ip, '/cmd?c=' + encodeURIComponent(command)).then(d => ({
      temperature: Number(d.temperature) || 0,
      humidity: Number(d.humidity) || 0,
      lightIntensity: Number(d.light) || 0,
      motionDetected: d.motion ? 1 : 0,
      fanState: !!d.fan,
      heaterState: !!d.heater,
      bulbState: !!d.bulb,
      autoMode: !!d.auto,
      minTemp: Number(d.min),
      maxTemp: Number(d.max),
    }));
  }

  window.localApi = { isAvailable, isValidIp, start, stop, sendCommand };
})();
