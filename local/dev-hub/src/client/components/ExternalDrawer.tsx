import { Dialog } from '@base-ui/react/dialog'
import type { TPublicService } from '@shared/contracts'
import { AlertTriangle, CircleStop, ExternalLink, ShieldCheck, X } from 'lucide-react'

type TProps = {
  service: TPublicService
  pending: boolean
  onClose: () => void
  onStop: (service: TPublicService) => void
}

export function ExternalDrawer({ service, pending, onClose, onStop }: TProps) {
  const process = service.externalProcess
  const canStop = Boolean(process?.canStop) && !pending && service.status === 'external'

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className='external-drawer-backdrop' />
        <Dialog.Viewport className='external-drawer-viewport'>
          <Dialog.Popup className='external-drawer-popup' data-service-id={service.id}>
            <header className='external-drawer-header'>
              <div className='external-drawer-title-group'>
                <ExternalLink aria-hidden='true' />
                <div>
                  <span className='external-drawer-kicker'>External process</span>
                  <Dialog.Title>{service.name}</Dialog.Title>
                </div>
              </div>
              <Dialog.Close
                className='external-drawer-close'
                aria-label='Close external process details'
              >
                <X aria-hidden='true' />
              </Dialog.Close>
            </header>

            <div className='external-drawer-content'>
              <div
                className={`external-drawer-notice ${process?.canStop ? 'is-safe' : 'is-warning'}`}
              >
                {process?.canStop ? (
                  <ShieldCheck aria-hidden='true' />
                ) : (
                  <AlertTriangle aria-hidden='true' />
                )}
                <div>
                  <strong>
                    {process?.canStop
                      ? 'Dev Hub identified this service process.'
                      : 'The port is occupied, but ownership is uncertain.'}
                  </strong>
                  <span>
                    {process?.canStop
                      ? 'You can stop the matching process group below.'
                      : 'Review the details and stop it from the process that started it.'}
                  </span>
                </div>
              </div>

              {process ? (
                <dl className='external-process-details'>
                  <Detail label='Ports' value={formatValues(process.ports)} />
                  <Detail label='Process IDs' value={formatValues(process.processIds)} />
                  <Detail label='Process groups' value={formatValues(process.processGroups)} />
                  <Detail
                    label='Working directories'
                    value={formatValues(process.workingDirectories)}
                  />
                  <Detail label='Commands' value={formatValues(process.commands)} multiline />
                </dl>
              ) : (
                <div className='external-drawer-state'>
                  The external process details are no longer available.
                </div>
              )}

              <div className='external-drawer-actions'>
                <button
                  type='button'
                  className='external-stop-button'
                  disabled={!canStop}
                  onClick={() => onStop(service)}
                >
                  <CircleStop aria-hidden='true' />
                  {pending ? 'Stopping…' : 'Close matching process'}
                </button>
                <span>
                  {process?.canStop
                    ? 'Only the identified process group will be stopped.'
                    : 'Dev Hub will not terminate an unrecognized process.'}
                </span>
              </div>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Detail({
  label,
  value,
  multiline = false,
}: {
  label: string
  value: string
  multiline?: boolean
}) {
  return (
    <div className='external-process-detail'>
      <dt>{label}</dt>
      <dd className={multiline ? 'is-multiline' : ''}>{value}</dd>
    </div>
  )
}

function formatValues(values: Array<number | string>): string {
  return values.length > 0 ? values.join(', ') : 'Unavailable'
}
