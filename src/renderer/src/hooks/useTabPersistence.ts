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
  const { tabs, activeTabId, updateTab, setActiveTab } = useAppStore()
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadedRef = useRef(false)

  // ── Load on mount ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true

    window.api.loadAllTabs().then((allTabs) => {
      const newTabs: Tab[] = []
      let firstActiveId: string | null = null

      for (const [_projectId, data] of Object.entries(allTabs)) {
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
            callLoading: false
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

      // Save each project's tabs (including projects whose tabs are now empty)
      const projectIds = new Set([
        ...state.tabs.map((t) => t.projectId),
        ...Object.keys(byProject)
      ])

      for (const projectId of projectIds) {
        window.api.saveTabs(projectId, byProject[projectId] ?? { tabs: [], activeTabKey: null })
      }
    }, SAVE_DEBOUNCE)

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [tabs, activeTabId])
}
