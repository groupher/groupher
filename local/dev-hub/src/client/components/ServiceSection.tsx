import type { TPublicService, TServiceGroup, TServiceMetricsSnapshot } from '@shared/contracts'

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
  onRestartService: (service: TPublicService) => void
  onToggleTerminal: (id: string) => void
  onOpenMetrics: (id: string) => void
}

const SERVICES_PER_ROW = 3
const ACTIVE_SERVICE_STATUSES = new Set<TPublicService['status']>([
  'running',
  'starting',
  'external',
])

const isCompactService = (service: TPublicService) =>
  service.status === 'stopped' || service.status === 'unavailable'

export function ServiceSection({
  title,
  description,
  group,
  services,
  metricsByService,
  expandedIds,
  pendingIds,
  onToggleService,
  onRestartService,
  onToggleTerminal,
  onOpenMetrics,
}: TProps) {
  const groupedServices = services.filter((service) => service.group === group)
  const activeCount = groupedServices.filter((service) =>
    ACTIVE_SERVICE_STATUSES.has(service.status),
  ).length
  const rows: TPublicService[][] = []

  for (let index = 0; index < groupedServices.length; index += SERVICES_PER_ROW) {
    rows.push(groupedServices.slice(index, index + SERVICES_PER_ROW))
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
              {row.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  metrics={metricsByService[service.id]}
                  expanded={!isCompactService(service) && expandedIds.has(service.id)}
                  pending={pendingIds.has(service.id)}
                  onToggleService={onToggleService}
                  onRestartService={onRestartService}
                  onToggleTerminal={onToggleTerminal}
                  onOpenMetrics={onOpenMetrics}
                />
              ))}
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
