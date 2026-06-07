import React, { useEffect, useState } from 'react'
import { useAppStore } from '../../store/appStore'
import { ProjectItem } from './ProjectItem'
import { ServiceTree } from './ServiceTree'
import type { GrpcProject } from '../../../../shared/types'

export function Sidebar(): React.ReactElement {
  const {
    projects,
    setProjects,
    selectedProjectId,
    selectProject,
    openNewProjectModal,
    services,
    setServices,
    protoLoading,
    setProtoLoading,
    setProtoError
  } = useAppStore()

  useEffect(() => {
    window.api.listProjects().then(setProjects)
  }, [])

  useEffect(() => {
    if (!selectedProjectId) return
    const project = projects.find((p) => p.id === selectedProjectId)
    if (!project) return
    loadProto(project)
  }, [selectedProjectId])

  async function loadProto(project: GrpcProject): Promise<void> {
    setProtoLoading(true)
    setProtoError(null)
    const result = await window.api.loadProto(project)
    setProtoLoading(false)
    if (result.error) {
      setProtoError(result.error)
    } else {
      setServices(result.services)
    }
  }

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null

  return (
    <aside className="flex flex-col w-64 min-w-[220px] max-w-xs h-full border-r border-border bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-semibold text-white tracking-wide">Projects</span>
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
            No projects yet.
            <br />
            Click <strong>+</strong> to create one.
          </div>
        ) : (
          <ul className="py-1">
            {projects.map((p) => (
              <ProjectItem
                key={p.id}
                project={p}
                selected={p.id === selectedProjectId}
                onClick={() => selectProject(p.id)}
              />
            ))}
          </ul>
        )}

        {/* Service + method tree */}
        {selectedProject && (
          <ServiceTree
            services={services}
            loading={protoLoading}
            project={selectedProject}
            onReload={() => loadProto(selectedProject)}
          />
        )}
      </div>
    </aside>
  )
}

function PlusIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 1V13M1 7H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
