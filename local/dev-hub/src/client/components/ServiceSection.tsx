import type {
  TPublicService,
  TServiceGroup,
  TServiceMetricsSnapshot,
  TServiceStartMode,
} from '@shared/contracts'
import { useEffect, useMemo, useState } from 'react'

import { buildServiceViewModel } from '@/lib/service-view-model'

import { ServiceCard } from './ServiceCard'
import { TerminalPanel } from './TerminalPanel'

type TProps = {
  title: string
  description: string
  group: TServiceGroup
  services: TPublicService[]
  metricsByService: Record<string, TServiceMetricsSnapshot>
  expandedIds: Set<string>
  pendingIds: Set<string>
  onToggleService: (service: TPublicService) => void
  onStartService: (service: TPublicService, mode: TServiceStartMode | 'default') => void
  onRestartService: (service: TPublicService) => void
  onToggleTerminal: (id: string) => void
  onOpenMetrics: (id: string) => void
  onOpenConfig: (id: string) => void
  onOpenDependencies: (id: string) => void
  onOpenExternal: (id: string) => void
}

const WIDE_SERVICES_PER_ROW = 3
const MEDIUM_SERVICES_PER_ROW = 2
const NARROW_SERVICES_PER_ROW = 1
const ACTIVE_SERVICE_STATUSES = new Set<TPublicService['status']>([
  'running',
  'starting',
  'external',
])

const isCompactService = (service: TPublicService) =>
  service.status === 'stopped' || service.status === 'unavailable'

const getServicesPerRow = () => {
  if (typeof window === 'undefined') return WIDE_SERVICES_PER_ROW
  if (window.matchMedia('(max-width: 760px)').matches) return NARROW_SERVICES_PER_ROW
  if (window.matchMedia('(max-width: 1100px)').matches) return MEDIUM_SERVICES_PER_ROW
  return WIDE_SERVICES_PER_ROW
}

const useServicesPerRow = () => {
  const [servicesPerRow, setServicesPerRow] = useState(getServicesPerRow)

  useEffect(() => {
    const mediumViewport = window.matchMedia('(max-width: 1100px)')
    const narrowViewport = window.matchMedia('(max-width: 760px)')
    const updateServicesPerRow = () => setServicesPerRow(getServicesPerRow())

    mediumViewport.addEventListener('change', updateServicesPerRow)
    narrowViewport.addEventListener('change', updateServicesPerRow)
    updateServicesPerRow()

    return () => {
      mediumViewport.removeEventListener('change', updateServicesPerRow)
      narrowViewport.removeEventListener('change', updateServicesPerRow)
    }
  }, [])

  return servicesPerRow
}

export function ServiceSection({
  title,
  description,
  group,
  services,
  metricsByService,
  expandedIds,
  pendingIds,
  onToggleService,
  onStartService,
  onRestartService,
  onToggleTerminal,
  onOpenMetrics,
  onOpenConfig,
  onOpenDependencies,
  onOpenExternal,
}: TProps) {
  const servicesPerRow = useServicesPerRow()
  const serviceViewModel = useMemo(() => buildServiceViewModel(services), [services])
  const groupedServices = services.filter((service) => service.group === group)
  const activeCount = groupedServices.filter((service) =>
    ACTIVE_SERVICE_STATUSES.has(service.status),
  ).length
  const rows: TPublicService[][] = []

  for (let index = 0; index < groupedServices.length; index += servicesPerRow) {
    rows.push(groupedServices.slice(index, index + servicesPerRow))
  }

  return (
    <section className='service-section' id={group}>
      <header className='section-header'>
        <div className='section-heading'>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <div
          className='section-summary'
          aria-label={`${activeCount} active ${title.toLowerCase()} services, ${groupedServices.length} total`}
        >
          <span
            className={`section-summary-dot ${activeCount > 0 ? 'is-active' : ''}`}
            aria-hidden='true'
          />
          <span>{activeCount} active</span>
          <span className='summary-separator'>/</span>
          <span>{groupedServices.length} total</span>
        </div>
      </header>

      <div className='service-rows'>
        {rows.map((row) => (
          <div className='service-row' key={row.map((service) => service.id).join('-')}>
            <div className='service-grid'>
              {row.map((service) =>
                (() => {
                  const dependencyState = serviceViewModel.dependencyStateByServiceId.get(
                    service.id,
                  )

                  return (
                    <ServiceCard
                      key={service.id}
                      service={service}
                      metrics={metricsByService[service.id]}
                      expanded={!isCompactService(service) && expandedIds.has(service.id)}
                      pending={pendingIds.has(service.id)}
                      hasRequiredDependencyIssue={
                        dependencyState?.hasRequiredDependencyIssue || false
                      }
                      hasStartedRequiredDependencies={
                        dependencyState?.hasStartedRequiredDependencies || false
                      }
                      hasOptionalDependencyIssue={
                        dependencyState?.hasOptionalDependencyIssue || false
                      }
                      onToggleService={onToggleService}
                      onStartService={onStartService}
                      onRestartService={onRestartService}
                      onToggleTerminal={onToggleTerminal}
                      onOpenMetrics={onOpenMetrics}
                      onOpenConfig={onOpenConfig}
                      onOpenDependencies={onOpenDependencies}
                      onOpenExternal={onOpenExternal}
                    />
                  )
                })(),
              )}
            </div>

            {row
              .filter((service) => !isCompactService(service) && expandedIds.has(service.id))
              .map((service) => (
                <TerminalPanel key={service.id} service={service} onClose={onToggleTerminal} />
              ))}
          </div>
        ))}
      </div>
    </section>
  )
}
