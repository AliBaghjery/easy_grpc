import React, { useState } from 'react'
import { useAppStore } from '../../store/appStore'
import { MetadataEditor } from './MetadataEditor'

type Tab = 'body' | 'metadata'

export function RequestPanel(): React.ReactElement {
  const { activeTab, updateTab, resetTabPayload, projects, setActiveTab, activeTabId } = useAppStore()
  const tab = activeTab()

  const [uiTab, setUiTab] = useState<Tab>('body')

  if (!tab) {
    return <EmptyState hasProjects={projects.length > 0} />
  }

  const project = projects.find((p) => p.id === tab.projectId) ?? null

  async function handleSend(): Promise<void> {
    if (!tab || !project || tab.callLoading) return

    let payload: Record<string, unknown> = {}
    try {
      payload = JSON.parse(tab.requestPayload || '{}')
    } catch {
      updateTab(tab.id, {
        response: { status: 'error', error: 'Request body is not valid JSON' }
      })
      return
    }

    updateTab(tab.id, { callLoading: true, response: { status: 'loading' } })

    const res = await window.api.invoke({
      project,
      projectId: project.id,
      serviceName: tab.service.fullName,
      methodName: tab.method.name,
      payload,
      metadata: tab.requestMetadata,
      timeoutMs: 30000
    })

    updateTab(tab.id, { callLoading: false, response: res })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Method header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <StreamBadge method={tab.method} />
          <span className="text-sm font-semibold text-white truncate">
            {tab.service.name}
            <span className="text-gray-500 font-normal">/</span>
            {tab.method.name}
          </span>
        </div>
        <span className="text-xs text-gray-500 flex-shrink-0">
          {project?.host}:{project?.port}
        </span>
        <button
          onClick={handleSend}
          disabled={tab.callLoading}
          className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
        >
          {tab.callLoading ? (
            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <SendIcon />
          )}
          {tab.callLoading ? 'Sending…' : 'Send'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border px-4">
        {(['body', 'metadata'] as Tab[]).map((t) => {
          const metaCount = tab.requestMetadata.filter((m) => m.enabled && m.key).length
          return (
            <button
              key={t}
              onClick={() => setUiTab(t)}
              className={`py-2 px-3 text-xs font-medium capitalize border-b-2 -mb-px transition-colors
                ${uiTab === t
                  ? 'border-accent text-white'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
            >
              {t}
              {t === 'metadata' && metaCount > 0 && (
                <span className="ml-1.5 text-[10px] bg-accent-muted text-accent-hover rounded-full px-1.5 py-0.5">
                  {metaCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {uiTab === 'body' ? (
          <BodyEditor
            value={tab.requestPayload}
            onChange={(v) => updateTab(tab.id, { requestPayload: v })}
            onReset={() => resetTabPayload(tab.id)}
            requestType={tab.method.requestType}
          />
        ) : (
          <MetadataEditor
            entries={tab.requestMetadata}
            onChange={(meta) => updateTab(tab.id, { requestMetadata: meta })}
          />
        )}
      </div>
    </div>
  )
}

function BodyEditor({
  value,
  onChange,
  onReset,
  requestType
}: {
  value: string
  onChange: (v: string) => void
  onReset: () => void
  requestType: string
}): React.ReactElement {
  const [jsonError, setJsonError] = useState<string | null>(null)

  function handleChange(v: string): void {
    onChange(v)
    try {
      JSON.parse(v)
      setJsonError(null)
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'Invalid JSON')
    }
  }

  function handleReset(): void {
    onReset()
    setJsonError(null)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span className="text-xs text-gray-500">
          <span className="text-gray-400 font-mono">{requestType}</span> · JSON
        </span>
        <div className="flex items-center gap-2">
          {jsonError && (
            <span className="text-xs text-error truncate max-w-[200px]" title={jsonError}>
              {jsonError}
            </span>
          )}
          <button
            onClick={handleReset}
            title="Reset to defaults"
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-200 transition-colors"
          >
            <ResetIcon />
            Reset
          </button>
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        spellCheck={false}
        className="flex-1 resize-none bg-surface-overlay/40 text-sm text-gray-200 px-4 py-2
          focus:outline-none border-0 leading-relaxed"
        placeholder="{}"
        style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
      />
    </div>
  )
}

function StreamBadge({
  method
}: {
  method: import('../../../../shared/types').ProtoMethod
}): React.ReactElement | null {
  if (!method.clientStreaming && !method.serverStreaming) return null
  const label =
    method.clientStreaming && method.serverStreaming
      ? 'BiDi'
      : method.clientStreaming
        ? 'CS'
        : 'SS'
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-muted text-accent-hover font-mono flex-shrink-0">
      {label}
    </span>
  )
}

function SendIcon(): React.ReactElement {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M1 6H11M11 6L7 2M11 6L7 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ResetIcon(): React.ReactElement {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
      <path d="M2 6a4 4 0 1 0 .8-2.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 2.5V5.5H5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function EmptyState({ hasProjects }: { hasProjects: boolean }): React.ReactElement {
  const isMac = navigator.platform.toUpperCase().includes('MAC')
  const mod = isMac ? '⌘' : 'Ctrl'

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 text-gray-600 px-8 select-none">
      {/* Icon */}
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="opacity-30">
        <rect x="6" y="10" width="36" height="28" rx="4" stroke="currentColor" strokeWidth="1.5" />
        <path d="M15 24h18M24 15v18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>

      {hasProjects ? (
        <>
          <p className="text-sm text-gray-500">Open a method to get started</p>
          <div className="flex flex-col gap-2 items-center">
            <ShortcutHint keys={[mod, 'P']} label="Search methods" />
          </div>
        </>
      ) : (
        <>
          <div className="text-center">
            <p className="text-sm text-gray-400 font-medium">No projects yet</p>
            <p className="text-xs text-gray-600 mt-1">Create a project to start making gRPC calls</p>
          </div>
          <div className="flex flex-col gap-2 items-center">
            <ShortcutHint keys={[mod, 'N']} label="Create a new project" />
            <ShortcutHint keys={[mod, 'P']} label="Search methods" />
          </div>
        </>
      )}
    </div>
  )
}

function ShortcutHint({ keys, label }: { keys: string[]; label: string }): React.ReactElement {
  return (
    <div className="flex items-center gap-2.5 text-xs text-gray-600">
      <div className="flex items-center gap-1">
        {keys.map((k, i) => (
          <kbd
            key={i}
            className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5
              bg-surface-overlay border border-border rounded text-[11px] text-gray-400 font-mono"
          >
            {k}
          </kbd>
        ))}
      </div>
      <span>{label}</span>
    </div>
  )
}
