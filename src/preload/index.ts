import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/types'
import type {
  GrpcProject,
  GrpcCallRequest,
  LoadedProto,
  GrpcCallResponse,
  PersistedProjectTabs
} from '../shared/types'

const api = {
  // ── Projects ──────────────────────────────────────────────
  listProjects: (): Promise<GrpcProject[]> =>
    ipcRenderer.invoke(IPC.PROJECT_LIST),

  createProject: (
    project: Omit<GrpcProject, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<GrpcProject> => ipcRenderer.invoke(IPC.PROJECT_CREATE, project),

  updateProject: (project: GrpcProject): Promise<GrpcProject> =>
    ipcRenderer.invoke(IPC.PROJECT_UPDATE, project),

  deleteProject: (id: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC.PROJECT_DELETE, id),

  // ── Proto loading ─────────────────────────────────────────
  loadProto: (project: GrpcProject): Promise<LoadedProto> =>
    ipcRenderer.invoke(IPC.PROTO_LOAD, project),

  pickProtoFile: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC.PROTO_PICK_FILE),

  pickProtoFolder: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC.PROTO_PICK_FOLDER),

  // ── gRPC calls ────────────────────────────────────────────
  invoke: (req: GrpcCallRequest & { project: GrpcProject }): Promise<GrpcCallResponse> =>
    ipcRenderer.invoke(IPC.GRPC_INVOKE, req),

  cancelCall: (callId: string): Promise<{ cancelled: boolean }> =>
    ipcRenderer.invoke(IPC.GRPC_CANCEL, callId),

  // ── Tab persistence ────────────────────────────────────────────────────────
  saveTabs: (projectId: string, data: PersistedProjectTabs): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC.TABS_SAVE, projectId, data),

  loadAllTabs: (): Promise<Record<string, PersistedProjectTabs>> =>
    ipcRenderer.invoke(IPC.TABS_LOAD_ALL),

  // ── Streaming events ──────────────────────────────────────
  onStreamData: (cb: (data: unknown) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: unknown) => cb(data)
    ipcRenderer.on(IPC.GRPC_STREAM_DATA, handler)
    return () => ipcRenderer.removeListener(IPC.GRPC_STREAM_DATA, handler)
  },

  onStreamEnd: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on(IPC.GRPC_STREAM_END, handler)
    return () => ipcRenderer.removeListener(IPC.GRPC_STREAM_END, handler)
  },

  onStreamError: (cb: (error: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, error: string) => cb(error)
    ipcRenderer.on(IPC.GRPC_STREAM_ERROR, handler)
    return () => ipcRenderer.removeListener(IPC.GRPC_STREAM_ERROR, handler)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
