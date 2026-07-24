import type { TPublicService, TServiceMetricsSnapshot } from '@shared/contracts'
import {
  BrushCleaning,
  Circle,
  ExternalLink,
  FileBraces,
  LoaderCircle,
  Play,
  RotateCw,
  SquareTerminal,
} from 'lucide-react'
import { AnimatePresence, motion, MotionConfig } from 'motion/react'

import { Badge, type BadgeProps } from '@/components/reui/badge'
import { openExternalUrl } from '@/lib/open-external-url'

import { ServiceActionButton } from './ServiceActionButton'
import { ServiceMetricsStrip } from './ServiceMetricsStrip'
import { ServiceStackMark } from './ServiceStackMark'
import { TerminalSurface } from './TerminalSurface'
import { Uptime } from './Uptime'

type TProps = {
  service: TPublicService
  metrics?: TServiceMetricsSnapshot
  expanded: boolean
  pending: boolean
  onToggleService: (service: TPublicService) => void
  onRestartService: (service: TPublicService) => void
  onToggleTerminal: (id: string) => void
  onOpenMetrics: (id: string) => void
  onOpenConfig: (id: string) => void
}

const STATUS_LABEL: Record<TPublicService['status'], string> = {
  stopped: 'Stopped',
  starting: 'Starting',
  running: 'Running',
  stopping: 'Stopping',
  external: 'External',
  error: 'Exited',
  unavailable: 'Planned',
}

const STATUS_VARIANT: Record<TPublicService['status'], BadgeProps['variant']> = {
  stopped: 'outline',
  starting: 'info-light',
  running: 'success-light',
  stopping: 'warning-light',
  external: 'warning-light',
  error: 'destructive-light',
  unavailable: 'secondary',
}

const CARD_SPRING = {
  type: 'spring',
  duration: 0.3,
  bounce: 0,
} as const

export function ServiceCard({
  service,
  metrics,
  expanded,
  pending,
  onToggleService,
  onRestartService,
  onToggleTerminal,
  onOpenMetrics,
  onOpenConfig,
}: TProps) {
  const active = ['starting', 'running', 'stopping'].includes(service.status)
  const stoppable = ['starting', 'running'].includes(service.status)
  const disabled =
    pending || service.status === 'stopping' || !service.canStart || service.status === 'external'
  const restartDisabled =
    pending || service.status === 'stopping' || !service.canStart || service.status === 'external'
  const emptyText = service.unavailableReason || `${service.name} is ${service.status}.`
  const compact = service.status === 'stopped' || service.status === 'unavailable'
  const actionLabel =
    service.status === 'stopping'
      ? 'Stopping'
      : stoppable
        ? 'Stop'
        : service.status === 'external'
          ? 'External'
          : 'Start'

  return (
    <MotionConfig reducedMotion='user'>
      <article className='service-card' data-service-id={service.id}>
        <div className={`service-visual ${compact ? 'is-compact' : ''}`}>
          <header className='service-meta'>
            <div className='service-identity'>
              <ServiceStackMark
                name={service.name}
                monogram={service.monogram}
                technologies={service.technologies}
              />
              <span className='service-copy'>
                <span className='service-title-row'>
                  <span className='service-name'>{service.name}</span>
                  {service.url && service.status === 'running' ? (
                    <a
                      className='open-service'
                      href={service.url}
                      target='_blank'
                      rel='noreferrer'
                      aria-label={`Open ${service.name}`}
                      onClick={(event) => {
                        event.preventDefault()
                        openExternalUrl(event.currentTarget.href)
                      }}
                    >
                      <ExternalLink aria-hidden='true' />
                    </a>
                  ) : null}
                </span>
                <span className='service-description'>{service.description}</span>
              </span>
            </div>
            <div className={`service-status-group ${compact ? 'is-compact' : ''}`}>
              {!compact || !service.canStart ? (
                <Badge
                  className='service-status-badge'
                  variant={STATUS_VARIANT[service.status]}
                  radius='full'
                  size='lg'
                >
                  <span className={`status-dot status-dot--${service.status}`} />
                  {STATUS_LABEL[service.status]}
                </Badge>
              ) : null}
              {compact && service.canStart ? (
                <button
                  type='button'
                  className='service-inline-start'
                  disabled={disabled}
                  onClick={() => onToggleService(service)}
                  aria-label={`${pending ? 'Starting' : 'Start'} ${service.name}`}
                >
                  {pending ? (
                    <LoaderCircle className='spin' aria-hidden='true' />
                  ) : (
                    <Play className='play-icon' aria-hidden='true' />
                  )}
                  <span>Start</span>
                </button>
              ) : null}
              {service.port && service.status === 'running' ? (
                <span className='service-port'>:{service.port}</span>
              ) : null}
            </div>
          </header>

          <AnimatePresence initial={false}>
            {!compact ? (
              <motion.div
                key='service-preview'
                className='service-preview-reveal'
                initial={{ height: 0, opacity: 0, y: -6 }}
                animate={{ height: 'auto', opacity: 1, y: 0 }}
                exit={{ height: 0, opacity: 0, y: -4 }}
                transition={CARD_SPRING}
              >
                <div className='terminal-preview-frame'>
                  <div className='terminal-preview-logs'>
                    <TerminalSurface serviceId={service.id} mode='preview' emptyText={emptyText} />
                  </div>
                  <ServiceMetricsStrip
                    service={service}
                    metrics={metrics}
                    onOpen={() => onOpenMetrics(service.id)}
                  />
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <AnimatePresence initial={false}>
          {!compact ? (
            <motion.div
              key='service-actions'
              className='service-actions-reveal'
              initial={{ height: 0, opacity: 0, y: -4 }}
              animate={{ height: 'auto', opacity: 1, y: 0 }}
              exit={{ height: 0, opacity: 0, y: -3 }}
              transition={CARD_SPRING}
            >
              <footer className='service-actions'>
                <div className='service-action service-action--terminal'>
                  <ServiceActionButton
                    type='button'
                    className={`service-terminal-action ${expanded ? 'is-active' : ''}`}
                    onClick={() => onToggleTerminal(service.id)}
                    aria-label={`${expanded ? 'Close' : 'Open'} ${service.name} terminal`}
                    aria-expanded={expanded}
                    aria-controls={`terminal-${service.id}`}
                    tooltip='Terminal'
                  >
                    <SquareTerminal aria-hidden='true' />
                  </ServiceActionButton>
                  <ServiceActionButton
                    type='button'
                    className='service-terminal-action'
                    onClick={restartDisabled ? undefined : () => onRestartService(service)}
                    aria-label={`Restart ${service.name}`}
                    aria-disabled={restartDisabled}
                    tooltip='Restart service'
                  >
                    {pending ? (
                      <LoaderCircle className='spin' aria-hidden='true' />
                    ) : (
                      <RotateCw aria-hidden='true' />
                    )}
                  </ServiceActionButton>
                  <ServiceActionButton
                    type='button'
                    className='service-terminal-action'
                    aria-label={`Clean up ${service.name}`}
                    tooltip='Clean build artifacts'
                  >
                    <BrushCleaning aria-hidden='true' />
                  </ServiceActionButton>
                  <ServiceActionButton
                    type='button'
                    className='service-terminal-action service-terminal-action--config'
                    onClick={() => onOpenConfig(service.id)}
                    aria-label={`Configure ${service.name}`}
                    tooltip='Configure service'
                  >
                    <FileBraces aria-hidden='true' />
                  </ServiceActionButton>
                </div>

                <button
                  type='button'
                  className={`service-action service-action--process ${active ? 'is-active' : ''}`}
                  disabled={disabled}
                  onClick={() => onToggleService(service)}
                  aria-label={`${actionLabel} ${service.name}`}
                >
                  <span className='action-leading-icon' aria-hidden='true'>
                    {pending || service.status === 'starting' || service.status === 'stopping' ? (
                      <LoaderCircle className='spin' />
                    ) : stoppable ? (
                      <Circle className='stop-icon' />
                    ) : (
                      <Play className='play-icon' />
                    )}
                  </span>
                  <span>{actionLabel}</span>
                  {service.startedAt && active ? <Uptime startedAt={service.startedAt} /> : null}
                </button>
              </footer>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </article>
    </MotionConfig>
  )
}
