import React, { useRef, useEffect } from 'react'
import { useAppStore } from '../../store/appStore'
import type { Tab } from '../../../../shared/types'

export function TabBar(): React.ReactElement {
  const { tabs, activeTabId, setActiveTab, closeTab } = useAppStore()
  const scrollRef = useRef<HTMLDivElement>(null)

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
      className="flex items-end h-9 border-b border-border overflow-x-auto overflow-y-hidden scrollbar-none"
      style={{ scrollbarWidth: 'none' }}
    >
      {tabs.map((tab) => (
        <TabItem
          key={tab.id}
          tab={tab}
          active={tab.id === activeTabId}
          onActivate={() => setActiveTab(tab.id)}
          onClose={() => closeTab(tab.id)}
        />
      ))}
    </div>
  )
}

function TabItem({
  tab,
  active,
  onActivate,
  onClose
}: {
  tab: Tab
  active: boolean
  onActivate: () => void
  onClose: () => void
}): React.ReactElement {
  const isStreaming = tab.method.clientStreaming || tab.method.serverStreaming

  function handleClose(e: React.MouseEvent): void {
    e.stopPropagation()
    onClose()
  }

  return (
    <div
      data-active={active}
      onClick={onActivate}
      className={`
        group relative flex items-center gap-2 px-3 h-full min-w-0 max-w-[200px] cursor-pointer
        border-r border-border flex-shrink-0 select-none transition-colors
        ${active
          ? 'bg-surface text-white border-t-2 border-t-accent -mt-px'
          : 'bg-surface-raised text-gray-400 hover:text-gray-200 hover:bg-surface-overlay border-t-2 border-t-transparent'
        }
      `}
    >
      {/* Status dot — shows response state */}
      <StatusDot tab={tab} />

      {/* Label */}
      <div className="flex flex-col min-w-0 leading-none">
        <span className="text-[11px] truncate font-medium">
          {tab.method.name}
        </span>
        <span className="text-[10px] text-gray-600 truncate">
          {tab.service.name}
        </span>
      </div>

      {isStreaming && (
        <span className="text-[9px] px-1 rounded bg-accent-muted text-accent-hover font-mono flex-shrink-0">
          {tab.method.clientStreaming && tab.method.serverStreaming ? 'BiDi' : tab.method.clientStreaming ? 'CS' : 'SS'}
        </span>
      )}

      {/* Close button */}
      <button
        onClick={handleClose}
        className={`
          flex-shrink-0 w-4 h-4 flex items-center justify-center rounded
          transition-all text-gray-600 hover:text-white hover:bg-surface-overlay
          ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
        `}
        title="Close tab"
      >
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
          <path d="M1 1L7 7M7 1L1 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}

function StatusDot({ tab }: { tab: Tab }): React.ReactElement {
  if (tab.callLoading) {
    return <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse flex-shrink-0" />
  }
  if (!tab.response) {
    return <span className="w-1.5 h-1.5 rounded-full bg-gray-600 flex-shrink-0" />
  }
  if (tab.response.status === 'success') {
    return <span className="w-1.5 h-1.5 rounded-full bg-success flex-shrink-0" />
  }
  if (tab.response.status === 'error') {
    return <span className="w-1.5 h-1.5 rounded-full bg-error flex-shrink-0" />
  }
  return <span className="w-1.5 h-1.5 rounded-full bg-gray-600 flex-shrink-0" />
}
