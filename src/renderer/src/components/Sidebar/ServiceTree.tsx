import React, { useState, useMemo } from 'react'
import { useAppStore } from '../../store/appStore'
import type { GrpcProject, ProtoService, ProtoMethod } from '../../../../shared/types'

interface Props {
  services: ProtoService[]
  loading: boolean
  project: GrpcProject
  onReload: () => void
}


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

export function ServiceTree({ services, loading, project, onReload }: Props): React.ReactElement {
  const [query, setQuery] = useState('')

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

  const totalMatches = useMemo(() => {
    if (!query.trim()) return null
    return filtered.reduce((acc, s) => acc + s.methods.length, 0)
  }, [filtered, query])

  return (
    <div className="border-t border-border">
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
          Services
        </span>
        <button
          onClick={onReload}
          className="text-gray-500 hover:text-white transition-colors"
          title="Reload proto"
        >
          <RefreshIcon spinning={loading} />
        </button>
      </div>

      {/* Search box — only shown when there are services */}
      {!loading && services.length > 0 && (
        <div className="px-3 pb-2">
          <div className="relative">
            <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search services & methods…"
              className="w-full bg-surface-overlay border border-border rounded px-2 py-1 pl-7 text-xs
                text-white placeholder:text-gray-600 focus:outline-none focus:border-accent transition-colors"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
              >
                ✕
              </button>
            )}
          </div>
          {query && (
            <p className="text-[10px] text-gray-600 mt-1 px-1">
              {totalMatches === 0 ? 'No matches' : `${totalMatches} method${totalMatches === 1 ? '' : 's'} found`}
            </p>
          )}
        </div>
      )}

      {loading && (
        <div className="px-4 py-3 text-xs text-gray-500">Loading services…</div>
      )}

      {!loading && services.length === 0 && (
        <div className="px-4 pb-3 text-xs text-gray-500 leading-relaxed">
          {project.protoSource.type === 'reflection'
            ? 'Connect and reload to see services'
            : 'No services found in proto'}
        </div>
      )}

      {!loading && filtered.map((svc) => (
        <ServiceNode key={svc.fullName} service={svc} query={query} forceOpen={!!query} project={project} />
      ))}

      {!loading && query && filtered.length === 0 && (
        <div className="px-4 pb-3 text-xs text-gray-500">No results for "{query}"</div>
      )}
    </div>
  )
}

function ServiceNode({
  service,
  query,
  forceOpen,
  project
}: {
  service: ProtoService
  query: string
  forceOpen: boolean
  project: GrpcProject
}): React.ReactElement {
  const [open, setOpen] = useState(true)
  const { openTab, tabs, activeTabId } = useAppStore()
  const isOpen = forceOpen || open

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full px-4 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-surface-overlay transition-colors"
      >
        <ChevronIcon open={isOpen} />
        <span className="font-medium truncate flex-1 text-left">
          {highlight(service.name, query)}
        </span>
        <span className="text-[10px] text-gray-600">{service.methods.length}</span>
      </button>

      {isOpen && (
        <ul className="pb-1">
          {service.methods.map((method) => {
            const key = `${project.id}:${service.fullName}:${method.name}`
            const existingTab = tabs.find((t) => t.key === key)
            const isActive = existingTab?.id === activeTabId
            return (
              <MethodItem
                key={method.name}
                method={method}
                service={service}
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

function MethodItem({
  method,
  query,
  active,
  hasTab,
  onClick
}: {
  method: ProtoMethod
  service: ProtoService
  query: string
  active: boolean
  hasTab: boolean
  onClick: () => void
}): React.ReactElement {
  const streamLabel = method.clientStreaming && method.serverStreaming
    ? 'BiDi'
    : method.clientStreaming
      ? 'CS'
      : method.serverStreaming
        ? 'SS'
        : null

  return (
    <li
      onClick={onClick}
      className={`flex items-center gap-2 pl-8 pr-4 py-1.5 cursor-pointer text-xs transition-colors
        ${active
          ? 'bg-accent-muted text-white'
          : 'text-gray-400 hover:bg-surface-overlay hover:text-white'
        }`}
    >
      {/* Dot: open tab indicator */}
      <span className={`w-1 h-1 rounded-full flex-shrink-0 transition-colors ${hasTab ? 'bg-accent' : 'bg-transparent'}`} />
      <span className="flex-1 truncate">{highlight(method.name, query)}</span>
      {streamLabel && (
        <span className="text-[9px] px-1 rounded bg-accent-muted text-accent-hover font-mono">
          {streamLabel}
        </span>
      )}
    </li>
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

function ChevronIcon({ open }: { open: boolean }): React.ReactElement {
  return (
    <svg
      className={`w-2.5 h-2.5 flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
      viewBox="0 0 10 10"
      fill="none"
    >
      <path d="M3 2L7 5L3 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function RefreshIcon({ spinning }: { spinning: boolean }): React.ReactElement {
  return (
    <svg
      className={`w-3 h-3 ${spinning ? 'animate-spin' : ''}`}
      viewBox="0 0 14 14"
      fill="none"
    >
      <path
        d="M12.5 2.5A6.5 6.5 0 1 1 7 .5a6.5 6.5 0 0 1 4.5 1.8"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path d="M9 1l3.5 1.5L11 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
