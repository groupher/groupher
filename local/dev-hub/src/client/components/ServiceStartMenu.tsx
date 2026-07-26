import { Menu } from '@base-ui/react/menu'
import type { TPublicService, TServiceStartMode } from '@shared/contracts'
import { ChevronDown, LoaderCircle, Play } from 'lucide-react'
import type { MouseEvent } from 'react'

type TProps = {
  service: TPublicService
  disabled: boolean
  variant: 'inline' | 'icon'
  pending?: boolean
  onStart: (service: TPublicService, mode: TServiceStartMode | 'default') => void
}

const MODE_LABEL: Record<TServiceStartMode, string> = {
  self: 'Start only this service',
  chain: 'Start chain',
  related: 'Start all related',
}

export function ServiceStartMenu({ service, disabled, variant, pending = false, onStart }: TProps) {
  const modes = getStartModes(service)
  if (modes.length <= 1) return null
  const inline = variant === 'inline'

  return (
    <Menu.Root modal={false}>
      <Menu.Trigger
        className={`service-start-menu-trigger service-start-menu-trigger--${variant}`}
        disabled={disabled}
        aria-label={`Choose how to start ${service.name}`}
        onMouseDownCapture={
          inline
            ? (event) => {
                if (!isChevronEvent(event)) {
                  event.preventDefault()
                  event.stopPropagation()
                }
              }
            : undefined
        }
        onClick={
          inline
            ? (event) => {
                if (!isChevronEvent(event)) onStart(service, 'default')
              }
            : undefined
        }
      >
        {inline ? (
          <>
            {pending ? (
              <LoaderCircle className='spin' aria-hidden='true' />
            ) : (
              <Play className='play-icon' aria-hidden='true' />
            )}
            <span className='service-start-menu-label'>Start</span>
            <span className='service-start-menu-chevron' aria-hidden='true'>
              <ChevronDown />
            </span>
          </>
        ) : (
          <ChevronDown aria-hidden='true' />
        )}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side='bottom' align='end' sideOffset={8}>
          <Menu.Popup className='service-start-menu'>
            {modes.map((mode) => (
              <Menu.Item
                key={mode}
                className='service-start-menu-item'
                onClick={() => onStart(service, mode)}
              >
                <span>
                  {MODE_LABEL[mode]}
                  {mode === service.startPolicy.defaultMode ? ' (default)' : ''}
                </span>
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

function isChevronEvent(event: MouseEvent<HTMLElement>): boolean {
  return Boolean((event.target as HTMLElement).closest('.service-start-menu-chevron'))
}

function getStartModes(service: TPublicService): TServiceStartMode[] {
  const hasRequired = service.startPolicy.requiredDependencies.length > 0
  const hasOptional = service.startPolicy.optionalDependencies.length > 0
  if (!hasRequired && !hasOptional) return ['self']

  const modes: TServiceStartMode[] = ['self']
  if (hasRequired) modes.push('chain')
  if (hasRequired || hasOptional) modes.push('related')

  return modes.sort((left, right) =>
    left === service.startPolicy.defaultMode
      ? -1
      : right === service.startPolicy.defaultMode
        ? 1
        : 0,
  )
}
