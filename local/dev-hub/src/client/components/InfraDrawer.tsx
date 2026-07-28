import { Dialog } from '@base-ui/react/dialog'
import { ExternalLink, Network, X } from 'lucide-react'
import { useState } from 'react'

import { INFRA_LINK_GROUPS, type TInfraLinkGroupId } from '@/lib/infra-links'
import { openInfraUrl } from '@/lib/open-infra-url'

import { InfraPlatformMark } from './InfraPlatformMark'

type TProps = {
  onClose: () => void
}

export function InfraDrawer({ onClose }: TProps) {
  const [activeGroupId, setActiveGroupId] = useState<TInfraLinkGroupId>('major')
  const activeGroup =
    INFRA_LINK_GROUPS.find((group) => group.id === activeGroupId) || INFRA_LINK_GROUPS[0]

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
              <div className='infra-drawer-tabs' role='tablist' aria-label='Infra link groups'>
                {INFRA_LINK_GROUPS.map((group) => (
                  <button
                    type='button'
                    role='tab'
                    key={group.id}
                    className={`infra-drawer-tab ${activeGroupId === group.id ? 'is-active' : ''}`}
                    aria-selected={activeGroupId === group.id}
                    onClick={() => setActiveGroupId(group.id)}
                  >
                    {group.label}
                  </button>
                ))}
              </div>

              {activeGroup.platforms.map((platform) => (
                <section className='infra-platform-section' key={platform.id}>
                  <header>
                    <InfraPlatformMark platform={platform} />
                    <h3>{platform.name}</h3>
                    <span>{platform.links.length}</span>
                  </header>
                  <ul className='infra-link-grid'>
                    {platform.links.map((link) => (
                      <li key={link.url}>
                        <a
                          className='infra-link-card'
                          href={link.url}
                          onClick={(event) => {
                            event.preventDefault()
                            openInfraUrl(link.url)
                          }}
                        >
                          <span className='infra-link-card-copy'>
                            <span className='infra-link-card-title'>{link.label}</span>
                            <span className='infra-link-card-url-wrap'>
                              <small className='infra-link-card-url'>{link.url}</small>
                              <span className='infra-link-card-tooltip' role='tooltip'>
                                {link.url}
                              </span>
                            </span>
                          </span>
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
