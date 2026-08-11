import type { TPublicService, TServiceStartMode } from '@shared/contracts'
import { AlertCircle, X } from 'lucide-react'
import { lazy, startTransition, Suspense, useCallback, useEffect, useState } from 'react'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { GitDiffDrawer } from '@/components/GitDiffDrawer'
import { MetricsNoticeBar } from '@/components/MetricsNoticeBar'
import { PageHeader } from '@/components/PageHeader'
import { ServiceSection } from '@/components/ServiceSection'
import { useServiceHub } from '@/hooks/useServiceHub'
import type { THubDrawer, THubViewMode } from '@/spec'

const ConfigDrawer = lazy(() =>
  import('@/components/ConfigDrawer').then((module) => ({ default: module.ConfigDrawer })),
)
const MetricsDrawer = lazy(() =>
  import('@/components/MetricsDrawer').then((module) => ({ default: module.MetricsDrawer })),
)
const DependencyDrawer = lazy(() =>
  import('@/components/DependencyDrawer').then((module) => ({
    default: module.DependencyDrawer,
  })),
)
const InfraDrawer = lazy(() =>
  import('@/components/InfraDrawer').then((module) => ({ default: module.InfraDrawer })),
)
const FlowView = lazy(() =>
  import('@/components/FlowView').then((module) => ({ default: module.FlowView })),
)

const getInitialViewMode = (): THubViewMode =>
  new URLSearchParams(window.location.search).get('view') === 'flow' ? 'flow' : 'list'

export function App() {
  const {
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
    dismissError,
  } = useServiceHub()
  const [expandedIds, setExpandedIds] = useState(() => new Set<string>())
  const [activeDrawer, setActiveDrawer] = useState<THubDrawer>(null)
  const [viewMode, setViewMode] = useState<THubViewMode>(getInitialViewMode)
  const metricsService =
    activeDrawer?.kind === 'metrics'
      ? services.find((service) => service.id === activeDrawer.serviceId) || null
      : null
  const configService =
    activeDrawer?.kind === 'config'
      ? services.find((service) => service.id === activeDrawer.serviceId) || null
      : null
  const dependencyService =
    activeDrawer?.kind === 'dependencies'
      ? services.find((service) => service.id === activeDrawer.serviceId) || null
      : null
  const diffScope = activeDrawer?.kind === 'git' ? activeDrawer.scope : null

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

  const handleToggleService = useCallback(
    (service: TPublicService) => {
      void toggleService(service)
    },
    [toggleService],
  )
  const handleRestartService = useCallback(
    (service: TPublicService) => {
      void restartService(service)
    },
    [restartService],
  )
  const handleStartService = useCallback(
    (service: TPublicService, mode: TServiceStartMode | 'default') => {
      void startService(service, mode)
    },
    [startService],
  )
  const openMetrics = useCallback(
    (serviceId: string) => setActiveDrawer({ kind: 'metrics', serviceId }),
    [],
  )
  const openConfig = useCallback(
    (serviceId: string) => setActiveDrawer({ kind: 'config', serviceId }),
    [],
  )
  const openDependencies = useCallback(
    (serviceId: string) => setActiveDrawer({ kind: 'dependencies', serviceId }),
    [],
  )
  const closeDrawer = useCallback(() => setActiveDrawer(null), [])

  const handleViewModeChange = useCallback((mode: THubViewMode) => {
    const url = new URL(window.location.href)
    if (mode === 'flow') url.searchParams.set('view', 'flow')
    else url.searchParams.delete('view')
    window.history.replaceState(null, '', url)

    startTransition(() => setViewMode(mode))
  }, [])

  return (
    <div className='window-frame'>
      <div className='window-drag-region' data-tauri-drag-region='deep' aria-hidden='true' />
      <main className='app-shell' id='top'>
        <PageHeader
          services={services}
          git={git}
          connected={connected}
          viewMode={viewMode}
          onOpenDiff={(scope) => setActiveDrawer({ kind: 'git', scope })}
          onOpenInfra={() => setActiveDrawer({ kind: 'infra' })}
          onViewModeChange={handleViewModeChange}
        />
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
        ) : viewMode === 'list' ? (
          <>
            <ServiceSection
              title='Frontend'
              description='The public, dashboard, and local research applications.'
              group='frontend'
              services={services}
              metricsByService={metricsByService}
              expandedIds={expandedIds}
              pendingIds={pendingIds}
              onToggleService={handleToggleService}
              onStartService={handleStartService}
              onRestartService={handleRestartService}
              onToggleTerminal={toggleTerminal}
              onOpenMetrics={openMetrics}
              onOpenConfig={openConfig}
              onOpenDependencies={openDependencies}
            />
            <ServiceSection
              title='Backend'
              description='APIs, converters, and workers behind the product.'
              group='backend'
              services={services}
              metricsByService={metricsByService}
              expandedIds={expandedIds}
              pendingIds={pendingIds}
              onToggleService={handleToggleService}
              onStartService={handleStartService}
              onRestartService={handleRestartService}
              onToggleTerminal={toggleTerminal}
              onOpenMetrics={openMetrics}
              onOpenConfig={openConfig}
              onOpenDependencies={openDependencies}
            />
            <ServiceSection
              title='Infrastructure'
              description='Local tools that observe or support the application services.'
              group='infra'
              services={services}
              metricsByService={metricsByService}
              expandedIds={expandedIds}
              pendingIds={pendingIds}
              onToggleService={handleToggleService}
              onStartService={handleStartService}
              onRestartService={handleRestartService}
              onToggleTerminal={toggleTerminal}
              onOpenMetrics={openMetrics}
              onOpenConfig={openConfig}
              onOpenDependencies={openDependencies}
            />
          </>
        ) : (
          <ErrorBoundary
            title='The Flow canvas could not be displayed'
            message='The service controls are still available in the list view.'
            actionLabel='Back to list'
            variant='flow'
            onReset={() => handleViewModeChange('list')}
          >
            <Suspense fallback={<div className='flow-loading'>Loading the Flow canvas…</div>}>
              <FlowView
                services={services}
                relations={relations}
                metricsByService={metricsByService}
                expandedIds={expandedIds}
                pendingIds={pendingIds}
                onToggleService={handleToggleService}
                onStartService={handleStartService}
                onRestartService={handleRestartService}
                onToggleTerminal={toggleTerminal}
                onOpenMetrics={openMetrics}
                onOpenConfig={openConfig}
                onOpenDependencies={openDependencies}
              />
            </Suspense>
          </ErrorBoundary>
        )}

        <footer className='site-footer'>
          <span>Local only · 127.0.0.1</span>
          <span>
            <kbd>Ctrl+C</kbd> stops every managed process
          </span>
        </footer>

        <GitDiffDrawer
          scope={diffScope}
          git={git}
          onScopeChange={(scope) => setActiveDrawer({ kind: 'git', scope })}
          onClose={closeDrawer}
        />
        {activeDrawer?.kind === 'infra' ? (
          <Suspense fallback={null}>
            <InfraDrawer onClose={closeDrawer} />
          </Suspense>
        ) : null}
        {metricsService ? (
          <Suspense fallback={null}>
            <MetricsDrawer
              service={metricsService}
              current={metricsByService[metricsService.id]}
              onClose={closeDrawer}
            />
          </Suspense>
        ) : null}
        {configService ? (
          <Suspense fallback={null}>
            <ConfigDrawer service={configService} onClose={closeDrawer} />
          </Suspense>
        ) : null}
        {dependencyService ? (
          <Suspense fallback={null}>
            <DependencyDrawer
              service={dependencyService}
              services={services}
              onClose={closeDrawer}
            />
          </Suspense>
        ) : null}
      </main>
    </div>
  )
}
