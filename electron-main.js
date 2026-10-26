const { app, BrowserWindow, shell, Menu } = require('electron');
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
});