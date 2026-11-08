const { contextBridge, ipcRenderer } = require('electron');

// Renderer fetch() is blocked by Chromium's local-network checks.
// Talk to the ESP32 through the main process instead.
contextBridge.exposeInMainWorld('esp32http', {
  request: (url) => ipcRenderer.invoke('esp32-http', url),
});

contextBridge.exposeInMainWorld('desktopNotifications', {
  show: (notification) => ipcRenderer.send('desktop-notification', notification),
});

contextBridge.exposeInMainWorld('reportWorkbook', {
  save: (payload) => ipcRenderer.invoke('save-report-workbook', payload),
});
