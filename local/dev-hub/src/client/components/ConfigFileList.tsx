import type { TServiceConfigFile, TServiceConfigFileGroup } from '@shared/contracts'
import { FileCode2, KeyRound } from 'lucide-react'

type TProps = {
  files: TServiceConfigFile[]
  selectedFileId: string | null
  onSelect: (fileId: string) => void
}

const GROUPS: Array<{ id: TServiceConfigFileGroup; label: string }> = [
  { id: 'active', label: 'Active' },
  { id: 'other', label: 'Other environments' },
  { id: 'template', label: 'Templates' },
]

export function ConfigFileList({ files, selectedFileId, onSelect }: TProps) {
  return (
    <nav className='config-file-list' aria-label='Configuration files'>
      {GROUPS.map((group) => {
        const groupFiles = files.filter((file) => file.group === group.id)
        if (groupFiles.length === 0) return null

        return (
          <section className='config-file-group' key={group.id}>
            <span className='config-file-group-label'>{group.label}</span>
            <div role='tablist' aria-label={group.label}>
              {groupFiles.map((file) => (
                <button
                  type='button'
                  role='tab'
                  id={`config-file-${file.id}`}
                  aria-selected={selectedFileId === file.id}
                  className={selectedFileId === file.id ? 'is-active' : ''}
                  key={file.id}
                  onClick={() => onSelect(file.id)}
                >
                  {file.sensitive ? (
                    <KeyRound aria-hidden='true' />
                  ) : (
                    <FileCode2 aria-hidden='true' />
                  )}
                  <span>{file.name}</span>
                  {file.active ? <small>Active</small> : null}
                </button>
              ))}
            </div>
          </section>
        )
      })}
    </nav>
  )
}
