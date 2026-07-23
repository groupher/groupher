import type {
  TGitSnapshot,
  TMetricStorageNotice,
  TPublicService,
  TServiceRelation,
  TServiceMetricsSnapshot,
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
  toggleService: (service: TPublicService) => Promise<void>
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
    async (service: TPublicService, action: TServiceControlAction) => {
      setPendingIds((current) => new Set(current).add(service.id))
      setError(null)

      try {
        updateService(await controlService(service.id, action))
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : `Could not ${action} ${service.name}.`)
      } finally {
        setPendingIds((current) => {
          const next = new Set(current)
          next.delete(service.id)
          return next
        })
      }
    },
    [updateService],
  )
  const toggleService = useCallback(
    (service: TPublicService) => {
      const action = ['starting', 'running'].includes(service.status) ? 'stop' : 'start'
      return runServiceAction(service, action)
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
    restartService,
    dismissError: () => setError(null),
  }
}
