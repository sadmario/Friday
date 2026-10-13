import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell, session } from 'electron';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as http from 'http';

import * as fs from 'fs';

// Enforce single instance execution
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let backendProcess: ChildProcess | null = null;

const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;
const BACKEND_PORT = 8765;

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});


function checkBackendHealth(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${BACKEND_PORT}/api/health`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function startBackend(): Promise<void> {
  const isRunning = await checkBackendHealth();
  if (isRunning) {
    console.log('[Electron] Backend is already running on port', BACKEND_PORT);
    return;
  }

  const workspaceRoot = app.isPackaged ? path.dirname(app.getPath('exe')) : path.resolve(__dirname, '../../');
  let pythonExecutable = path.join(workspaceRoot, 'backend', '.venv', 'Scripts', 'python.exe');
  let effectiveCwd = workspaceRoot;

  if (app.isPackaged) {
    const resourcesPython = path.join(process.resourcesPath, 'backend', '.venv', 'Scripts', 'python.exe');
    if (fs.existsSync(resourcesPython)) {
      pythonExecutable = resourcesPython;
      effectiveCwd = process.resourcesPath;
    }
  }

  console.log('[Electron] Spawning Python backend at:', pythonExecutable);
  try {
    backendProcess = spawn(
      pythonExecutable,
      ['-m', 'uvicorn', 'app.main:app', '--app-dir', 'backend', '--host', '127.0.0.1', '--port', String(BACKEND_PORT)],
      {
        cwd: effectiveCwd,
        env: { ...process.env, PYTHONPATH: path.join(effectiveCwd, 'backend') },
        stdio: 'ignore',
        detached: false
      }
    );


    backendProcess.on('error', (err) => {
      console.error('[Electron] Failed to spawn backend process:', err);
    });
  } catch (err) {
    console.error('[Electron] Error starting backend:', err);
  }
}

function stopBackend(): void {
  if (backendProcess) {
    console.log('[Electron] Terminating Python backend process...');
    try {
      backendProcess.kill();
    } catch (e) {
      console.error('[Electron] Error terminating backend:', e);
    }
    backendProcess = null;
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    frame: false,
    backgroundColor: '#07090e',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../frontend/dist/index.html'));
  }

  const startHidden = process.argv.includes('--hidden') || process.argv.includes('--minimized');
  mainWindow.once('ready-to-show', () => {
    if (!startHidden) {
      mainWindow?.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}


function createTray(): void {
  // Create simple 16x16 cyan dot tray icon nativeImage
  const icon = nativeImage.createFromBuffer(
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYPj/n4EAYCIlDVIw4+j4H42mETSQmIBgGvA5gVbGMzIycjDFw4c0cQAA6V0Y05Dcv1oAAAAASUVORK5CYII=',
      'base64'
    )
  );

  tray = new Tray(icon);
  tray.setToolTip('F.R.I.D.A.Y. AI Desktop Assistant');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open F.R.I.D.A.Y.',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      }
    },
    {
      label: 'Hide Assistant',
      click: () => {
        mainWindow?.hide();
      }
    },
    { type: 'separator' },
    {
      label: 'Pause Voice',
      click: () => {
        mainWindow?.webContents.send('tray:action', 'pause_voice');
      }
    },
    {
      label: 'Disable Automation',
      click: () => {
        mainWindow?.webContents.send('tray:action', 'toggle_automation');
      }
    },
    { type: 'separator' },
    {
      label: 'Quit F.R.I.D.A.Y.',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });
}

// Window controls IPC
ipcMain.on('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.on('window:close', () => {
  mainWindow?.hide();
});

ipcMain.on('window:hide', () => {
  mainWindow?.hide();
});

ipcMain.handle('app:version', () => app.getVersion());

ipcMain.handle('startup:getLoginItemSettings', () => {
  return app.getLoginItemSettings();
});

ipcMain.handle('startup:setLoginItemSettings', (_, settings: { openAtLogin: boolean; openAsHidden?: boolean }) => {
  app.setLoginItemSettings({
    openAtLogin: settings.openAtLogin,
    openAsHidden: settings.openAsHidden ?? false,
    args: settings.openAsHidden ? ['--hidden'] : []
  });
  return app.getLoginItemSettings();
});

ipcMain.handle('app:openExternal', async (_, url: string) => {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    await shell.openExternal(url);
    return true;
  }
  return false;
});


app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true);
      return;
    }
    callback(false);
  });

  await startBackend();
  createWindow();
  createTray();


  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  stopBackend();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Keep running in tray unless explicitly quit
    // Or quit if user requested
  }
});
