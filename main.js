const { app, BrowserWindow, Tray, Menu, Notification, ipcMain, session, nativeImage, screen } = require('electron');
const path = require('node:path');

let win = null;
let tray = null;
let quitting = false;

const iconPath = path.join(__dirname, 'build', 'icon.png');

function createWindow() {
  win = new BrowserWindow({
    width: 980,
    height: 720,
    minWidth: 760,
    minHeight: 560,
    backgroundColor: '#0f1219',
    title: 'Sois Focus',
    icon: iconPath,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false, // la détection doit continuer en arrière-plan
    },
  });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Fermer = réduire dans la barre système, la surveillance continue.
  win.on('close', (e) => {
    if (!quitting) {
      e.preventDefault();
      win.hide();
    }
  });
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 }));
  tray.setToolTip('Sois Focus');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Ouvrir Sois Focus', click: () => { win.show(); win.focus(); } },
      { type: 'separator' },
      { label: 'Quitter', click: () => { quitting = true; app.quit(); } },
    ]),
  );
  tray.on('click', () => { win.isVisible() ? win.hide() : (win.show(), win.focus()); });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });

  app.whenReady().then(() => {
    // Autorise uniquement la caméra pour notre propre fenêtre.
    session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => {
      cb(permission === 'media');
    });
    session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === 'media');

    createWindow();
    createTray();
  });

  app.on('before-quit', () => { quitting = true; });
  app.on('window-all-closed', () => { /* reste dans le tray */ });
}

// ---- Bords rouges : une fenêtre transparente, au-dessus de tout, non cliquable, par écran
let edgeWins = [];
function showEdges() {
  if (edgeWins.length) return;
  edgeWins = screen.getAllDisplays().map((d) => {
    const w = new BrowserWindow({
      x: d.bounds.x, y: d.bounds.y, width: d.bounds.width, height: d.bounds.height,
      transparent: true, frame: false, resizable: false, movable: false, focusable: false,
      skipTaskbar: true, hasShadow: false, alwaysOnTop: true, show: false,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
    });
    w.setAlwaysOnTop(true, 'screen-saver');
    w.setIgnoreMouseEvents(true);
    w.loadFile(path.join(__dirname, 'src', 'edge.html'));
    w.once('ready-to-show', () => w.showInactive());
    return w;
  });
}
function hideEdges() {
  for (const w of edgeWins) if (!w.isDestroyed()) w.destroy();
  edgeWins = [];
}
ipcMain.on('set-edges', (_e, on) => (on ? showEdges() : hideEdges()));

ipcMain.on('notify', (_e, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({ title: String(title).slice(0, 80), body: String(body).slice(0, 200), silent: true }).show();
  }
});

ipcMain.on('set-autostart', (_e, enabled) => {
  app.setLoginItemSettings({ openAtLogin: !!enabled });
});
ipcMain.handle('get-autostart', () => app.getLoginItemSettings().openAtLogin);
