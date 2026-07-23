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
  onToggleTerminal: (id: string) => void
  onOpenMetrics: (id: string) => void
}

const SERVICES_PER_ROW = 3
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
  onToggleTerminal,
  onOpenMetrics,
}: TProps) {
  const groupedServices = services.filter((service) => service.group === group)
  const rows: TPublicService[][] = []

  for (let index = 0; index < groupedServices.length; index += SERVICES_PER_ROW) {
    rows.push(groupedServices.slice(index, index + SERVICES_PER_ROW))
  }

  return (
    <section className='service-section' id={group}>
      <header className='section-header'>
        <h2>{title}</h2>
        <p>{description}</p>
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
