import type { TServiceConfigContent, TServiceConfigFile } from '@shared/contracts'
import { Check, Copy, RefreshCw } from 'lucide-react'
import { useState } from 'react'

type TProps = {
  file: TServiceConfigFile
  content: TServiceConfigContent | null
  loading: boolean
  error: string | null
  onRetry: () => void
}

export function ConfigFileView({ file, content, loading, error, onRetry }: TProps) {
  const [copiedContentKey, setCopiedContentKey] = useState<string | null>(null)
  const contentKey = getContentKey(file.id, content)
  const copied = isCopiedContent(copiedContentKey, contentKey)

  const copyContent = async () => {
    if (!content) return
    await navigator.clipboard.writeText(content.content)
    setCopiedContentKey(contentKey)
  }

  return (
    <section
      className='config-file-view'
      role='tabpanel'
      aria-labelledby={`config-file-${file.id}`}
    >
      <header className='config-file-view-header'>
        <div>
          <span>{file.path}</span>
          <small>
            {formatBytes(file.sizeBytes)} · {file.sensitive ? 'Sensitive values' : 'Read only'}
          </small>
        </div>
        <div className='config-file-actions'>
          <button type='button' disabled={!content || loading} onClick={() => void copyContent()}>
            {copied ? <Check aria-hidden='true' /> : <Copy aria-hidden='true' />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </header>

      <div className='config-code-panel'>
        {loading ? (
          <div className='config-file-state'>Loading configuration…</div>
        ) : error ? (
          <div className='config-file-state is-error'>
            <span>{error}</span>
            <button type='button' onClick={onRetry}>
              <RefreshCw aria-hidden='true' />
              Try again
            </button>
          </div>
        ) : content ? (
          <pre aria-label={`${file.name} contents`}>
            <code>
              {content.content.split('\n').map((line, index) => (
                <span className='config-code-line' key={`${index + 1}-${line}`}>
                  <span aria-hidden='true'>{index + 1}</span>
                  <span>{line || ' '}</span>
                </span>
              ))}
            </code>
          </pre>
        ) : (
          <div className='config-file-state'>Select a configuration file.</div>
        )}
      </div>
    </section>
  )
}

function getContentKey(fileId: string, content: TServiceConfigContent | null): string | null {
  return content ? `${fileId}:${content.content}` : null
}

function isCopiedContent(copiedContentKey: string | null, contentKey: string | null): boolean {
  if (contentKey === null) return false
  return copiedContentKey === contentKey
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  return `${(value / 1024).toFixed(value < 10 * 1024 ? 1 : 0)} KB`
}
