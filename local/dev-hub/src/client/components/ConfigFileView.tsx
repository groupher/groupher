import type { TServiceConfigContent, TServiceConfigFile } from '@shared/contracts'
import { Check, Copy, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'

type TProps = {
  file: TServiceConfigFile
  content: TServiceConfigContent | null
  loading: boolean
  error: string | null
  revealed: boolean
  onRetry: () => void
  onToggleReveal: () => void
}

export function ConfigFileView({
  file,
  content,
  loading,
  error,
  revealed,
  onRetry,
  onToggleReveal,
}: TProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => setCopied(false), [content?.content, file.id])

  const copyContent = async () => {
    if (!content) return
    await navigator.clipboard.writeText(content.content)
    setCopied(true)
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
          {file.sensitive ? (
            <button type='button' onClick={onToggleReveal}>
              {revealed ? <EyeOff aria-hidden='true' /> : <Eye aria-hidden='true' />}
              {revealed ? 'Hide values' : 'Reveal values'}
            </button>
          ) : null}
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

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  return `${(value / 1024).toFixed(value < 10 * 1024 ? 1 : 0)} KB`
}
