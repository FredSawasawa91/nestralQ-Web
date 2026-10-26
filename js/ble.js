// Bluetooth (Web Bluetooth) connection to the ESP32
// Works in Chrome / Edge on https pages, and inside Electron.
// UUIDs and command format match the mobile app.

(function () {
  const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
  const RX_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8'; // write to ESP32
  const TX_UUID = 'beb5483f-36e1-4688-b7f5-ea07361b26a8'; // notifications from ESP32

  let device = null;
  let rx = null;
  let tx = null;
  let ready = false;
  let handlers = {};
  let chain = Promise.resolve(); // GATT operations must not overlap

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const isSupported = () => typeof navigator !== 'undefined' && !!navigator.bluetooth;
  const isConnected = () => !!(ready && device && device.gatt && device.gatt.connected && rx);

  function friendlyError(error) {
    const msg = (error && error.message) || '';
    if (/adapter/i.test(msg)) return 'No Bluetooth adapter found on this computer.';
    if (/No Services matching|No Characteristics matching/i.test(msg)) {
      return 'That device does not expose the NestralQ Bluetooth service. Check the UUIDs in the ESP32 firmware.';
    }
    switch (error && error.name) {
      case 'NotFoundError': return 'No ESP32 was selected, or none was found nearby.';
      case 'SecurityError': return 'Bluetooth needs a secure page (https) and a direct click.';
      case 'NotAllowedError': return 'Bluetooth permission was denied.';
      case 'NetworkError': return 'Could not connect. Make sure the ESP32 is powered and not connected to another device.';
      default: return msg || 'Bluetooth error.';
    }
  }

  function onNotify(event) {
    if (handlers.onData) handlers.onData(decoder.decode(event.target.value));
  }

  function onDisconnected() {
    const wasReady = ready;
    teardown();
    if (wasReady && handlers.onConnectionChange) handlers.onConnectionChange(false);
  }

  function teardown() {
    if (tx) {
      try { tx.removeEventListener('characteristicvaluechanged', onNotify); } catch (e) { /* ignore */ }
    }
    if (device) device.removeEventListener('gattserverdisconnected', onDisconnected);
    const old = device;
    device = null;
    rx = null;
    tx = null;
    ready = false;
    return old;
  }

  // Must be called from a click handler (the browser shows a device picker)
  async function connect(h) {
    if (!isSupported()) {
      throw new Error('Web Bluetooth is not supported here. Use Chrome or Edge, or the desktop app.');
    }
    handlers = h || {};
    const stale = teardown();
    if (stale && stale.gatt && stale.gatt.connected) stale.gatt.disconnect();

    try {
      const picked = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: 'ESP32' },
          { namePrefix: 'ESP_' },
          { services: [SERVICE_UUID] },
        ],
        optionalServices: [SERVICE_UUID],
      });
      device = picked;
      device.addEventListener('gattserverdisconnected', onDisconnected);

      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(SERVICE_UUID);
      rx = await service.getCharacteristic(RX_UUID);
      tx = await service.getCharacteristic(TX_UUID);
      tx.addEventListener('characteristicvaluechanged', onNotify);
      await tx.startNotifications();
      ready = true;
      return device.name || 'ESP32';
    } catch (error) {
      const failed = teardown();
      if (failed && failed.gatt && failed.gatt.connected) failed.gatt.disconnect();
      throw new Error(friendlyError(error));
    }
  }

  function disconnect() {
    const old = teardown();
    if (old && old.gatt && old.gatt.connected) old.gatt.disconnect();
  }

  async function writeNow(text) {
    if (!isConnected()) throw new Error('Not connected to the ESP32.');
    const data = encoder.encode(text);
    const props = rx.properties || {};
    if (props.write === false && props.writeWithoutResponse && rx.writeValueWithoutResponse) {
      return rx.writeValueWithoutResponse(data);
    }
    return rx.writeValueWithResponse ? rx.writeValueWithResponse(data) : rx.writeValue(data);
  }

  function writeCommand(text) {
    const p = chain.then(() => writeNow(text));
    chain = p.catch(() => { });
    return p;
  }

  // Format: temp,hum,light,motion,fan,heater,bulb,buzzer,auto,min,max
  function parseData(text) {
    const v = String(text).trim().split(',');
    if (v.length < 11) {
      console.warn('[BLE] Invalid data format:', text);
      return null;
    }
    const on = (i) => v[i].trim() === '1';
    return {
      temperature: parseFloat(v[0]) || 0,
      humidity: parseFloat(v[1]) || 0,
      lightIntensity: parseInt(v[2], 10) || 0,
      motionDetected: on(3) ? 1 : 0,
      fanState: on(4),
      heaterState: on(5),
      bulbState: on(6),
      autoMode: on(8),
      minTemp: parseFloat(v[9]),
      maxTemp: parseFloat(v[10]),
    };
  }

  window.bleApi = { isSupported, isConnected, connect, disconnect, writeCommand, parseData };
})();
