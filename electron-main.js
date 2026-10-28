const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1000,
    minHeight: 640,
    title: 'School Fees Collection Manager',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    backgroundColor: '#080c14',
  });

  mainWindow.loadFile(path.join(__dirname, 'client', 'index.html'));
  mainWindow.setMenuBarVisibility(false);

  mainWindow.on('closed', function() { mainWindow = null; });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', function() {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function() {
  if (mainWindow === null) createWindow();
});

// ══════════════════════════════════════════════
//  IPC HANDLERS
// ══════════════════════════════════════════════

// 1) SMTP email sending
ipcMain.handle('send-email', async (event, payload) => {
  if (!payload || !payload.smtpHost) throw new Error('SMTP host is empty');
  if (!payload.fromEmail) throw new Error('From email is empty');
  if (!payload.appPassword) throw new Error('App password is empty');

  const port = Number(payload.smtpPort) || 587;
  const transporter = nodemailer.createTransport({
    host: payload.smtpHost,
    port: port,
    secure: port === 465, // 465 = implicit TLS/SSL, 587 = STARTTLS (handled automatically)
    auth: {
      user: payload.fromEmail,
      pass: payload.appPassword
    }
  });

  try {
    await transporter.sendMail({
      from: `"${payload.fromName || payload.fromEmail}" <${payload.fromEmail}>`,
      to: payload.toEmail,
      subject: payload.subject,
      html: payload.bodyHtml
    });
    return 'sent';
  } catch (err) {
    // Surface the real SMTP error message to the renderer (shows in the
    // app's debug banner) instead of a generic failure.
    throw new Error(err && err.message ? err.message : String(err));
  }
});

// 2) Native "Save As" dialog + write bytes (used for PDF receipts, JSON
//    backup export, and CSV export — all just save arbitrary bytes to a
//    user-chosen path)
ipcMain.handle('save-file-dialog', async (event, opts) => {
  const { defaultPath, filters, data } = opts || {};
  const result = await dialog.showSaveDialog(mainWindow, { defaultPath, filters });
  if (result.canceled || !result.filePath) return null;
  fs.writeFileSync(result.filePath, Buffer.from(data));
  return result.filePath;
});

// 3) Silent auto-backup — no dialog (this is the one that previously did
//    nothing at all in the packaged app). Written to Desktop/FeesManager-Backups
//    to match what the app's own UI already tells the user ("Backup Now to PC"
//    section in Settings).
ipcMain.handle('auto-backup', async (event, opts) => {
  const { fileName, data } = opts || {};
  const backupDir = path.join(app.getPath('desktop'), 'FeesManager-Backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const filePath = path.join(backupDir, fileName);
  fs.writeFileSync(filePath, Buffer.from(data));
  return filePath;
});

// 4) Native "Open" dialog + read the chosen file as text (used for restore
//    from JSON backup)
ipcMain.handle('open-file-dialog', async (event, opts) => {
  const { filters } = opts || {};
  const result = await dialog.showOpenDialog(mainWindow, {
    filters,
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths.length) return null;
  const text = fs.readFileSync(result.filePaths[0], 'utf8');
  return { path: result.filePaths[0], text };
});
