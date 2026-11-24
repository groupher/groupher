import type { TServiceEnvironment } from '@shared/contracts'
import { useEffect, useState } from 'react'

import { fetchServiceEnvironment, saveServiceEnvironment } from '@/lib/hub-client'

import { ServiceEnvironmentField } from './ServiceEnvironmentField'

type TProps = { serviceId: string }

export function ServiceEnvironmentEditor({ serviceId }: TProps) {
  const [environment, setEnvironment] = useState<TServiceEnvironment | null>(null)
  const [changes, setChanges] = useState<Record<string, string | null>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setError(null)
    void fetchServiceEnvironment(serviceId, controller.signal)
      .then(setEnvironment)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : 'Could not load local environment.')
      })
    return () => controller.abort()
  }, [serviceId, revision])

  const save = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      setEnvironment(await saveServiceEnvironment(serviceId, changes))
      setChanges({})
      setSaved(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save local environment.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className='service-environment' aria-label='Local environment'>
      <header>
        <strong>Local environment</strong>
        <p>
          Managed by Dev Hub. Saved changes apply on the next start. Saving does not restart
          services or migrate databases.
        </p>
        {environment ? <code>{environment.filePath}</code> : null}
      </header>
      {error ? (
        <div role='alert'>
          {error}
          <button type='button' onClick={() => setRevision((value) => value + 1)}>
            Reload
          </button>
        </div>
      ) : null}
      {!environment && !error ? <p>Loading local environment…</p> : null}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        {environment?.entries.map((entry) => (
          <ServiceEnvironmentField
            key={entry.key}
            entry={entry}
            pending={changes}
            disabled={saving}
            onChange={(value) => {
              setChanges((current) => ({ ...current, [entry.key]: value }))
              setSaved(false)
            }}
          />
        ))}
        {environment && environment.entries.length === 0 ? (
          <p>This service has no declared environment settings.</p>
        ) : null}
        <footer>
          <button type='submit' disabled={saving || Object.keys(changes).length === 0}>
            {saving ? 'Saving…' : 'Save local configuration'}
          </button>
          {saved ? <span role='status'>Saved. Applies on the next start.</span> : null}
        </footer>
      </form>
    </section>
  )
}
