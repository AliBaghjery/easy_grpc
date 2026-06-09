import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '../../store/appStore'
import type { GrpcProject, ProtoMethod, ProtoService } from '../../../../shared/types'

interface MethodResult {
  project: GrpcProject
  service: ProtoService
  method: ProtoMethod
  score: number
  /** Character positions in method.name that matched the query */
  matchPositions: number[]
}

// ---------------------------------------------------------------------------
// Fuzzy / subsequence matching
// Returns match=false if not all query chars appear in order in target.
// Score favours: consecutive runs, CamelCase/word-boundary hits.
// ---------------------------------------------------------------------------
function fuzzyMatch(
  query: string,
  target: string
): { match: boolean; score: number; positions: number[] } {
  if (!query) return { match: true, score: 0, positions: [] }

  const q = query.toLowerCase()
  const t = target.toLowerCase()
  const positions: number[] = []
  let qi = 0

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      positions.push(ti)
      qi++
    }
  }

  if (qi < q.length) return { match: false, score: 0, positions: [] }

  let score = 0
  for (let i = 0; i < positions.length; i++) {
    // Consecutive bonus
    if (i > 0 && positions[i] === positions[i - 1] + 1) score += 3
    // CamelCase / word-boundary bonus
    const ch = target[positions[i]]
    const prev = positions[i] > 0 ? target[positions[i] - 1] : ''
    if (positions[i] === 0 || prev === ' ' || prev === '_' || prev === '-') score += 4
    else if (ch >= 'A' && ch <= 'Z') score += 2
  }

  return { match: true, score, positions }
}

// Render text with matched character positions highlighted
function FuzzyHighlight({
  text,
  positions
}: {
  text: string
  positions: number[]
}): React.ReactElement {
  if (positions.length === 0) return <>{text}</>
  const posSet = new Set(positions)
  return (
    <>
      {text.split('').map((ch, i) =>
        posSet.has(i) ? (
          <span key={i} className="text-accent-hover font-semibold">
            {ch}
          </span>
        ) : (
          <span key={i}>{ch}</span>
        )
      )}
    </>
  )
}

export function CommandPalette({ onClose }: { onClose: () => void }): React.ReactElement {
  const { projects, loadedProtos, setLoadedProto, openTab } = useAppStore()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Load protos for every project that hasn't been loaded yet
  useEffect(() => {
    const unloaded = projects.filter((p) => !loadedProtos[p.id])
    if (unloaded.length === 0) return

    setLoading(true)
    Promise.all(
      unloaded.map(async (p) => {
        const result = await window.api.loadProto(p)
        if (!result.error) setLoadedProto(p.id, result.services)
      })
    ).finally(() => setLoading(false))
  }, []) // run once on mount

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const results = useMemo<MethodResult[]>(() => {
    const q = query.trim()
    const items: MethodResult[] = []

    for (const project of projects) {
      const services = loadedProtos[project.id] ?? []
      for (const service of services) {
        for (const method of service.methods) {
          // Match against method name primarily, with bonus for project/service match
          const methodMatch = fuzzyMatch(q, method.name)
          const serviceMatch = fuzzyMatch(q, service.name)
          const projectMatch = fuzzyMatch(q, project.name)

          const best = [methodMatch, serviceMatch, projectMatch].find((m) => m.match)
          if (!best) continue

          // Use method match positions for highlight; fall back to service/project match
          const primaryMatch = methodMatch.match
            ? methodMatch
            : serviceMatch.match
              ? serviceMatch
              : projectMatch

          // Extra bonus when the method name itself matches
          const score = primaryMatch.score + (methodMatch.match ? 10 : 0)

          items.push({
            project,
            service,
            method,
            score,
            matchPositions: methodMatch.match ? methodMatch.positions : []
          })
        }
      }
    }

    // Sort by descending score
    return items.sort((a, b) => b.score - a.score)
  }, [query, projects, loadedProtos])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      const item = results[selectedIndex]
      if (item) selectItem(item)
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  function selectItem(item: MethodResult): void {
    openTab(item.project, item.service, item.method)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
      <div
        className="w-[580px] max-h-[60vh] flex flex-col panel shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          {loading ? <SpinnerIcon /> : <SearchIcon />}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search methods…"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-gray-500 focus:outline-none"
            spellCheck={false}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-gray-500 hover:text-gray-300 transition-colors"
            >
              <ClearIcon />
            </button>
          )}
          <kbd className="text-[10px] text-gray-600 bg-surface-overlay border border-border rounded px-1.5 py-0.5 font-mono">
            esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="overflow-y-auto flex-1">
          {results.length === 0 && !loading ? (
            <div className="px-4 py-8 text-center text-xs text-gray-500">
              {query
                ? <>No methods match <span className="text-gray-300">"{query}"</span></>
                : projects.length === 0
                  ? 'No projects yet. Create one first.'
                  : 'Loading methods…'}
            </div>
          ) : (
            results.map((item, idx) => (
              <button
                key={`${item.project.id}:${item.service.fullName}:${item.method.name}`}
                data-idx={idx}
                onClick={() => selectItem(item)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full text-left flex items-center gap-3 px-4 py-2.5 transition-colors
                  ${idx === selectedIndex ? 'bg-accent/20' : 'hover:bg-surface-overlay'}`}
              >
                <StreamBadge method={item.method} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-200 truncate">
                    <FuzzyHighlight text={item.method.name} positions={item.matchPositions} />
                  </div>
                  <div className="text-xs text-gray-500 truncate mt-0.5">
                    {item.service.name}
                    <span className="mx-1 text-gray-600">·</span>
                    {item.project.name}
                  </div>
                </div>
                <span className="text-[10px] text-gray-600 font-mono flex-shrink-0">
                  {item.project.host}:{item.project.port}
                </span>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div className="flex items-center gap-4 px-4 py-2 border-t border-border text-[10px] text-gray-600">
            <span><kbd className="font-mono">↑↓</kbd> navigate</span>
            <span><kbd className="font-mono">↵</kbd> open</span>
            <span className="ml-auto">{results.length} method{results.length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function StreamBadge({ method }: { method: ProtoMethod }): React.ReactElement {
  const label =
    method.clientStreaming && method.serverStreaming
      ? 'BiDi'
      : method.clientStreaming
        ? 'CS'
        : method.serverStreaming
          ? 'SS'
          : 'U'
  const color =
    label === 'U'
      ? 'text-gray-600 bg-surface-overlay'
      : 'text-accent-hover bg-accent-muted'

  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono flex-shrink-0 w-8 text-center ${color}`}>
      {label}
    </span>
  )
}

function SearchIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-gray-500 flex-shrink-0">
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9.5 9.5L12.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function SpinnerIcon(): React.ReactElement {
  return (
    <span className="w-3.5 h-3.5 border-2 border-gray-600 border-t-gray-400 rounded-full animate-spin flex-shrink-0" />
  )
}

function ClearIcon(): React.ReactElement {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
