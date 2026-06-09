import { app, shell, BrowserWindow, ipcMain, dialog, Menu, MenuItem } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerProjectHandlers } from './store'
import { registerProtoHandlers } from './grpc/proto'
import { registerGrpcHandlers } from './grpc/client'
import { IPC } from '../shared/types'

let mainWindow: BrowserWindow | null = null

function buildMenu(): void {
  const isMac = process.platform === 'darwin'

  const send = (channel: string) => () => mainWindow?.webContents.send(channel)

  const template: (Electron.MenuItemConstructorOptions | MenuItem)[] = [
    // ── macOS app menu ─────────────────────────────────────────────────────
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' as const },
            { type: 'separator' as const },
            { role: 'hide' as const },
            { role: 'hideOthers' as const },
            { type: 'separator' as const },
            { role: 'quit' as const }
          ]
        }]
      : []),

    // ── File ───────────────────────────────────────────────────────────────
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project',
          accelerator: 'CmdOrCtrl+N',
          click: send(IPC.MENU_NEW_PROJECT)
        },
        { type: 'separator' as const },
        isMac
          ? { role: 'close' as const }
          : { label: 'Exit', role: 'quit' as const }
      ]
    },

    // ── Edit ───────────────────────────────────────────────────────────────
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const }
      ]
    },

    // ── View ───────────────────────────────────────────────────────────────
    {
      label: 'View',
      submenu: [
        {
          label: 'Search Methods…',
          accelerator: 'CmdOrCtrl+P',
          click: send(IPC.MENU_OPEN_SEARCH)
        },
        { type: 'separator' as const },
        ...(is.dev
          ? [
              { role: 'reload' as const },
              { role: 'forceReload' as const },
              { role: 'toggleDevTools' as const },
              { type: 'separator' as const }
            ]
          : []),
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const }
      ]
    },

    // ── Window (macOS) ─────────────────────────────────────────────────────
    ...(isMac
      ? [{
          label: 'Window',
          submenu: [
            { role: 'minimize' as const },
            { role: 'zoom' as const },
            { type: 'separator' as const },
            { role: 'front' as const }
          ]
        }]
      : []),

    // ── Help ───────────────────────────────────────────────────────────────
    {
      role: 'help' as const,
      submenu: [
        {
          label: 'About eASY gRPC',
          click: () =>
            dialog.showMessageBox({
              type: 'info',
              title: 'About eASY gRPC',
              message: 'eASY gRPC',
              detail: `Version ${app.getVersion()}\n\nA lightweight gRPC client.`
            })
        },
        {
          label: 'View on GitHub',
          click: () => shell.openExternal('https://github.com')
        }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#1a1d27',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: process.platform !== 'darwin',
    autoHideMenuBar: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.easy-grpc.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerProjectHandlers(ipcMain)
  registerProtoHandlers(ipcMain, dialog)
  registerGrpcHandlers(ipcMain)

  buildMenu()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

export { mainWindow }
