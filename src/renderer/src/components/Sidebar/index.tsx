import React, { useEffect, useState, useMemo } from 'react'
import { useAppStore } from '../../store/appStore'
import type { GrpcProject, ProtoService, ProtoMethod } from '../../../../shared/types'

export function Sidebar(): React.ReactElement {
  const { projects, setProjects, openNewProjectModal } = useAppStore()

  useEffect(() => {
    window.api.listProjects().then(setProjects)
  }, [])

  return (
    <aside className="flex flex-col w-64 min-w-[220px] max-w-xs h-full border-r border-border bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">Projects</span>
        <button
          onClick={openNewProjectModal}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-surface-overlay text-gray-400 hover:text-white transition-colors"
          title="New Project"
        >
          <PlusIcon />
        </button>
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto">
        {projects.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-xs leading-relaxed">
            No projects yet.<br />Click <strong>+</strong> to create one.
          </div>
        ) : (
          projects.map((p) => (
            <ProjectSection key={p.id} project={p} />
          ))
        )}
      </div>
    </aside>
  )
}

// ─── Per-project collapsible section ─────────────────────────────────────────

function ProjectSection({ project }: { project: GrpcProject }): React.ReactElement {
  const { openEditProjectModal, removeProject } = useAppStore()
  const [open, setOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [services, setServices] = useState<ProtoService[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  async function loadProto(): Promise<void> {
    setLoading(true)
    setError(null)
    const result = await window.api.loadProto(project)
    setLoading(false)
    if (result.error) {
      setError(result.error)
    } else {
      setServices(result.services)
    }
  }

  function handleToggle(): void {
    const next = !open
    setOpen(next)
    // Auto-load on first open
    if (next && services.length === 0 && !loading && !error) {
      loadProto()
    }
  }

  async function handleDelete(e: React.MouseEvent): Promise<void> {
    e.stopPropagation()
    setMenuOpen(false)
    await window.api.deleteProject(project.id)
    removeProject(project.id)
  }

  function handleEdit(e: React.MouseEvent): void {
    e.stopPropagation()
    setMenuOpen(false)
    openEditProjectModal(project)
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return services
    return services
      .map((svc) => {
        const svcMatch = svc.name.toLowerCase().includes(q) || svc.fullName.toLowerCase().includes(q)
        const matchedMethods = svc.methods.filter((m) => m.name.toLowerCase().includes(q))
        if (svcMatch || matchedMethods.length > 0) {
          return { ...svc, methods: svcMatch ? svc.methods : matchedMethods }
        }
        return null
      })
      .filter(Boolean) as ProtoService[]
  }, [services, query])

  return (
    <div className="border-b border-border/50">
      {/* Project header row */}
      <div
        className="group flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-surface-overlay transition-colors"
        onClick={handleToggle}
      >
        <ChevronIcon open={open} className="text-gray-500 flex-shrink-0" />
        <ServerIcon className="text-gray-500 flex-shrink-0" />
        <span className="flex-1 truncate text-sm text-gray-200">{project.name}</span>
        <span className={`text-[10px] px-1.5 rounded flex-shrink-0 ${project.useTls ? 'text-success bg-success/10' : 'text-gray-600 bg-surface-overlay'}`}>
          {project.useTls ? 'TLS' : 'INS'}
        </span>

        {/* Reload button */}
        {open && (
          <button
            onClick={(e) => { e.stopPropagation(); loadProto() }}
            className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center text-gray-500 hover:text-white transition-all"
            title="Reload proto"
          >
            <RefreshIcon spinning={loading} />
          </button>
        )}

        {/* Context menu */}
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v) }}
          className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded text-gray-500 hover:text-white transition-all"
        >
          <DotsIcon />
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setMenuOpen(false) }} />
            <div className="absolute right-2 mt-6 z-20 w-36 panel shadow-lg py-1 text-xs" style={{ marginTop: '1.5rem' }}>
              <button onClick={handleEdit} className="w-full text-left px-3 py-1.5 hover:bg-surface-overlay text-gray-300 hover:text-white transition-colors">
                Edit project
              </button>
              <button onClick={handleDelete} className="w-full text-left px-3 py-1.5 hover:bg-error/10 text-error transition-colors">
                Delete project
              </button>
            </div>
          </>
        )}
      </div>

      {/* Expanded content */}
      {open && (
        <div className="pb-1">
          {/* Error */}
          {error && (
            <div className="mx-3 mb-2 px-2 py-1.5 rounded bg-error/10 text-error text-[11px] leading-relaxed">
              {error}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="px-5 py-2 text-xs text-gray-500 flex items-center gap-2">
              <span className="w-3 h-3 border border-gray-600 border-t-accent rounded-full animate-spin" />
              Loading…
            </div>
          )}

          {/* Search box */}
          {!loading && services.length > 0 && (
            <div className="px-3 pt-1 pb-2">
              <div className="relative">
                <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search…"
                  className="w-full bg-surface-overlay border border-border rounded px-2 py-1 pl-6 text-xs
                    text-white placeholder:text-gray-600 focus:outline-none focus:border-accent transition-colors"
                  onClick={(e) => e.stopPropagation()}
                />
                {query && (
                  <button onClick={(e) => { e.stopPropagation(); setQuery('') }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">✕</button>
                )}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && services.length === 0 && (
            <div className="px-5 py-2 text-xs text-gray-600">
              {project.protoSource.type === 'reflection' ? 'No services via reflection' : 'No services found'}
            </div>
          )}

          {/* Service + method tree */}
          {!loading && filtered.map((svc) => (
            <ServiceNode key={svc.fullName} service={svc} project={project} query={query} />
          ))}

          {!loading && query && filtered.length === 0 && (
            <div className="px-5 py-2 text-xs text-gray-600">No results for "{query}"</div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Service node ─────────────────────────────────────────────────────────────

function ServiceNode({
  service,
  project,
  query
}: {
  service: ProtoService
  project: GrpcProject
  query: string
}): React.ReactElement {
  const [open, setOpen] = useState(true)
  const { openTab, tabs, activeTabId } = useAppStore()

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 w-full px-4 py-1 text-[11px] text-gray-500 hover:text-gray-200 hover:bg-surface-overlay transition-colors"
      >
        <ChevronIcon open={open} />
        <span className="flex-1 text-left font-medium truncate">{highlight(service.name, query)}</span>
        <span className="text-gray-600 text-[10px]">{service.methods.length}</span>
      </button>

      {open && (
        <ul>
          {service.methods.map((method) => {
            const key = `${project.id}:${service.fullName}:${method.name}`
            const existingTab = tabs.find((t) => t.key === key)
            const isActive = existingTab?.id === activeTabId
            return (
              <MethodItem
                key={method.name}
                method={method}
                query={query}
                active={isActive}
                hasTab={!!existingTab}
                onClick={() => openTab(project, service, method)}
              />
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ─── Method item ──────────────────────────────────────────────────────────────

function MethodItem({
  method,
  query,
  active,
  hasTab,
  onClick
}: {
  method: ProtoMethod
  query: string
  active: boolean
  hasTab: boolean
  onClick: () => void
}): React.ReactElement {
  const streamLabel =
    method.clientStreaming && method.serverStreaming ? 'BiDi'
    : method.clientStreaming ? 'CS'
    : method.serverStreaming ? 'SS'
    : null

  return (
    <li
      onClick={onClick}
      className={`flex items-center gap-2 pl-7 pr-3 py-1 cursor-pointer text-xs transition-colors
        ${active ? 'bg-accent-muted text-white' : 'text-gray-400 hover:bg-surface-overlay hover:text-white'}`}
    >
      <span className={`w-1 h-1 rounded-full flex-shrink-0 ${hasTab ? 'bg-accent' : 'bg-transparent'}`} />
      <span className="flex-1 truncate">{highlight(method.name, query)}</span>
      {streamLabel && (
        <span className="text-[9px] px-1 rounded bg-accent-muted text-accent-hover font-mono flex-shrink-0">
          {streamLabel}
        </span>
      )}
    </li>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function highlight(text: string, query: string): React.ReactElement {
  if (!query) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-accent/40 text-white rounded-sm">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

function ChevronIcon({ open, className }: { open: boolean; className?: string }): React.ReactElement {
  return (
    <svg className={`w-2.5 h-2.5 flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''} ${className ?? ''}`} viewBox="0 0 10 10" fill="none">
      <path d="M3 2L7 5L3 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ServerIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <svg className={`w-3.5 h-3.5 ${className ?? ''}`} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="3" width="14" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="1" y="9" width="14" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="12.5" cy="5" r="0.8" fill="currentColor" />
      <circle cx="12.5" cy="11" r="0.8" fill="currentColor" />
    </svg>
  )
}

function RefreshIcon({ spinning }: { spinning: boolean }): React.ReactElement {
  return (
    <svg className={`w-3 h-3 ${spinning ? 'animate-spin' : ''}`} viewBox="0 0 14 14" fill="none">
      <path d="M12.5 2.5A6.5 6.5 0 1 1 7 .5a6.5 6.5 0 0 1 4.5 1.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M9 1l3.5 1.5L11 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PlusIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 1V13M1 7H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function DotsIcon(): React.ReactElement {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <circle cx="6" cy="2.5" r="1" fill="currentColor" />
      <circle cx="6" cy="6" r="1" fill="currentColor" />
      <circle cx="6" cy="9.5" r="1" fill="currentColor" />
    </svg>
  )
}

function SearchIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <svg className={`w-3 h-3 ${className ?? ''}`} viewBox="0 0 14 14" fill="none">
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M9.5 9.5L12.5 12.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}
