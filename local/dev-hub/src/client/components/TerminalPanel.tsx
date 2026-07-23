import type { TPublicService } from '@shared/contracts'
import { ExternalLink, Keyboard, X } from 'lucide-react'

import { Badge } from '@/components/reui/badge'

import { TerminalSurface } from './TerminalSurface'

type TProps = {
  service: TPublicService
  onClose: (id: string) => void
}

export function TerminalPanel({ service, onClose }: TProps) {
  const emptyText = service.unavailableReason || `No output from ${service.name} yet.`

  return (
    <section
      className='terminal-panel'
      data-service-id={service.id}
      id={`terminal-${service.id}`}
      aria-label={`${service.name} terminal`}
    >
      <header className='terminal-panel-header'>
        <div className='terminal-panel-title'>
          <span className='terminal-lights' aria-hidden='true'>
            <i />
            <i />
            <i />
          </span>
          <span>{service.name}</span>
          <Badge variant='outline' radius='full'>
            {service.status}
          </Badge>
        </div>
        <div className='terminal-panel-actions'>
          <span className='terminal-panel-hint'>
            <Keyboard aria-hidden='true' />
            Ctrl+C in make dev stops all Hub-managed services
          </span>
          {service.url && ['running', 'external'].includes(service.status) ? (
            <a
              href={service.url}
              target='_blank'
              rel='noreferrer'
              aria-label={`Open ${service.name}`}
            >
              <ExternalLink aria-hidden='true' />
            </a>
          ) : null}
          <button
            type='button'
            onClick={() => onClose(service.id)}
            aria-label={`Close ${service.name} terminal`}
          >
            <X aria-hidden='true' />
          </button>
        </div>
      </header>
      <div className='terminal-panel-body'>
        <TerminalSurface serviceId={service.id} mode='full' emptyText={emptyText} />
      </div>
    </section>
  )
}
