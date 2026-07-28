import type { TPublicService, TServiceMetricsSnapshot, TServiceStartMode } from '@shared/contracts'
import {
  BrushCleaning,
  FileBraces,
  GitBranch,
  LoaderCircle,
  Play,
  RotateCw,
  SquareTerminal,
} from 'lucide-react'
import { AnimatePresence, motion, MotionConfig } from 'motion/react'

import { SERVICE_DEPLOYMENT_TARGETS } from '@/lib/infra-links'
import { openExternalUrl } from '@/lib/open-external-url'

import { ServiceActionButton } from './ServiceActionButton'
import { ServiceAddress } from './ServiceAddress'
import { ServiceMetricsStrip } from './ServiceMetricsStrip'
import { ServiceStackMark } from './ServiceStackMark'
import { ServiceStartMenu } from './ServiceStartMenu'
import { TerminalSurface } from './TerminalSurface'
import { Uptime } from './Uptime'

type TProps = {
  service: TPublicService
  metrics?: TServiceMetricsSnapshot
  expanded: boolean
  compact?: boolean
  pending: boolean
  hasRequiredDependencyIssue: boolean
  hasStartedRequiredDependencies: boolean
  hasOptionalDependencyIssue: boolean
  onToggleService: (service: TPublicService) => void
  onStartService: (service: TPublicService, mode: TServiceStartMode | 'default') => void
  onRestartService: (service: TPublicService) => void
  onToggleTerminal: (id: string) => void
  onOpenMetrics: (id: string) => void
  onOpenConfig: (id: string) => void
  onOpenDependencies: (id: string) => void
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

const CARD_SPRING = {
  type: 'spring',
  duration: 0.3,
  bounce: 0,
} as const

export function ServiceCard({
  service,
  metrics,
  expanded,
  compact: compactOverride = false,
  pending,
  hasRequiredDependencyIssue,
  hasStartedRequiredDependencies,
  hasOptionalDependencyIssue,
  onToggleService,
  onStartService,
  onRestartService,
  onToggleTerminal,
  onOpenMetrics,
  onOpenConfig,
  onOpenDependencies,
}: TProps) {
  const displayStatus =
    pending && (service.status === 'stopped' || service.status === 'unavailable')
      ? 'starting'
      : service.status
  const active = pending || ['starting', 'running', 'stopping'].includes(service.status)
  const stoppable = ['starting', 'running'].includes(service.status)
  const disabled =
    pending || service.status === 'stopping' || !service.canStart || service.status === 'external'
  const restartDisabled =
    pending || service.status === 'stopping' || !service.canStart || service.status === 'external'
  const emptyText =
    pending && (service.status === 'stopped' || service.status === 'unavailable')
      ? `${service.name} is starting.`
      : service.unavailableReason || `${service.name} is ${service.status}.`
  const compact =
    compactOverride ||
    (!pending && (service.status === 'stopped' || service.status === 'unavailable'))
  const dependenciesCount =
    service.startPolicy.requiredDependencies.length +
    service.startPolicy.optionalDependencies.length
  const hasDependencies = dependenciesCount > 0
  const actionLabel =
    service.status === 'stopping'
      ? 'Stopping'
      : stoppable
        ? 'Stop'
        : service.status === 'external'
          ? 'External'
          : 'Start'
  const browserUrl = metrics?.browser?.url
  const openUrl =
    browserUrl ||
    service.portlessAppUrl ||
    service.appUrl ||
    service.portlessUrl ||
    service.url ||
    undefined
  const showAddress = service.status === 'running' || Boolean(browserUrl)
  const deploymentTarget = SERVICE_DEPLOYMENT_TARGETS[service.id]

  return (
    <MotionConfig reducedMotion='user'>
      <article className='service-card' data-service-id={service.id}>
        <div className={`service-visual ${compact ? 'is-compact' : ''}`}>
          <header className='service-meta'>
            <ServiceStackMark
              name={service.name}
              monogram={service.monogram}
              technologies={service.technologies}
            />
            <span className='service-copy'>
              <span className='service-title-row'>
                <span className='service-name'>{service.name}</span>
                {deploymentTarget ? (
                  <a
                    className={`service-deployment-link service-deployment-link--${deploymentTarget.platformId}`}
                    href={deploymentTarget.url}
                    target='_blank'
                    rel='noreferrer'
                    aria-label={`Open ${service.name} deployment on ${deploymentTarget.platformName}`}
                    title={deploymentTarget.platformName}
                    onClick={(event) => {
                      event.preventDefault()
                      openExternalUrl(event.currentTarget.href)
                    }}
                  >
                    <svg
                      className={`service-deployment-mark service-deployment-mark--${deploymentTarget.platformId}`}
                      viewBox={deploymentTarget.icon.viewBox}
                      aria-hidden='true'
                    >
                      <path d={deploymentTarget.icon.path} fill={deploymentTarget.icon.color} />
                    </svg>
                  </a>
                ) : null}
              </span>
              <span className='service-description'>{service.description}</span>
            </span>
            <div
              className={`service-status-group ${showAddress ? 'has-address' : ''} ${
                compact ? 'is-compact' : ''
              }`}
            >
              {!compact || !service.canStart ? (
                <span
                  className={`service-status-label service-status-label--${displayStatus}`}
                  aria-label={`${service.name} is ${STATUS_LABEL[displayStatus]}`}
                >
                  <span className={`status-dot status-dot--${displayStatus}`} aria-hidden='true'>
                    {displayStatus === 'running' ? (
                      <>
                        <span className='status-dot-ping' />
                        <span className='status-dot-core' />
                      </>
                    ) : null}
                  </span>
                  {STATUS_LABEL[displayStatus]}
                </span>
              ) : null}
              {compact && service.canStart ? (
                <span className='service-inline-start-wrap'>
                  {hasDependencies ? (
                    <ServiceStartMenu
                      service={service}
                      disabled={disabled}
                      variant='inline'
                      pending={pending}
                      onStart={onStartService}
                    />
                  ) : (
                    <button
                      type='button'
                      className='service-inline-start'
                      disabled={disabled}
                      onClick={() => onStartService(service, 'default')}
                      aria-label={`${pending ? 'Starting' : 'Start'} ${service.name}`}
                    >
                      {pending ? (
                        <LoaderCircle className='spin' aria-hidden='true' />
                      ) : (
                        <Play className='play-icon' aria-hidden='true' />
                      )}
                      <span>Start</span>
                    </button>
                  )}
                </span>
              ) : null}
              {showAddress ? <ServiceAddress service={service} openUrl={openUrl} /> : null}
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
                  {hasDependencies ? (
                    <ServiceActionButton
                      type='button'
                      className={`service-terminal-action ${
                        hasRequiredDependencyIssue ? 'has-required-dependency-issue' : ''
                      } ${
                        hasStartedRequiredDependencies ? 'has-started-required-dependencies' : ''
                      } ${hasOptionalDependencyIssue ? 'has-optional-dependency-issue' : ''}`}
                      onClick={() => onOpenDependencies(service.id)}
                      aria-label={`View ${service.name} dependencies`}
                      tooltip='Dependencies'
                    >
                      <GitBranch aria-hidden='true' />
                    </ServiceActionButton>
                  ) : null}
                </div>

                <div
                  className={`service-action service-action--process ${active ? 'is-active' : ''}`}
                >
                  <ServiceActionButton
                    type='button'
                    className='service-process-action service-process-action--danger'
                    disabled={disabled}
                    onClick={() =>
                      stoppable ? onToggleService(service) : onStartService(service, 'default')
                    }
                    aria-label={`${actionLabel} ${service.name}`}
                    tooltip={actionLabel}
                  >
                    {pending || service.status === 'starting' || service.status === 'stopping' ? (
                      <LoaderCircle className='spin' aria-hidden='true' />
                    ) : stoppable ? (
                      <span className='service-stop-mark' aria-hidden='true'>
                        <span />
                      </span>
                    ) : (
                      <Play className='play-icon' aria-hidden='true' />
                    )}
                  </ServiceActionButton>
                  {!stoppable && hasDependencies ? (
                    <ServiceStartMenu
                      service={service}
                      disabled={disabled}
                      variant='icon'
                      onStart={onStartService}
                    />
                  ) : null}
                  <ServiceActionButton
                    type='button'
                    className='service-process-action service-process-action--danger'
                    disabled={restartDisabled}
                    onClick={restartDisabled ? undefined : () => onRestartService(service)}
                    aria-label={`Restart ${service.name}`}
                    tooltip='Restart service'
                  >
                    {pending ? (
                      <LoaderCircle className='spin' aria-hidden='true' />
                    ) : (
                      <RotateCw aria-hidden='true' />
                    )}
                  </ServiceActionButton>
                  {service.startedAt && active ? <Uptime startedAt={service.startedAt} /> : null}
                </div>
              </footer>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </article>
    </MotionConfig>
  )
}
