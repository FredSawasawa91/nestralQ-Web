const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');

// Allow only one window/instance of the app
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

// Web Bluetooth needs this switch on Linux (not needed on Windows or macOS)
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('enable-experimental-web-platform-features');
}

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
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
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










/*const { app, BrowserWindow, shell, Menu } = require('electron');
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