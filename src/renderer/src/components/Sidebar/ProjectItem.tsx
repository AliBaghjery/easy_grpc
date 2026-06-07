import React from 'react'
import { useAppStore } from '../../store/appStore'
import type { GrpcProject } from '../../../../shared/types'

interface Props {
  project: GrpcProject
  selected: boolean
  onClick: () => void
}

export function ProjectItem({ project, selected, onClick }: Props): React.ReactElement {
  const { openEditProjectModal, removeProject } = useAppStore()
  const [menuOpen, setMenuOpen] = React.useState(false)

  async function handleDelete(e: React.MouseEvent): Promise<void> {
    e.stopPropagation()
    setMenuOpen(false)
    await window.api.deleteProject(project.id)
    removeProject(project.id)
  }

  function handleEdit(e: React.MouseEvent): void {
    e.stopPropagation()
    setMenuOpen(false)
    openEditProjectModal(project)
  }

  return (
    <li
      onClick={onClick}
      className={`group relative flex items-center gap-2 px-4 py-2 cursor-pointer transition-colors text-sm
        ${selected ? 'bg-accent-muted text-white' : 'text-gray-300 hover:bg-surface-overlay hover:text-white'}`}
    >
      <ServerIcon className={selected ? 'text-accent' : 'text-gray-500'} />
      <span className="flex-1 truncate">{project.name}</span>
      <span className={`text-[10px] px-1.5 rounded ${project.useTls ? 'text-success bg-success/10' : 'text-gray-500 bg-surface-overlay'}`}>
        {project.useTls ? 'TLS' : 'INS'}
      </span>

      {/* Context menu trigger */}
      <button
        onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v) }}
        className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded hover:bg-surface text-gray-400 hover:text-white transition-all"
      >
        <DotsIcon />
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-1 top-full mt-1 z-20 w-36 panel shadow-lg py-1 text-xs">
            <button
              onClick={handleEdit}
              className="w-full text-left px-3 py-1.5 hover:bg-surface-overlay text-gray-300 hover:text-white transition-colors"
            >
              Edit project
            </button>
            <button
              onClick={handleDelete}
              className="w-full text-left px-3 py-1.5 hover:bg-error/10 text-error transition-colors"
            >
              Delete project
            </button>
          </div>
        </>
      )}
    </li>
  )
}

function ServerIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <svg className={`w-3.5 h-3.5 flex-shrink-0 ${className ?? ''}`} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="3" width="14" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="1" y="9" width="14" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="12.5" cy="5" r="0.8" fill="currentColor" />
      <circle cx="12.5" cy="11" r="0.8" fill="currentColor" />
    </svg>
  )
}

function DotsIcon(): React.ReactElement {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <circle cx="6" cy="2.5" r="1" fill="currentColor" />
      <circle cx="6" cy="6" r="1" fill="currentColor" />
      <circle cx="6" cy="9.5" r="1" fill="currentColor" />
    </svg>
  )
}
