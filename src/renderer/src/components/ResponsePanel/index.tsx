import React, { useState } from 'react'
import { useAppStore } from '../../store/appStore'

type RespTab = 'response' | 'headers' | 'trailers'

const STATUS_CODE_NAMES: Record<number, string> = {
  0: 'OK', 1: 'CANCELLED', 2: 'UNKNOWN', 3: 'INVALID_ARGUMENT',
  4: 'DEADLINE_EXCEEDED', 5: 'NOT_FOUND', 6: 'ALREADY_EXISTS',
  7: 'PERMISSION_DENIED', 8: 'RESOURCE_EXHAUSTED', 9: 'FAILED_PRECONDITION',
  10: 'ABORTED', 11: 'OUT_OF_RANGE', 12: 'UNIMPLEMENTED', 13: 'INTERNAL',
  14: 'UNAVAILABLE', 15: 'DATA_LOSS', 16: 'UNAUTHENTICATED'
}

export function ResponsePanel(): React.ReactElement {
  const { activeTab } = useAppStore()
  const tab = activeTab()
  const response = tab?.response ?? null
  const callLoading = tab?.callLoading ?? false

  const [respTab, setRespTab] = useState<RespTab>('response')
  const [copied, setCopied] = useState(false)

  const hasHeaders = !!response?.headers && Object.keys(response.headers).length > 0
  const hasTrailers = !!response?.trailers && Object.keys(response.trailers).length > 0

  function handleCopy(): void {
    if (!response?.data) return
    navigator.clipboard.writeText(JSON.stringify(response.data, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border min-h-[45px]">
        {response && response.status !== 'loading' ? (
          <>
            <StatusBadge response={response} />
            {response.durationMs !== undefined && (
              <span className="text-xs text-gray-500">{response.durationMs}ms</span>
            )}
            <div className="flex-1" />
            {response.data && (
              <button onClick={handleCopy} className="btn-ghost text-xs">
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            )}
          </>
        ) : (
          <span className="text-xs text-gray-600">
            {callLoading ? 'Waiting for response…' : 'Response will appear here'}
          </span>
        )}
      </div>

      {/* Sub-tabs for headers/trailers */}
      {(hasHeaders || hasTrailers) && (
        <div className="flex border-b border-border px-4">
          {(['response', hasHeaders && 'headers', hasTrailers && 'trailers'] as (RespTab | false)[])
            .filter(Boolean)
            .map((t) => (
              <button
                key={t as RespTab}
                onClick={() => setRespTab(t as RespTab)}
                className={`py-2 px-3 text-xs font-medium capitalize border-b-2 -mb-px transition-colors
                  ${respTab === t
                    ? 'border-accent text-white'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}
              >
                {t as string}
              </button>
            ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {callLoading && <LoadingView />}

        {!callLoading && !tab && <EmptyState message="Open a tab to see responses" />}

        {!callLoading && tab && !response && <EmptyState message="Send a request to see the response" />}

        {!callLoading && response?.status === 'error' && respTab === 'response' && (
          <ErrorView response={response} />
        )}

        {!callLoading && response?.status === 'success' && respTab === 'response' && (
          <JsonView data={response.data} />
        )}

        {!callLoading && respTab === 'headers' && response?.headers && (
          <KVView data={response.headers} />
        )}

        {!callLoading && respTab === 'trailers' && response?.trailers && (
          <KVView data={response.trailers} />
        )}
      </div>
    </div>
  )
}

function StatusBadge({
  response
}: {
  response: import('../../../../shared/types').GrpcCallResponse
}): React.ReactElement {
  if (response.status === 'error') {
    const code = response.grpcStatusCode ?? 2
    return (
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-error flex-shrink-0" />
        <span className="text-xs font-mono text-error">
          {code} {STATUS_CODE_NAMES[code] ?? 'ERROR'}
        </span>
        {response.grpcStatusMessage && (
          <span className="text-xs text-gray-500 truncate max-w-[180px]">{response.grpcStatusMessage}</span>
        )}
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2">
      <span className="w-2 h-2 rounded-full bg-success flex-shrink-0" />
      <span className="text-xs font-mono text-success">0 OK</span>
    </div>
  )
}

function JsonView({ data }: { data: unknown }): React.ReactElement {
  return (
    <pre
      className="p-4 text-xs text-gray-200 leading-relaxed overflow-auto h-full whitespace-pre-wrap break-all"
      style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
    >
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}

function ErrorView({
  response
}: {
  response: import('../../../../shared/types').GrpcCallResponse
}): React.ReactElement {
  return (
    <div className="p-4">
      <div className="panel border-error/30 bg-error/5 p-4 rounded-lg">
        <p className="text-sm font-medium text-error mb-2">gRPC Error</p>
        <p className="text-xs text-gray-300 font-mono break-all">{response.error}</p>
        {response.grpcStatusMessage && response.grpcStatusMessage !== response.error && (
          <p className="text-xs text-gray-500 mt-2 font-mono">{response.grpcStatusMessage}</p>
        )}
      </div>
    </div>
  )
}

function KVView({ data }: { data: Record<string, string> }): React.ReactElement {
  return (
    <div className="p-4">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-500 border-b border-border">
            <th className="text-left py-1 pr-4 font-medium">Key</th>
            <th className="text-left py-1 font-medium">Value</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(data).map(([k, v]) => (
            <tr key={k} className="border-b border-border/50">
              <td className="py-1.5 pr-4 font-mono text-gray-400">{k}</td>
              <td className="py-1.5 font-mono text-gray-200 break-all">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LoadingView(): React.ReactElement {
  return (
    <div className="flex items-center justify-center h-full gap-2 text-gray-500 text-sm">
      <span className="w-4 h-4 border-2 border-gray-600 border-t-accent rounded-full animate-spin" />
      Invoking RPC…
    </div>
  )
}

function EmptyState({ message }: { message: string }): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-600">
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <rect x="8" y="14" width="24" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M14 10h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M16 22l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p className="text-sm">{message}</p>
    </div>
  )
}
