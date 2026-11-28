import type { TServiceConfigManifest } from '@shared/contracts'
import { AlertCircle } from 'lucide-react'

import { ENVIRONMENT_FILE_ID, type useServiceConfig } from '@/hooks/useServiceConfig'

import { ConfigFileList } from './ConfigFileList'
import { ConfigFileView } from './ConfigFileView'
import { ServiceEnvironmentEditor } from './ServiceEnvironmentEditor'

type TProps = {
  manifest: TServiceConfigManifest | null
  config: ReturnType<typeof useServiceConfig>
}

export function ConfigDrawerBody({ manifest, config }: TProps) {
  if (config.loading) {
    return <div className='config-drawer-state'>Discovering configuration files…</div>
  }

  if (config.error) {
    return (
      <div className='config-drawer-state is-error'>
        <AlertCircle aria-hidden='true' />
        <span>{config.error}</span>
        <button type='button' onClick={config.refresh}>
          Try again
        </button>
      </div>
    )
  }

  if (!manifest) {
    return (
      <div className='config-drawer-state'>
        <div>
          <strong>No configuration files</strong>
          <span>This service does not currently declare any matching local files.</span>
        </div>
      </div>
    )
  }

  return (
    <div className='config-drawer-content'>
      <aside className='config-drawer-sidebar'>
        <button
          type='button'
          className='config-environment-tab'
          aria-pressed={config.selectedFileId === ENVIRONMENT_FILE_ID}
          onClick={() => config.selectFile(ENVIRONMENT_FILE_ID)}
        >
          {manifest.serviceId}.env
        </button>
        <ConfigFileList
          files={manifest.files}
          selectedFileId={config.selectedFileId}
          onSelect={config.selectFile}
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
      {config.selectedFileId === ENVIRONMENT_FILE_ID ? (
        <ServiceEnvironmentEditor key={manifest.serviceId} serviceId={manifest.serviceId} />
      ) : config.selectedFile ? (
        <ConfigFileView
          file={config.selectedFile}
          content={config.content}
          loading={config.contentLoading}
          error={config.contentError}
          onRetry={config.retryContent}
        />
      ) : null}
    </div>
  )
}
