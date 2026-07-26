import type { TPublicService } from '@shared/contracts'
import { Check, CircleHelp, Copy } from 'lucide-react'
import { useState } from 'react'

import { ServiceActionButton } from './ServiceActionButton'

type TProps = {
  service: TPublicService
}

type TCopyTarget = 'portless' | 'listener'

export function ServiceAddress({ service }: TProps) {
  const [copied, setCopied] = useState<TCopyTarget | null>(null)

  if (!service.portlessName || !service.portlessUrl || !service.url) return null

  const copyAddress = (target: TCopyTarget, value: string) => {
    if (!navigator.clipboard) return

    void navigator.clipboard.writeText(value).then(() => {
      setCopied(target)
      window.setTimeout(() => setCopied((current) => (current === target ? null : current)), 1200)
    })
  }

  return (
    <span className='service-address'>
      <span className='service-address-name'>{service.portlessName}</span>
      <ServiceActionButton
        type='button'
        className='service-address-help'
        aria-label={`Show ${service.name} address details`}
        tooltipClassName='service-address-tooltip'
        tooltip={
          <span className='service-address-details'>
            <span className='service-address-detail-row'>
              <span className='service-address-label'>Portless</span>
              <span className='service-address-value'>{service.portlessUrl}</span>
              <button
                type='button'
                className='service-address-copy'
                aria-label={`Copy ${service.name} Portless address`}
                onClick={() => copyAddress('portless', service.portlessUrl || '')}
              >
                {copied === 'portless' ? <Check aria-hidden='true' /> : <Copy aria-hidden='true' />}
              </button>
            </span>
            <span className='service-address-detail-row'>
              <span className='service-address-label'>Listener</span>
              <span className='service-address-value'>{service.url}</span>
              <button
                type='button'
                className='service-address-copy'
                aria-label={`Copy ${service.name} listener address`}
                onClick={() => copyAddress('listener', service.url || '')}
              >
                {copied === 'listener' ? <Check aria-hidden='true' /> : <Copy aria-hidden='true' />}
              </button>
            </span>
          </span>
        }
      >
        <CircleHelp aria-hidden='true' />
      </ServiceActionButton>
    </span>
  )
}
