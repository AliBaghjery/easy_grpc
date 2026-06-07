import Store from 'electron-store'
import { v4 as uuid } from 'uuid'
import type { IpcMain } from 'electron'
import type { GrpcProject } from '../../shared/types'
import { IPC } from '../../shared/types'

interface StoreSchema {
  projects: GrpcProject[]
}

const store = new Store<StoreSchema>({
  name: 'easy-grpc-projects',
  defaults: { projects: [] }
})

export function registerProjectHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IPC.PROJECT_LIST, () => {
    return store.get('projects', [])
  })

  ipcMain.handle(IPC.PROJECT_CREATE, (_event, project: Omit<GrpcProject, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString()
    const newProject: GrpcProject = {
      ...project,
      id: uuid(),
      createdAt: now,
      updatedAt: now
    }
    const projects = store.get('projects', [])
    store.set('projects', [...projects, newProject])
    return newProject
  })

  ipcMain.handle(IPC.PROJECT_UPDATE, (_event, updated: GrpcProject) => {
    const projects = store.get('projects', [])
    const idx = projects.findIndex((p) => p.id === updated.id)
    if (idx === -1) throw new Error(`Project ${updated.id} not found`)
    const patched = { ...updated, updatedAt: new Date().toISOString() }
    projects[idx] = patched
    store.set('projects', projects)
    return patched
  })

  ipcMain.handle(IPC.PROJECT_DELETE, (_event, id: string) => {
    const projects = store.get('projects', [])
    store.set('projects', projects.filter((p) => p.id !== id))
    return { success: true }
  })
}
