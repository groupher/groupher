'use client'

/**
 * Client-side phase controller for the recoverable Docs import experience.
 *
 *   repo -> analyzing -> review -> importing -> completed
 *             |                       |
 *             +---- polling ----------+
 *             `---- URL recovery: ?preview= / ?job=
 *
 * Polling projects server facts and never acts as the source of truth. Stage
 * updates are monotonic within Preview and Job phases to avoid visual rollback.
 *
 * @see docs/bulk-import/bulk-import.md
 * @see docs/bulk-import/import-process-log.md
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { browserQuery } from '~/graphql/client'
import useTrans from '~/hooks/useTrans'
import { useRouteScope } from '~/platform'
import useCommunity from '~/stores/community/hooks'

import { decodeImportProcess } from '../../ContentImport/ProcessLog/decoder'
import type { TImportProcess, TImportProcessStage } from '../../ContentImport/ProcessLog/spec'
import { PHASE } from './constant'
import S from './schema'
import type { TContentImportJob, TDocImportPreview, TImportApplyResult, TImportPhase } from './spec'

type TRet = {
  analyze: () => Promise<void>
  apply: (selectedSourceIds: string[]) => Promise<void>
  error: string
  job: TContentImportJob | null
  phase: TImportPhase
  pollingDisconnected: boolean
  preview: TDocImportPreview | null
  process: TImportProcess | null
  repoUrl: string
  reset: () => Promise<boolean>
  setRepoUrl: (value: string) => void
}

const errorMessage = (cause: unknown): string =>
  cause instanceof Error ? cause.message : 'The bulk import could not be completed.'

const ACTIVE_POLL_INTERVAL_MS = 1_200
const HIDDEN_POLL_INTERVAL_MS = 5_000
const PROCESS_STAGE_ORDER: TImportProcessStage[] = [
  'analyzing',
  'building_preview',
  'preparing',
  'applying',
]

const initialProcess = (stage: TImportProcessStage, total?: number): TImportProcess => ({
  progress: total === undefined ? undefined : { completed: 0, total, unit: 'document' as const },
  recentBatch: [],
  stage,
  state: 'queued',
  updatedAt: new Date().toISOString(),
})

const preserveMonotonicStage = (
  current: TImportProcess | null,
  next: TImportProcess,
): TImportProcess => {
  if (!current) return next
  const currentIndex = PROCESS_STAGE_ORDER.indexOf(current.stage)
  const nextIndex = PROCESS_STAGE_ORDER.indexOf(next.stage)
  const currentIsPreview = currentIndex < 2
  const nextIsPreview = nextIndex < 2
  const sameProcess = currentIsPreview === nextIsPreview

  return sameProcess && nextIndex < currentIndex ? { ...next, stage: current.stage } : next
}

/** Coordinates analyze/apply requests, URL recovery, polling, reset, and UI phases. */
export default function useLogic(): TRet {
  const { slug: community } = useCommunity()
  const { t } = useTrans()
  const { navi } = useRouteScope()
  const searchParams = navi.location.searchParams
  const initialJobRef = searchParams.get('job')
  const initialPreviewRef = searchParams.get('preview') || ''
  const [previewRef, setPreviewRef] = useState(initialPreviewRef)
  const [jobRef, setJobRef] = useState(initialJobRef || '')
  const idempotencyKey = useRef(crypto.randomUUID())
  const [repoUrl, setRepoUrl] = useState('')
  const [preview, setPreview] = useState<TDocImportPreview | null>(null)
  const [job, setJob] = useState<TContentImportJob | null>(null)
  const [process, setProcess] = useState<TImportProcess | null>(() =>
    initialJobRef
      ? initialProcess('preparing')
      : initialPreviewRef
        ? initialProcess('analyzing')
        : null,
  )
  const [pollingDisconnected, setPollingDisconnected] = useState(false)
  const [phase, setPhase] = useState<TImportPhase>(
    initialJobRef ? PHASE.IMPORTING : previewRef ? PHASE.ANALYZING : PHASE.REPO,
  )
  const [error, setError] = useState('')
  const applyInFlight = useRef<Promise<void> | null>(null)

  const commitProcess = useCallback((next: TImportProcess): void => {
    setProcess((current) => preserveMonotonicStage(current, next))
  }, [])

  const loadJob = useCallback(
    async (jobRef: string): Promise<TContentImportJob> => {
      const data = await browserQuery<{
        contentImportJob: Omit<TContentImportJob, 'process'> & { process: unknown }
      }>(S.job, { community, jobRef })
      const latest = {
        ...data.contentImportJob,
        process: decodeImportProcess(data.contentImportJob.process),
      }
      return latest
    },
    [community],
  )

  const analyze = useCallback(async (): Promise<void> => {
    setError('')
    setPollingDisconnected(false)
    setProcess(initialProcess('analyzing'))
    setPhase(PHASE.ANALYZING)
    try {
      const response = await fetch('/api/docs/import/previews', {
        body: JSON.stringify({
          community,
          idempotencyKey: idempotencyKey.current,
          repoUrl: repoUrl.trim(),
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      const payload = (await response.json()) as {
        error?: { message?: string }
        previewRef?: string
      }
      if (!response.ok || !payload.previewRef)
        throw new Error(payload.error?.message || 'Analyze failed.')
      setPreviewRef(payload.previewRef)
      const url = new URL(window.location.href)
      url.searchParams.set('preview', payload.previewRef)
      window.history.replaceState(null, '', url)
    } catch (cause) {
      setError(errorMessage(cause))
      setPhase(PHASE.FAILED)
    }
  }, [community, repoUrl])

  useEffect(() => {
    if (!previewRef || phase !== PHASE.ANALYZING) return
    let disposed = false
    let inFlight = false
    let timer: number | null = null

    const schedule = (): void => {
      if (disposed) return
      timer = window.setTimeout(
        () => void poll(),
        document.hidden ? HIDDEN_POLL_INTERVAL_MS : ACTIVE_POLL_INTERVAL_MS,
      )
    }

    const poll = async (): Promise<void> => {
      if (disposed || inFlight) return
      inFlight = true
      let terminal = false

      try {
        const response = await fetch(
          `/api/docs/import/previews/${encodeURIComponent(previewRef)}?community=${encodeURIComponent(community)}`,
          { cache: 'no-store' },
        )
        const payload = (await response.json()) as {
          error?: { code?: string; message?: string }
          preview?: TDocImportPreview
          process?: unknown
          status?: string
        }
        if (disposed) return
        if (payload.process) commitProcess(decodeImportProcess(payload.process))

        if (!response.ok || payload.status === 'failed') {
          const previewUnavailable =
            payload.error?.code === 'preview_not_found' || payload.error?.code === 'preview_expired'
          setError(
            previewUnavailable
              ? t('dsb.doc.bulk_import.preview_unavailable')
              : payload.error?.message || 'Analyze failed.',
          )
          setPhase(PHASE.FAILED)
          terminal = true
          return
        }

        setPollingDisconnected(false)
        if (payload.status === 'ready' && payload.preview) {
          setPreview(payload.preview)
          setRepoUrl(payload.preview.sourceInfo.repoUrl)
          setPhase(PHASE.REVIEW)
          terminal = true
        }
      } catch (_cause) {
        if (!disposed) setPollingDisconnected(true)
      } finally {
        inFlight = false
        if (!terminal) schedule()
      }
    }

    const handleVisibility = (): void => {
      if (document.hidden || inFlight) return
      if (timer !== null) window.clearTimeout(timer)
      void poll()
    }

    document.addEventListener('visibilitychange', handleVisibility)
    void poll()

    return () => {
      disposed = true
      if (timer !== null) window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [commitProcess, community, phase, previewRef, t])

  const apply = useCallback(
    (selectedSourceIds: string[]): Promise<void> => {
      const operation = (async (): Promise<void> => {
        if (!preview) return
        setError('')
        setJob(null)
        setPollingDisconnected(false)
        setProcess(initialProcess('preparing', selectedSourceIds.length))
        setPhase(PHASE.IMPORTING)
        try {
          const response = await fetch(`/api/docs/import/previews/${preview.previewRef}/apply`, {
            body: JSON.stringify({ community, selectedSourceIds }),
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
          })
          const payload = (await response.json()) as TImportApplyResult & {
            error?: { code?: string; message?: string }
          }
          if (!response.ok || !payload.jobRef) {
            const previewUnavailable =
              payload.error?.code === 'preview_not_found' ||
              payload.error?.code === 'preview_expired'
            throw new Error(
              previewUnavailable
                ? t('dsb.doc.bulk_import.preview_unavailable')
                : payload.error?.message || 'Import failed.',
            )
          }
          const url = new URL(window.location.href)
          url.searchParams.set('job', payload.jobRef)
          window.history.replaceState(null, '', url)
          setJobRef(payload.jobRef)
        } catch (cause) {
          setError(errorMessage(cause))
          setPhase(PHASE.FAILED)
        }
      })()

      applyInFlight.current = operation
      void operation.finally(() => {
        if (applyInFlight.current === operation) applyInFlight.current = null
      })
      return operation
    },
    [community, preview, t],
  )

  useEffect(() => {
    if (phase !== PHASE.IMPORTING || !jobRef) return
    let disposed = false
    let inFlight = false
    let timer: number | null = null

    const schedule = (): void => {
      if (disposed) return
      timer = window.setTimeout(
        () => void poll(),
        document.hidden ? HIDDEN_POLL_INTERVAL_MS : ACTIVE_POLL_INTERVAL_MS,
      )
    }

    const poll = async (): Promise<void> => {
      if (disposed || inFlight) return
      inFlight = true
      let terminal = false

      try {
        const latest = await loadJob(jobRef)
        if (disposed) return
        setJob(latest)
        commitProcess(latest.process)
        setPollingDisconnected(false)
        const status = latest.status.toLowerCase()
        if (status === 'completed') {
          setPhase(PHASE.COMPLETED)
          terminal = true
        }
        if (status === 'failed' || status === 'cancelled') {
          setError(latest.errorMessage || 'The bulk import could not be completed.')
          setPhase(PHASE.FAILED)
          terminal = true
        }
      } catch (_cause) {
        if (!disposed) setPollingDisconnected(true)
      } finally {
        inFlight = false
        if (!terminal) schedule()
      }
    }

    const handleVisibility = (): void => {
      if (document.hidden || inFlight) return
      if (timer !== null) window.clearTimeout(timer)
      void poll()
    }

    document.addEventListener('visibilitychange', handleVisibility)
    void poll()

    return () => {
      disposed = true
      if (timer !== null) window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [commitProcess, jobRef, loadJob, phase])

  const reset = useCallback(async (): Promise<boolean> => {
    setError('')
    try {
      await applyInFlight.current
      if (previewRef) {
        const response = await fetch(
          `/api/docs/import/previews/${encodeURIComponent(previewRef)}?community=${encodeURIComponent(community)}`,
          { method: 'DELETE' },
        )
        const payload = (await response.json()) as { error?: { message?: string }; ok?: boolean }
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error?.message || 'Could not remove the import preview.')
        }
      }
      setJob(null)
      setJobRef('')
      setPollingDisconnected(false)
      setPreview(null)
      setPreviewRef('')
      setProcess(null)
      idempotencyKey.current = crypto.randomUUID()
      setPhase(PHASE.REPO)
      const url = new URL(window.location.href)
      url.searchParams.delete('job')
      url.searchParams.delete('preview')
      window.history.replaceState(null, '', url)
      return true
    } catch (cause) {
      setError(errorMessage(cause))
      setPhase(PHASE.FAILED)
      return false
    }
  }, [community, previewRef])

  return useMemo(
    () => ({
      analyze,
      apply,
      error,
      job,
      phase,
      pollingDisconnected,
      preview,
      process,
      repoUrl,
      reset,
      setRepoUrl,
    }),
    [analyze, apply, error, job, phase, pollingDisconnected, preview, process, repoUrl, reset],
  )
}
