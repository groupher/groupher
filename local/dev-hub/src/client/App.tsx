import type { TGitDiffScope } from '@shared/contracts'
import { AlertCircle, X } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'

import { GitDiffDrawer } from '@/components/GitDiffDrawer'
import { MetricsNoticeBar } from '@/components/MetricsNoticeBar'
import { PageHeader } from '@/components/PageHeader'
import { ServiceSection } from '@/components/ServiceSection'
import { useServiceHub } from '@/hooks/useServiceHub'

const MetricsDrawer = lazy(() =>
  import('@/components/MetricsDrawer').then((module) => ({ default: module.MetricsDrawer })),
)

export function App() {
  const {
    services,
    git,
    metricsByService,
    metricNotices,
    pendingIds,
    connected,
    loading,
    error,
    toggleService,
    dismissError,
  } = useServiceHub()
  const [expandedIds, setExpandedIds] = useState(() => new Set<string>())
  const [diffScope, setDiffScope] = useState<TGitDiffScope | null>(null)
  const [metricsServiceId, setMetricsServiceId] = useState<string | null>(null)
  const metricsService = services.find((service) => service.id === metricsServiceId) || null

  useEffect(() => {
    const compactIds = new Set(
      services
        .filter((service) => service.status === 'stopped' || service.status === 'unavailable')
        .map((service) => service.id),
    )

    setExpandedIds((current) => {
      const next = new Set(current)
      for (const id of compactIds) next.delete(id)
      return next.size === current.size ? current : next
    })
  }, [services])

  const toggleTerminal = useCallback((id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  return (
    <main className='app-shell' id='top'>
      <PageHeader services={services} git={git} connected={connected} onOpenDiff={setDiffScope} />
      <MetricsNoticeBar notices={metricNotices} />

      {error ? (
        <div className='error-banner' role='alert'>
          <AlertCircle aria-hidden='true' />
          <span>{error}</span>
          <button type='button' onClick={dismissError} aria-label='Dismiss error'>
            <X aria-hidden='true' />
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className='loading-state'>Reading the local service map…</div>
      ) : (
        <>
          <ServiceSection
            title='Frontend'
            description='The public, dashboard, and local research applications.'
            group='frontend'
            services={services}
            metricsByService={metricsByService}
            expandedIds={expandedIds}
            pendingIds={pendingIds}
            onToggleService={(service) => void toggleService(service)}
            onToggleTerminal={toggleTerminal}
            onOpenMetrics={setMetricsServiceId}
          />
          <ServiceSection
            title='Backend'
            description='APIs, converters, and workers behind the product.'
            group='backend'
            services={services}
            metricsByService={metricsByService}
            expandedIds={expandedIds}
            pendingIds={pendingIds}
            onToggleService={(service) => void toggleService(service)}
            onToggleTerminal={toggleTerminal}
            onOpenMetrics={setMetricsServiceId}
          />
        </>
      )}

      <footer className='site-footer'>
        <span>Local only · 127.0.0.1</span>
        <span>Ctrl+C stops every managed process</span>
      </footer>

      <GitDiffDrawer
        scope={diffScope}
        git={git}
        onScopeChange={setDiffScope}
        onClose={() => setDiffScope(null)}
      />
      {metricsService ? (
        <Suspense fallback={null}>
          <MetricsDrawer
            service={metricsService}
            current={metricsByService[metricsService.id]}
            onClose={() => setMetricsServiceId(null)}
          />
        </Suspense>
      ) : null}
    </main>
  )
}
