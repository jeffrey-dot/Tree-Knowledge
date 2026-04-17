import { app, BrowserWindow, ipcMain } from 'electron'
import { getPreloadEntry, getRendererTarget } from './paths'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      preload: getPreloadEntry(__dirname),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  const rendererTarget = getRendererTarget(__dirname, process.env.VITE_DEV_SERVER_URL)

  if (rendererTarget.kind === 'url') {
    mainWindow.loadURL(rendererTarget.value)
  } else {
    mainWindow.loadFile(rendererTarget.value)
  }
}

app.whenReady().then(() => {
  // Register IPC handlers once during app startup
  ipcMain.handle('ping', () => 'pong from main!')

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
