import React, { useRef, useEffect } from 'react'
import { useAppStore } from '../../store/appStore'
import type { Tab } from '../../../../shared/types'

// Deterministic color per project from a pleasant palette
const PROJECT_COLORS = [
  '#5c6bc0', // indigo  (accent)
  '#26a69a', // teal
  '#ef5350', // red
  '#ab47bc', // purple
  '#ff7043', // deep orange
  '#42a5f5', // blue
  '#66bb6a', // green
  '#ffca28', // amber
  '#ec407a', // pink
  '#78909c', // blue-grey
]

const colorCache = new Map<string, string>()
let colorIdx = 0

function projectColor(projectId: string): string {
  if (!colorCache.has(projectId)) {
    colorCache.set(projectId, PROJECT_COLORS[colorIdx % PROJECT_COLORS.length])
    colorIdx++
  }
  return colorCache.get(projectId)!
}

export function TabBar(): React.ReactElement {
  const { tabs, activeTabId, setActiveTab, closeTab, projects } = useAppStore()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Seed color cache from loaded projects so colors are stable
  useEffect(() => {
    projects.forEach((p) => projectColor(p.id))
  }, [projects])

  // Scroll active tab into view when it changes
  useEffect(() => {
    const el = scrollRef.current?.querySelector('[data-active="true"]') as HTMLElement | null
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }, [activeTabId])

  if (tabs.length === 0) {
    return (
      <div className="flex items-center h-9 border-b border-border px-4">
        <span className="text-xs text-gray-600 italic">No open tabs — select a method from the sidebar</span>
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      className="flex items-end border-b border-border overflow-x-auto overflow-y-hidden"
      style={{ scrollbarWidth: 'none', minHeight: '44px' }}
    >
      {tabs.map((tab) => {
        const project = projects.find((p) => p.id === tab.projectId)
        return (
          <TabItem
            key={tab.id}
            tab={tab}
            projectName={project?.name ?? '…'}
            color={projectColor(tab.projectId)}
            active={tab.id === activeTabId}
            onActivate={() => setActiveTab(tab.id)}
            onClose={() => closeTab(tab.id)}
          />
        )
      })}
    </div>
  )
}

function TabItem({
  tab,
  projectName,
  color,
  active,
  onActivate,
  onClose
}: {
  tab: Tab
  projectName: string
  color: string
  active: boolean
  onActivate: () => void
  onClose: () => void
}): React.ReactElement {
  const isStreaming = tab.method.clientStreaming || tab.method.serverStreaming

  return (
    <div
      data-active={active}
      onClick={onActivate}
      className={`
        group relative flex flex-col justify-center px-3 py-1.5 h-full min-w-0 max-w-[220px] w-[180px]
        cursor-pointer border-r border-border flex-shrink-0 select-none transition-colors
        ${active
          ? 'bg-surface text-white'
          : 'bg-surface-raised text-gray-400 hover:text-gray-200 hover:bg-surface-overlay'
        }
      `}
      style={{
        borderTop: `2px solid ${active ? color : 'transparent'}`
      }}
    >
      {/* Project name — colored, top line */}
      <div className="flex items-center gap-1.5 mb-0.5">
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <span
          className="text-[10px] font-medium truncate"
          style={{ color }}
        >
          {projectName}
        </span>
      </div>

      {/* Method + service row */}
      <div className="flex items-center gap-1.5 min-w-0">
        <StatusDot tab={tab} />

        <div className="flex items-baseline gap-1 min-w-0 flex-1">
          <span className="text-[11px] font-semibold truncate">
            {tab.method.name}
          </span>
          <span className="text-[10px] text-gray-600 truncate hidden group-hover:inline">
            · {tab.service.name}
          </span>
        </div>

        {isStreaming && (
          <span className="text-[9px] px-1 rounded bg-accent-muted text-accent-hover font-mono flex-shrink-0">
            {tab.method.clientStreaming && tab.method.serverStreaming ? 'BiDi'
              : tab.method.clientStreaming ? 'CS' : 'SS'}
          </span>
        )}

        {/* Close button */}
        <button
          onClick={(e) => { e.stopPropagation(); onClose() }}
          className={`
            flex-shrink-0 w-3.5 h-3.5 flex items-center justify-center rounded
            transition-all text-gray-600 hover:text-white hover:bg-surface
            ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
          `}
          title="Close tab"
        >
          <svg width="7" height="7" viewBox="0 0 8 8" fill="none">
            <path d="M1 1L7 7M7 1L1 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}

function StatusDot({ tab }: { tab: Tab }): React.ReactElement {
  if (tab.callLoading) {
    return <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse flex-shrink-0" />
  }
  if (tab.response?.status === 'success') {
    return <span className="w-1.5 h-1.5 rounded-full bg-success flex-shrink-0" />
  }
  if (tab.response?.status === 'error') {
    return <span className="w-1.5 h-1.5 rounded-full bg-error flex-shrink-0" />
  }
  return <span className="w-1.5 h-1.5 rounded-full bg-gray-700 flex-shrink-0" />
}
