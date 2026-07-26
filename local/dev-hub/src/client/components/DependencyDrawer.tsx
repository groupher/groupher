import { Dialog } from '@base-ui/react/dialog'
import type { TPublicService } from '@shared/contracts'
import { GitBranch, X } from 'lucide-react'
import { useMemo } from 'react'

import { DependencySection } from './DependencySection'

type TProps = {
  service: TPublicService
  services: TPublicService[]
  onClose: () => void
}

export function DependencyDrawer({ service, services, onClose }: TProps) {
  const serviceById = useMemo(() => new Map(services.map((item) => [item.id, item])), [services])
  const required = service.startPolicy.requiredDependencies.flatMap((id) => {
    const dependency = serviceById.get(id)
    return dependency ? [dependency] : []
  })
  const optional = service.startPolicy.optionalDependencies.flatMap((id) => {
    const dependency = serviceById.get(id)
    return dependency ? [dependency] : []
  })

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className='dependency-drawer-backdrop' />
        <Dialog.Viewport className='dependency-drawer-viewport'>
          <Dialog.Popup className='dependency-drawer-popup' data-service-id={service.id}>
            <header className='dependency-drawer-header'>
              <div className='dependency-drawer-title-group'>
                <GitBranch aria-hidden='true' />
                <div>
                  <span className='dependency-drawer-kicker'>Start dependencies</span>
                  <Dialog.Title>{service.name}</Dialog.Title>
                </div>
              </div>
              <Dialog.Close className='dependency-drawer-close' aria-label='Close dependency list'>
                <X aria-hidden='true' />
              </Dialog.Close>
            </header>

            <div className='dependency-drawer-content'>
              <DependencySection
                title='Required'
                empty='No required services.'
                services={required}
              />
              <DependencySection
                title='Optional'
                empty='No optional services.'
                services={optional}
              />
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
