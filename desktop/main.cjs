const { app, BrowserWindow, Menu, dialog, shell, session } = require('electron');
const path = require('node:path');
const { ORIGIN, internal, external } = require('./policy.cjs');
let window;
app.enableSandbox();
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
  app.whenReady().then(() => {
    const profile = session.fromPartition('persist:oryqen');
    profile.setPermissionRequestHandler((_contents, _permission, respond) => respond(false));
    profile.setPermissionCheckHandler(() => false);
    profile.on('will-download', event => event.preventDefault());
    window = new BrowserWindow({ width: 1280, height: 900, minWidth: 360, minHeight: 600, show: false,
      title: 'ORYQEN Preview', backgroundColor: '#eaf0ff',
      webPreferences: { partition: 'persist:oryqen', nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, allowRunningInsecureContent: false, webviewTag: false } });
    const goHome = () => window.loadURL(`${ORIGIN}/sign-in`).catch(() => {});
    const openExternal = async url => {
      if (!external(url)) return;
      const result = await dialog.showMessageBox(window, { type: 'question', buttons: ['Cancel', 'Open browser'], defaultId: 0, cancelId: 0, message: 'Open an external website?', detail: new URL(url).origin });
      if (result.response === 1) await shell.openExternal(url);
    };
    window.webContents.on('will-navigate', (event, url) => { if (!internal(url)) { event.preventDefault(); void openExternal(url); } });
    window.webContents.on('will-redirect', (event, url) => { if (!internal(url)) event.preventDefault(); });
    window.webContents.setWindowOpenHandler(({ url }) => { if (internal(url)) void window.loadURL(url); else void openExternal(url); return { action: 'deny' }; });
    window.webContents.on('will-attach-webview', event => event.preventDefault());
    window.webContents.on('did-fail-load', (_event, code, _description, _url, mainFrame) => {
      if (mainFrame && code !== -3) void window.loadFile(path.join(__dirname, 'offline.html'));
    });
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: 'ORYQEN', submenu: [{ label: 'Sign in / reconnect', click: goHome }, { label: 'Back', accelerator: 'Alt+Left', click: () => { if (window.webContents.navigationHistory.canGoBack()) window.webContents.navigationHistory.goBack(); } }, { role: 'reload' }, { type: 'separator' }, { role: 'quit' }] },
      { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
      { label: 'View', submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }] }
    ]));
    window.once('ready-to-show', () => window.show());
    goHome();
  });
  app.on('window-all-closed', () => app.quit());
}
