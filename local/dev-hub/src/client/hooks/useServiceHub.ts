import type {
  TGitSnapshot,
  TMetricStorageNotice,
  TPublicService,
  TServiceRelation,
  TServiceMetricsSnapshot,
  TServiceStartMode,
} from '@shared/contracts'
import { useCallback, useEffect, useState } from 'react'

import {
  connectHub,
  controlService,
  fetchSnapshot,
  type TServiceControlAction,
} from '@/lib/hub-client'

type TServiceHub = {
  services: TPublicService[]
  relations: TServiceRelation[]
  git: TGitSnapshot | null
  metricsByService: Record<string, TServiceMetricsSnapshot>
  metricNotices: TMetricStorageNotice[]
  pendingIds: Set<string>
  connected: boolean
  loading: boolean
  error: string | null
  toggleService: (service: TPublicService, mode?: TServiceStartMode | 'default') => Promise<void>
  startService: (service: TPublicService, mode?: TServiceStartMode | 'default') => Promise<void>
  restartService: (service: TPublicService) => Promise<void>
  dismissError: () => void
}

export function useServiceHub(): TServiceHub {
  const [services, setServices] = useState<TPublicService[]>([])
  const [relations, setRelations] = useState<TServiceRelation[]>([])
  const [git, setGit] = useState<TGitSnapshot | null>(null)
  const [metricsByService, setMetricsByService] = useState<Record<string, TServiceMetricsSnapshot>>(
    {},
  )
  const [metricNotices, setMetricNotices] = useState<TMetricStorageNotice[]>([])
  const [pendingIds, setPendingIds] = useState(() => new Set<string>())
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const updateService = useCallback((nextService: TPublicService) => {
    setServices((current) =>
      current.map((service) => (service.id === nextService.id ? nextService : service)),
    )
  }, [])

  const updateServices = useCallback((nextServices: TPublicService[]) => {
    if (nextServices.length === 0) return

    setServices((current) => {
      const nextById = new Map(nextServices.map((service) => [service.id, service]))
      return current.map((service) => nextById.get(service.id) || service)
    })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const disconnect = connectHub({
      onSnapshot: (snapshot) => {
        setServices(snapshot.services)
        setRelations(snapshot.relations)
        setGit(snapshot.git)
        setMetricsByService(snapshot.metrics)
        setMetricNotices(snapshot.metricNotices)
        setLoading(false)
      },
      onStatus: updateService,
      onGit: setGit,
      onMetrics: (serviceId, metrics) => {
        setMetricsByService((current) => ({ ...current, [serviceId]: metrics }))
      },
      onMetricNotices: setMetricNotices,
      onConnectionChange: setConnected,
    })

    void fetchSnapshot(controller.signal)
      .then((snapshot) => {
        setServices(snapshot.services)
        setRelations(snapshot.relations)
        setGit(snapshot.git)
        setMetricsByService(snapshot.metrics)
        setMetricNotices(snapshot.metricNotices)
        setLoading(false)
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        setLoading(false)
        setError(cause instanceof Error ? cause.message : 'Could not connect to Dev Hub.')
      })

    return () => {
      controller.abort()
      disconnect()
    }
  }, [updateService])

  const runServiceAction = useCallback(
    async (
      service: TPublicService,
      action: TServiceControlAction,
      mode?: TServiceStartMode | 'default',
    ) => {
      const actionIds =
        action === 'start' ? getStartActionIds(service, mode || 'default') : [service.id]
      setPendingIds((current) => {
        const next = new Set(current)
        for (const id of actionIds) next.add(id)
        return next
      })
      setError(null)

      try {
        const nextServices = await controlService(service.id, action, mode)
        updateServices(nextServices)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : `Could not ${action} ${service.name}.`)
      } finally {
        setPendingIds((current) => {
          const next = new Set(current)
          for (const id of actionIds) next.delete(id)
          return next
        })
      }
    },
    [updateServices],
  )
  const startService = useCallback(
    (service: TPublicService, mode: TServiceStartMode | 'default' = 'default') =>
      runServiceAction(service, 'start', mode),
    [runServiceAction],
  )
  const toggleService = useCallback(
    (service: TPublicService, mode?: TServiceStartMode | 'default') => {
      const action = ['starting', 'running'].includes(service.status) ? 'stop' : 'start'
      return runServiceAction(service, action, action === 'start' ? mode : undefined)
    },
    [runServiceAction],
  )
  const restartService = useCallback(
    (service: TPublicService) => runServiceAction(service, 'restart'),
    [runServiceAction],
  )

  return {
    services,
    relations,
    git,
    metricsByService,
    metricNotices,
    pendingIds,
    connected,
    loading,
    error,
    toggleService,
    startService,
    restartService,
    dismissError: () => setError(null),
  }
}

function getStartActionIds(service: TPublicService, mode: TServiceStartMode | 'default'): string[] {
  const resolvedMode = mode === 'default' ? service.startPolicy.defaultMode : mode
  if (resolvedMode === 'self') return [service.id]

  const ids = [...service.startPolicy.requiredDependencies, service.id]
  if (resolvedMode === 'related') ids.push(...service.startPolicy.optionalDependencies)
  return Array.from(new Set(ids))
}
