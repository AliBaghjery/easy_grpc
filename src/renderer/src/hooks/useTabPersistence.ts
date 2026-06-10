import { useEffect, useRef } from 'react'
import { v4 as uuid } from 'uuid'
import { useAppStore } from '../store/appStore'
import type { Tab } from '../../../shared/types'

/** Debounce delay for saving after a payload edit (ms) */
const SAVE_DEBOUNCE = 800

function tabsToPersistedMap(tabs: Tab[]): Record<string, import('../../../shared/types').PersistedProjectTabs> {
  const byProject: Record<string, import('../../../shared/types').PersistedProjectTabs> = {}
  const activeTabId = useAppStore.getState().activeTabId

  for (const tab of tabs) {
    if (!byProject[tab.projectId]) {
      byProject[tab.projectId] = { tabs: [], activeTabKey: null }
    }
    byProject[tab.projectId].tabs.push({
      key: tab.key,
      service: tab.service,
      method: tab.method,
      requestPayload: tab.requestPayload,
      requestMetadata: tab.requestMetadata
    })
    if (tab.id === activeTabId) {
      byProject[tab.projectId].activeTabKey = tab.key
    }
  }
  return byProject
}

export function useTabPersistence(): void {
  const { tabs, activeTabId } = useAppStore()
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadedRef = useRef(false)
  // Track every project ID that has ever had persisted tabs so we can clear them
  const knownProjectIdsRef = useRef<Set<string>>(new Set())

  // ── Load on mount ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true

    window.api.loadAllTabs().then((allTabs) => {
      const newTabs: Tab[] = []
      let firstActiveId: string | null = null

      for (const [_projectId, data] of Object.entries(allTabs)) {
        knownProjectIdsRef.current.add(_projectId)
        for (const persisted of data.tabs) {
          const id = uuid()
          const tab: Tab = {
            id,
            key: persisted.key,
            projectId: _projectId,
            service: persisted.service,
            method: persisted.method,
            requestPayload: persisted.requestPayload,
            requestMetadata: persisted.requestMetadata,
            response: null,
            callLoading: false,
            activeCallId: null
          }
          newTabs.push(tab)
          if (persisted.key === data.activeTabKey && firstActiveId === null) {
            firstActiveId = id
          }
        }
      }

      if (newTabs.length > 0) {
        useAppStore.setState({ tabs: newTabs, activeTabId: firstActiveId ?? newTabs[0].id })
      }
    })
  }, [])

  // ── Save whenever tabs change (debounced) ───────────────────────────────────
  useEffect(() => {
    if (!loadedRef.current) return

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)

    saveTimerRef.current = setTimeout(() => {
      const state = useAppStore.getState()
      const byProject = tabsToPersistedMap(state.tabs)

      // Register any new project IDs so they get cleared when their tabs are closed
      for (const id of Object.keys(byProject)) knownProjectIdsRef.current.add(id)

      // Save every known project — this writes an empty list for projects
      // whose last tab was just closed, preventing stale data on restart
      for (const projectId of knownProjectIdsRef.current) {
        window.api.saveTabs(projectId, byProject[projectId] ?? { tabs: [], activeTabKey: null })
      }
    }, SAVE_DEBOUNCE)

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [tabs, activeTabId])
}
