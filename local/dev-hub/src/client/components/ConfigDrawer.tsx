import { Dialog } from '@base-ui/react/dialog'
import type {
  TPublicService,
  TServiceConfigContent,
  TServiceConfigKind,
  TServiceConfigManifest,
} from '@shared/contracts'
import { AlertCircle, FileBraces, RefreshCw, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { fetchServiceConfig, fetchServiceConfigContent } from '@/lib/hub-client'

import { ConfigFileList } from './ConfigFileList'
import { ConfigFileView } from './ConfigFileView'

type TProps = {
  service: TPublicService
  onClose: () => void
}

const KIND_LABEL: Record<TServiceConfigKind, string> = {
  'next-env': 'Next.js environment',
  'elixir-config': 'Elixir configuration',
  'python-settings': 'Python settings',
  none: 'Service configuration',
}

export function ConfigDrawer({ service, onClose }: TProps) {
  const [manifest, setManifest] = useState<TServiceConfigManifest | null>(null)
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
  const [revealedFileIds, setRevealedFileIds] = useState(() => new Set<string>())
  const [content, setContent] = useState<TServiceConfigContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [contentLoading, setContentLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [contentError, setContentError] = useState<string | null>(null)
  const [requestVersion, setRequestVersion] = useState(0)
  const [contentRequestVersion, setContentRequestVersion] = useState(0)
  const selectedFile = manifest?.files.find((file) => file.id === selectedFileId) || null
  const selectedRevealed = selectedFileId ? revealedFileIds.has(selectedFileId) : false

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    void fetchServiceConfig(service.id, controller.signal)
      .then((nextManifest) => {
        setManifest(nextManifest)
        setSelectedFileId(nextManifest.files[0]?.id || null)
        setRevealedFileIds(new Set())
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Could not load service configuration.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [requestVersion, service.id])

  useEffect(() => {
    if (!selectedFileId) {
      setContent(null)
      setContentLoading(false)
      setContentError(null)
      return
    }

    const controller = new AbortController()
    setContent(null)
    setContentLoading(true)
    setContentError(null)

    void fetchServiceConfigContent(service.id, selectedFileId, selectedRevealed, controller.signal)
      .then(setContent)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setContentError(
            cause instanceof Error ? cause.message : 'Could not load configuration file.',
          )
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setContentLoading(false)
      })

    return () => controller.abort()
  }, [contentRequestVersion, selectedFileId, selectedRevealed, service.id])

  const toggleSelectedReveal = useCallback(() => {
    if (!selectedFileId) return
    setRevealedFileIds((current) => {
      const next = new Set(current)
      if (next.has(selectedFileId)) next.delete(selectedFileId)
      else next.add(selectedFileId)
      return next
    })
  }, [selectedFileId])

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className='config-drawer-backdrop' />
        <Dialog.Viewport className='config-drawer-viewport'>
          <Dialog.Popup className='config-drawer-popup' data-service-id={service.id}>
            <header className='config-drawer-header'>
              <div className='config-drawer-title-group'>
                <FileBraces aria-hidden='true' />
                <div>
                  <span className='config-drawer-kicker'>Service configuration</span>
                  <Dialog.Title>{service.name}</Dialog.Title>
                </div>
              </div>
              <Dialog.Close
                className='config-drawer-close'
                aria-label='Close service configuration'
              >
                <X aria-hidden='true' />
              </Dialog.Close>
            </header>

            <div className='config-drawer-toolbar'>
              <div>
                <strong>{manifest ? KIND_LABEL[manifest.kind] : 'Configuration'}</strong>
                {manifest?.environment ? <span>{manifest.environment}</span> : null}
              </div>
              <div>
                <span>
                  {manifest?.files.length || 0} {manifest?.files.length === 1 ? 'file' : 'files'}
                </span>
                <button
                  type='button'
                  disabled={loading}
                  onClick={() => setRequestVersion((value) => value + 1)}
                >
                  <RefreshCw className={loading ? 'spin' : ''} aria-hidden='true' />
                  Refresh
                </button>
              </div>
            </div>

            {loading ? (
              <div className='config-drawer-state'>Discovering configuration files…</div>
            ) : error ? (
              <div className='config-drawer-state is-error'>
                <AlertCircle aria-hidden='true' />
                <span>{error}</span>
                <button type='button' onClick={() => setRequestVersion((value) => value + 1)}>
                  Try again
                </button>
              </div>
            ) : manifest && manifest.files.length > 0 ? (
              <div className='config-drawer-content'>
                <aside className='config-drawer-sidebar'>
                  <ConfigFileList
                    files={manifest.files}
                    selectedFileId={selectedFileId}
                    onSelect={setSelectedFileId}
                  />
                  {manifest.environmentKeys.length > 0 ? (
                    <section className='config-environment-keys'>
                      <span>Environment keys</span>
                      <ul>
                        {manifest.environmentKeys.map((key) => (
                          <li key={key}>{key}</li>
                        ))}
                      </ul>
                    </section>
                  ) : null}
                </aside>
                {selectedFile ? (
                  <ConfigFileView
                    file={selectedFile}
                    content={content}
                    loading={contentLoading}
                    error={contentError}
                    revealed={selectedRevealed}
                    onRetry={() => setContentRequestVersion((value) => value + 1)}
                    onToggleReveal={toggleSelectedReveal}
                  />
                ) : null}
              </div>
            ) : (
              <div className='config-drawer-state'>
                <div>
                  <strong>No configuration files</strong>
                  <span>This service does not currently declare any matching local files.</span>
                </div>
              </div>
            )}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
