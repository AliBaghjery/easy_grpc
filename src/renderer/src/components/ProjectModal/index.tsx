import React, { useEffect, useState } from 'react'
import { useAppStore } from '../../store/appStore'
import type { GrpcProject, ProtoSourceType } from '../../../../shared/types'

export function ProjectModal(): React.ReactElement | null {
  const { showProjectModal, editingProject, closeProjectModal, addProject, updateProject } = useAppStore()

  const [name, setName] = useState('')
  const [host, setHost] = useState('localhost')
  const [port, setPort] = useState('50051')
  const [useTls, setUseTls] = useState(false)
  const [tlsCertPath, setTlsCertPath] = useState('')
  const [sourceType, setSourceType] = useState<ProtoSourceType>('file')
  const [sourcePath, setSourcePath] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (editingProject) {
      setName(editingProject.name)
      setHost(editingProject.host)
      setPort(String(editingProject.port))
      setUseTls(editingProject.useTls)
      setTlsCertPath(editingProject.tlsCertPath ?? '')
      setSourceType(editingProject.protoSource.type)
      setSourcePath(editingProject.protoSource.path)
    } else {
      setName('')
      setHost('localhost')
      setPort('50051')
      setUseTls(false)
      setTlsCertPath('')
      setSourceType('file')
      setSourcePath('')
    }
    setError(null)
  }, [editingProject, showProjectModal])

  if (!showProjectModal) return null

  async function handleBrowse(): Promise<void> {
    if (sourceType === 'file') {
      const path = await window.api.pickProtoFile()
      if (path) setSourcePath(path)
    } else if (sourceType === 'folder') {
      const path = await window.api.pickProtoFolder()
      if (path) setSourcePath(path)
    }
  }

  async function handleSave(): Promise<void> {
    setError(null)
    if (!name.trim()) { setError('Project name is required'); return }
    if (!host.trim()) { setError('Host is required'); return }
    const portNum = parseInt(port, 10)
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) { setError('Invalid port number'); return }
    if (sourceType !== 'reflection' && !sourcePath.trim()) { setError('Proto path is required'); return }
    if (sourceType === 'reflection' && !host.trim()) { setError('Host is required for reflection'); return }

    setSaving(true)
    try {
      const projectData = {
        name: name.trim(),
        host: host.trim(),
        port: portNum,
        useTls,
        tlsCertPath: tlsCertPath.trim() || undefined,
        protoSource: {
          type: sourceType,
          path: sourceType === 'reflection' ? `${host}:${port}` : sourcePath.trim()
        },
        metadata: editingProject?.metadata ?? []
      }

      if (editingProject) {
        const updated = await window.api.updateProject({ ...editingProject, ...projectData })
        updateProject(updated)
      } else {
        const created = await window.api.createProject(projectData)
        addProject(created)
      }
      closeProjectModal()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save project')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeProjectModal} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg panel shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-white">
            {editingProject ? 'Edit Project' : 'New Project'}
          </h2>
          <button onClick={closeProjectModal} className="btn-ghost w-7 h-7 p-0 justify-center">✕</button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="label">Project name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="My gRPC Service" />
          </div>

          {/* Host + Port */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="label">Host</label>
              <input value={host} onChange={(e) => setHost(e.target.value)} className="input" placeholder="localhost" />
            </div>
            <div>
              <label className="label">Port</label>
              <input value={port} onChange={(e) => setPort(e.target.value)} className="input" placeholder="50051" type="number" min="1" max="65535" />
            </div>
          </div>

          {/* TLS */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useTls}
                onChange={(e) => setUseTls(e.target.checked)}
                className="accent-accent w-4 h-4"
              />
              <span className="text-sm text-gray-300">Use TLS</span>
            </label>
            {useTls && (
              <input
                value={tlsCertPath}
                onChange={(e) => setTlsCertPath(e.target.value)}
                className="input flex-1 text-xs"
                placeholder="Path to CA cert (optional)"
              />
            )}
          </div>

          {/* Proto source */}
          <div>
            <label className="label">Proto source</label>
            <div className="flex gap-2 mb-3">
              {(['file', 'folder', 'reflection'] as ProtoSourceType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => { setSourceType(t); setSourcePath('') }}
                  className={`flex-1 py-1.5 text-xs rounded-md border transition-colors
                    ${sourceType === t
                      ? 'border-accent bg-accent-muted text-white'
                      : 'border-border bg-surface-overlay text-gray-400 hover:text-white'
                    }`}
                >
                  {t === 'file' ? '.proto File' : t === 'folder' ? 'Folder' : 'Reflection'}
                </button>
              ))}
            </div>

            {sourceType === 'reflection' ? (
              <p className="text-xs text-gray-500">
                Services will be loaded via gRPC Server Reflection from <span className="font-mono text-gray-400">{host || 'host'}:{port || 'port'}</span>
              </p>
            ) : (
              <div className="flex gap-2">
                <input
                  value={sourcePath}
                  onChange={(e) => setSourcePath(e.target.value)}
                  className="input flex-1 text-xs font-mono"
                  placeholder={sourceType === 'file' ? '/path/to/service.proto' : '/path/to/protos/'}
                />
                <button onClick={handleBrowse} className="btn-ghost text-xs whitespace-nowrap">
                  Browse…
                </button>
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs text-error bg-error/10 rounded-md px-3 py-2">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <button onClick={closeProjectModal} className="btn-ghost">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? 'Saving…' : editingProject ? 'Save changes' : 'Create project'}
          </button>
        </div>
      </div>
    </div>
  )
}
