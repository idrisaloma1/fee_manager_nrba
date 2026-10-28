// preload.js
// Runs in an isolated context with access to Node APIs, bridging a small,
// explicit set of safe functions into the renderer (index.html) as
// window.electronAPI. Keeps contextIsolation:true and nodeIntegration:false
// intact — the renderer never gets raw Node/fs access, only these methods.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,

  // SMTP email — payload: {smtpHost, smtpPort, fromEmail, fromName, appPassword, toEmail, subject, bodyHtml}
  sendEmail: (payload) => ipcRenderer.invoke('send-email', payload),

  // Native "Save As" dialog + write bytes to the chosen path.
  // opts: {defaultPath, filters: [{name, extensions}], data: number[]}
  // Returns the chosen file path, or null if the user cancelled.
  saveFile: (opts) => ipcRenderer.invoke('save-file-dialog', opts),

  // Silent write to a fixed app-data backups folder (no dialog).
  // opts: {fileName, data: number[]} → returns the full path written to.
  autoBackup: (opts) => ipcRenderer.invoke('auto-backup', opts),

  // Native "Open" dialog + read the chosen file as UTF-8 text.
  // opts: {filters: [{name, extensions}]}
  // Returns {path, text}, or null if the user cancelled.
  openFile: (opts) => ipcRenderer.invoke('open-file-dialog', opts)
});
