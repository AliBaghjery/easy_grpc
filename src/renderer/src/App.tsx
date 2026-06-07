import React from 'react'
import { Sidebar } from './components/Sidebar'
import { TabBar } from './components/TabBar'
import { RequestPanel } from './components/RequestPanel'
import { ResponsePanel } from './components/ResponsePanel'
import { ProjectModal } from './components/ProjectModal'
export default function App(): React.ReactElement {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface text-white">
      {/* Sidebar */}
      <Sidebar />

      {/* Main workspace */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Title bar drag region (macOS) */}
        <div
          className="h-8 flex items-center px-4 border-b border-border bg-surface flex-shrink-0"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <span className="text-xs font-semibold text-gray-500 tracking-widest select-none">
            easy <span className="text-accent">gRPC</span>
          </span>
        </div>

        {/* Tab bar */}
        <TabBar />

        {/* Split pane: request | response */}
        <div className="flex flex-1 overflow-hidden">
          <div className="flex flex-col w-1/2 border-r border-border overflow-hidden">
            <RequestPanel />
          </div>
          <div className="flex flex-col w-1/2 overflow-hidden">
            <ResponsePanel />
          </div>
        </div>
      </div>

      {/* Project create/edit modal */}
      <ProjectModal />
    </div>
  )
}
