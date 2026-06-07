import React from 'react'
import type { GrpcMetadataEntry } from '../../../../shared/types'

interface Props {
  entries: GrpcMetadataEntry[]
  onChange: (entries: GrpcMetadataEntry[]) => void
}

export function MetadataEditor({ entries, onChange }: Props): React.ReactElement {
  function update(index: number, patch: Partial<GrpcMetadataEntry>): void {
    const updated = entries.map((e, i) => (i === index ? { ...e, ...patch } : e))
    onChange(updated)
  }

  function addRow(): void {
    onChange([...entries, { key: '', value: '', enabled: true }])
  }

  function removeRow(index: number): void {
    onChange(entries.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-col h-full p-4 gap-2">
      <div className="grid grid-cols-[20px_1fr_1fr_24px] gap-2 text-[10px] text-gray-500 font-medium uppercase tracking-wider px-1">
        <span />
        <span>Key</span>
        <span>Value</span>
        <span />
      </div>

      <div className="flex flex-col gap-1.5 flex-1 overflow-y-auto">
        {entries.map((entry, i) => (
          <div key={i} className="grid grid-cols-[20px_1fr_1fr_24px] gap-2 items-center">
            <input
              type="checkbox"
              checked={entry.enabled}
              onChange={(e) => update(i, { enabled: e.target.checked })}
              className="accent-accent w-4 h-4"
            />
            <input
              value={entry.key}
              onChange={(e) => update(i, { key: e.target.value })}
              placeholder="key"
              className="input text-xs"
            />
            <input
              value={entry.value}
              onChange={(e) => update(i, { value: e.target.value })}
              placeholder="value"
              className="input text-xs"
            />
            <button
              onClick={() => removeRow(i)}
              className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-error rounded transition-colors"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <button onClick={addRow} className="btn-ghost text-xs self-start mt-1">
        + Add entry
      </button>
    </div>
  )
}
