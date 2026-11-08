const {
  app,
  BrowserWindow,
  shell,
  Menu,
  ipcMain,
  session,
  Notification,
  dialog,
} = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Allow only one window/instance of the app
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

// Web Bluetooth needs this switch on Linux (not needed on Windows or macOS)
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('enable-experimental-web-platform-features');
}

// Chromium otherwise cancels renderer fetch() to 192.168.x.x (Local Network Access).
app.commandLine.appendSwitch(
  'disable-features',
  'BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessRespectPreflightResults,LocalNetworkAccessChecks,LocalNetworkAccessChecksWebSockets'
);

function isPrivateIpv4(host) {
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) return false;
  const p = host.split('.').map(Number);
  if (p.some((n) => n > 255)) return false;
  return (
    p[0] === 10 ||
    p[0] === 127 ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168)
  );
}

function isLocalHostname(host) {
  return (
    typeof host === 'string' &&
    host.length <= 253 &&
    host.toLowerCase().endsWith('.local') &&
    host.split('.').every((part) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(part))
  );
}

function isAllowedEsp32Url(urlString) {
  let url;
  try {
    url = new URL(urlString);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:') return false;
  if (url.port && url.port !== '80') return false;
  if (!isPrivateIpv4(url.hostname) && !isLocalHostname(url.hostname)) return false;
  return url.pathname === '/status' || url.pathname === '/cmd';
}

ipcMain.handle('esp32-http', (_event, urlString) => {
  if (!isAllowedEsp32Url(urlString)) {
    return Promise.reject(new Error('Invalid ESP32 address.'));
  }
  return new Promise((resolve, reject) => {
    const req = http.get(urlString, { timeout: 8000 }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
    req.on('error', reject);
  });
});

ipcMain.on('desktop-notification', (event, notification) => {
  if (!win || event.sender !== win.webContents || !Notification.isSupported()) return;
  const title = typeof notification?.title === 'string'
    ? notification.title.slice(0, 100)
    : '';
  const body = typeof notification?.body === 'string'
    ? notification.body.slice(0, 300)
    : '';
  if (!title || !body) return;
  new Notification({ title, body }).show();
});

ipcMain.handle('save-report-workbook', async (event, payload) => {
  if (!win || event.sender !== win.webContents) {
    throw new Error('Report export is not available from this window.');
  }
  if (!payload || !Array.isArray(payload.entries)) {
    throw new TypeError('Report readings are invalid.');
  }
  const period = ['24h', '7d', '30d', 'all'].includes(payload.period)
    ? payload.period
    : 'all';
  const { createReportWorkbook } = require('./js/reportExport');
  const { workbook, records } = createReportWorkbook(payload.entries, period);
  if (records.length === 0) return { status: 'empty' };

  const result = await dialog.showSaveDialog(win, {
    defaultPath: path.join(app.getPath('documents'), `nestralq-report-${period}.xlsx`),
    filters: [{ name: 'Excel workbook', extensions: ['xlsx'] }],
  });
  if (result.canceled || !result.filePath) return { status: 'cancelled' };

  const XLSX = require('@e965/xlsx');
  const contents = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  await fs.promises.writeFile(result.filePath, contents);
  return { status: 'saved', count: records.length };
});

let win;

// Electron has no built-in Bluetooth device picker, so we choose the ESP32 ourselves.
// The page already filters by name/service, so this list only holds candidates.
const ESP_NAME = /esp32|esp_|smarthome|nestral/i;
const BT_SCAN_MS = 15000;
let btCallback = null;
let btTimer = null;

function setupBluetoothPicker(webContents) {
  webContents.on('select-bluetooth-device', (event, devices, callback) => {
    event.preventDefault();
    btCallback = callback;

    const match = devices.find((d) => ESP_NAME.test(d.deviceName || ''));
    if (match) {
      clearTimeout(btTimer);
      btTimer = null;
      btCallback = null;
      callback(match.deviceId);
      return;
    }

    // Nothing found yet: this event fires again as new devices appear.
    // Give up after a while so the page gets an error instead of waiting forever.
    if (!btTimer) {
      btTimer = setTimeout(() => {
        btTimer = null;
        if (btCallback) {
          btCallback(''); // cancels the request
          btCallback = null;
        }
      }, BT_SCAN_MS);
    }
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1000,
    height: 800,
    minWidth: 380,
    minHeight: 600,
    title: 'NestralQ',
    backgroundColor: '#1a1a1a',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const grantLocalNetwork = (permission) =>
    permission === 'local-network-access' || permission === 'local-network';

  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(grantLocalNetwork(permission) || true);
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
    if (grantLocalNetwork(permission)) return true;
    return true;
  });

  Menu.setApplicationMenu(null); // hides the default File/Edit/View menu
  setupBluetoothPicker(win.webContents);
  win.loadFile(path.join(__dirname, 'index.html'));

  // Open any external link in the user's browser, not inside the app
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // DevTools only while developing
  if (!app.isPackaged) win.webContents.openDevTools({ mode: 'detach' });
}

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});










/*const { app, BrowserWindow, shell, Menu, ipcMain, session } = require('electron');
const http = require('http');
const path = require('path');

// Allow only one window/instance of the app
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1000,
    height: 800,
    minWidth: 380,
    minHeight: 600,
    title: 'NestralQ',
    backgroundColor: '#1a1a1a',
    icon: path.join(__dirname, 'build', 'icon.png'), // optional, see Step 6
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  Menu.setApplicationMenu(null); // hides the default File/Edit/View menu
  win.loadFile(path.join(__dirname, 'index.html'));

  // Open any external link in the user's browser, not inside the app
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // DevTools only while developing
  if (!app.isPackaged) win.webContents.openDevTools({ mode: 'detach' });
}

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});*/