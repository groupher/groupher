import type { TPublicService } from '@shared/contracts'

type TProps = {
  title: string
  empty: string
  services: TPublicService[]
}

const STATUS_LABEL: Record<TPublicService['status'], string> = {
  stopped: 'Stopped',
  starting: 'Starting',
  running: 'Running',
  stopping: 'Stopping',
  external: 'External',
  error: 'Exited',
  unavailable: 'Unavailable',
}

export function DependencySection({ title, empty, services }: TProps) {
  return (
    <section className='dependency-section'>
      <header>
        <h3>{title}</h3>
        <span>{services.length}</span>
      </header>
      {services.length === 0 ? (
        <div className='dependency-empty'>{empty}</div>
      ) : (
        <ul className='dependency-list'>
          {services.map((service) => (
            <li key={service.id}>
              <span className={`dependency-status-dot dependency-status-dot--${service.status}`} />
              <span className='dependency-copy'>
                <strong>{service.name}</strong>
                <span>{service.description}</span>
              </span>
              <span className='dependency-status-label'>{STATUS_LABEL[service.status]}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
