import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import type {
  GrpcProject,
  ProtoService,
  ProtoMethod,
  GrpcCallResponse,
  GrpcMetadataEntry,
  Tab
} from '../../../shared/types'

// ProtoService used in openTab signature
type _ProtoService = ProtoService

function tabKey(projectId: string, service: ProtoService, method: ProtoMethod): string {
  return `${projectId}:${service.fullName}:${method.name}`
}

function buildDefaultPayload(method: ProtoMethod): string {
  return JSON.stringify(buildFieldDefaults(method.requestFields ?? []), null, 2)
}

function buildFieldDefaults(
  fields: import('../../../shared/types').ProtoField[]
): Record<string, unknown> {
  const obj: Record<string, unknown> = {}
  for (const field of fields) {
    if (field.repeated) {
      obj[field.name] = []
    } else if (field.fields !== undefined) {
      // Message type: build nested defaults, or {} when type is from another file
      obj[field.name] = field.fields.length > 0 ? buildFieldDefaults(field.fields) : {}
    } else if (field.enumValues && field.enumValues.length > 0) {
      obj[field.name] = field.enumValues[0]
    } else {
      obj[field.name] = getDefaultForType(field.type)
    }
  }
  return obj
}

function getDefaultForType(type: string): unknown {
  switch (type) {
    case 'string': return ''
    case 'bool': return false
    case 'int32':
    case 'int64':
    case 'uint32':
    case 'uint64':
    case 'sint32':
    case 'sint64':
    case 'fixed32':
    case 'fixed64':
    case 'sfixed32':
    case 'sfixed64':
    case 'float':
    case 'double': return 0
    case 'bytes': return ''
    default: return null
  }
}

interface AppState {
  // ── Projects ──────────────────────────────────────────────
  projects: GrpcProject[]
  setProjects: (projects: GrpcProject[]) => void
  addProject: (project: GrpcProject) => void
  updateProject: (project: GrpcProject) => void
  removeProject: (id: string) => void

  // ── Tabs ──────────────────────────────────────────────────
  tabs: Tab[]
  activeTabId: string | null
  /** Opens existing tab for method or creates a new one, then activates it */
  openTab: (project: GrpcProject, service: ProtoService, method: ProtoMethod) => void
  closeTab: (id: string) => void
  setActiveTab: (id: string) => void
  updateTab: (id: string, patch: Partial<Tab>) => void
  resetTabPayload: (id: string) => void
  activeTab: () => Tab | null

  // ── Loaded protos (services/methods per project) ──────────
  loadedProtos: Record<string, ProtoService[]>
  setLoadedProto: (projectId: string, services: ProtoService[]) => void

  // ── UI ────────────────────────────────────────────────────
  showProjectModal: boolean
  editingProject: GrpcProject | null
  openNewProjectModal: () => void
  openEditProjectModal: (project: GrpcProject) => void
  closeProjectModal: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // ── Projects ──────────────────────────────────────────────
  projects: [],
  setProjects: (projects) => set({ projects }),
  addProject: (project) => set((s) => ({ projects: [...s.projects, project] })),
  updateProject: (project) =>
    set((s) => ({ projects: s.projects.map((p) => (p.id === project.id ? project : p)) })),
  removeProject: (id) =>
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      tabs: s.tabs.filter((t) => t.projectId !== id),
      activeTabId:
        s.tabs.find((t) => t.id === s.activeTabId)?.projectId === id ? null : s.activeTabId
    })),

  // ── Tabs ──────────────────────────────────────────────────
  tabs: [],
  activeTabId: null,

  openTab: (project, service, method) => {
    const key = tabKey(project.id, service, method)
    const existing = get().tabs.find((t) => t.key === key)
    if (existing) {
      set({ activeTabId: existing.id })
      return
    }
    const newTab: Tab = {
      id: uuid(),
      key,
      projectId: project.id,
      service,
      method,
      requestPayload: buildDefaultPayload(method),
      requestMetadata: [{ key: '', value: '', enabled: true }],
      response: null,
      callLoading: false,
      activeCallId: null
    }
    set((s) => ({ tabs: [...s.tabs, newTab], activeTabId: newTab.id }))
  },

  closeTab: (id) =>
    set((s) => {
      const idx = s.tabs.findIndex((t) => t.id === id)
      const remaining = s.tabs.filter((t) => t.id !== id)
      let nextActive = s.activeTabId
      if (s.activeTabId === id) {
        // Activate the nearest remaining tab
        const next = remaining[idx] ?? remaining[idx - 1] ?? null
        nextActive = next?.id ?? null
      }
      return { tabs: remaining, activeTabId: nextActive }
    }),

  setActiveTab: (id) => set({ activeTabId: id }),

  updateTab: (id, patch) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t))
    })),

  resetTabPayload: (id) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === id ? { ...t, requestPayload: buildDefaultPayload(t.method) } : t
      )
    })),

  activeTab: () => {
    const { tabs, activeTabId } = get()
    return tabs.find((t) => t.id === activeTabId) ?? null
  },

  // ── Loaded protos ─────────────────────────────────────────
  loadedProtos: {},
  setLoadedProto: (projectId, services) =>
    set((s) => ({ loadedProtos: { ...s.loadedProtos, [projectId]: services } })),

  // ── UI ────────────────────────────────────────────────────
  showProjectModal: false,
  editingProject: null,
  openNewProjectModal: () => set({ showProjectModal: true, editingProject: null }),
  openEditProjectModal: (editingProject) => set({ showProjectModal: true, editingProject }),
  closeProjectModal: () => set({ showProjectModal: false, editingProject: null })
}))
