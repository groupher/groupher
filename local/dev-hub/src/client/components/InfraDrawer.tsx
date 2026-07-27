import { Dialog } from '@base-ui/react/dialog'
import { ExternalLink, Network, X } from 'lucide-react'

import { INFRA_PLATFORMS } from '@/lib/infra-links'
import { openInfraUrl } from '@/lib/open-infra-url'

import { InfraPlatformMark } from './InfraPlatformMark'

type TProps = {
  onClose: () => void
}

export function InfraDrawer({ onClose }: TProps) {
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className='infra-drawer-backdrop' />
        <Dialog.Viewport className='infra-drawer-viewport'>
          <Dialog.Popup className='infra-drawer-popup'>
            <header className='infra-drawer-header'>
              <div className='infra-drawer-title-group'>
                <Network aria-hidden='true' />
                <div>
                  <span className='infra-drawer-kicker'>External platforms</span>
                  <Dialog.Title>Infra</Dialog.Title>
                </div>
              </div>
              <Dialog.Close className='infra-drawer-close' aria-label='Close infra links'>
                <X aria-hidden='true' />
              </Dialog.Close>
            </header>

            <div className='infra-drawer-content'>
              {INFRA_PLATFORMS.map((platform) => (
                <section className='infra-platform-section' key={platform.id}>
                  <header>
                    <InfraPlatformMark platform={platform} />
                    <h3>{platform.name}</h3>
                    <span>{platform.links.length}</span>
                  </header>
                  <ul className='infra-link-list'>
                    {platform.links.map((link) => (
                      <li key={link.url}>
                        <a
                          href={link.url}
                          onClick={(event) => {
                            event.preventDefault()
                            openInfraUrl(link.url)
                          }}
                        >
                          <span>{link.label}</span>
                          <small>{link.url}</small>
                          <ExternalLink aria-hidden='true' />
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
