import { AlertCircle, X } from 'lucide-react'
import { lazy, Suspense } from 'react'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { GitDiffDrawer } from '@/components/GitDiffDrawer'
import { MetricsNoticeBar } from '@/components/MetricsNoticeBar'
import { PageHeader } from '@/components/PageHeader'
import { ServiceSection } from '@/components/ServiceSection'
import { useAppController } from '@/hooks/useAppController'

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
const ExternalDrawer = lazy(() =>
  import('@/components/ExternalDrawer').then((module) => ({ default: module.ExternalDrawer })),
)
const InfraDrawer = lazy(() =>
  import('@/components/InfraDrawer').then((module) => ({ default: module.InfraDrawer })),
)
const FlowView = lazy(() =>
  import('@/components/FlowView').then((module) => ({ default: module.FlowView })),
)

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
    dismissError,
    expandedIds,
    activeDrawer,
    viewMode,
    metricsService,
    configService,
    dependencyService,
    externalService,
    diffScope,
    setActiveDrawer,
    toggleTerminal,
    handleToggleService,
    handleRestartService,
    handleStartService,
    openMetrics,
    openConfig,
    openDependencies,
    openExternal,
    handleStopExternal,
    closeDrawer,
    handleViewModeChange,
  } = useAppController()

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
              onOpenExternal={openExternal}
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
              onOpenExternal={openExternal}
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
              onOpenExternal={openExternal}
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
                onOpenExternal={openExternal}
              />
            </Suspense>
          </ErrorBoundary>
        )}

        <footer className='site-footer'>
          <span>Local only · 127.0.0.1</span>
          <span>
            <kbd>pnpm devhub down</kbd> stops this environment
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
        {externalService ? (
          <Suspense fallback={null}>
            <ExternalDrawer
              service={externalService}
              pending={pendingIds.has(externalService.id)}
              onClose={closeDrawer}
              onStop={handleStopExternal}
            />
          </Suspense>
        ) : null}
      </main>
    </div>
  )
}
