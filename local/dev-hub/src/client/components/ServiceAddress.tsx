import type { TPublicService } from '@shared/contracts'
import { Check, CircleHelp, Copy } from 'lucide-react'
import { useState } from 'react'

import { ServiceActionButton } from './ServiceActionButton'

type TProps = {
  service: TPublicService
}

type TCopyTarget = 'portless-app' | 'listener-app' | 'portless-health' | 'listener-health'

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
            {service.portlessAppUrl ? (
              <span className='service-address-detail-row'>
                <span className='service-address-label'>Portless app</span>
                <span className='service-address-value'>{service.portlessAppUrl}</span>
                <button
                  type='button'
                  className='service-address-copy'
                  aria-label={`Copy ${service.name} Portless app address`}
                  onClick={() => copyAddress('portless-app', service.portlessAppUrl || '')}
                >
                  {copied === 'portless-app' ? (
                    <Check aria-hidden='true' />
                  ) : (
                    <Copy aria-hidden='true' />
                  )}
                </button>
              </span>
            ) : null}
            {service.appUrl ? (
              <span className='service-address-detail-row'>
                <span className='service-address-label'>Listener app</span>
                <span className='service-address-value'>{service.appUrl}</span>
                <button
                  type='button'
                  className='service-address-copy'
                  aria-label={`Copy ${service.name} listener app address`}
                  onClick={() => copyAddress('listener-app', service.appUrl || '')}
                >
                  {copied === 'listener-app' ? (
                    <Check aria-hidden='true' />
                  ) : (
                    <Copy aria-hidden='true' />
                  )}
                </button>
              </span>
            ) : null}
            <span className='service-address-detail-row'>
              <span className='service-address-label'>Portless health</span>
              <span className='service-address-value'>{service.portlessUrl}</span>
              <button
                type='button'
                className='service-address-copy'
                aria-label={`Copy ${service.name} Portless health address`}
                onClick={() => copyAddress('portless-health', service.portlessUrl || '')}
              >
                {copied === 'portless-health' ? (
                  <Check aria-hidden='true' />
                ) : (
                  <Copy aria-hidden='true' />
                )}
              </button>
            </span>
            <span className='service-address-detail-row'>
              <span className='service-address-label'>Listener health</span>
              <span className='service-address-value'>{service.url}</span>
              <button
                type='button'
                className='service-address-copy'
                aria-label={`Copy ${service.name} listener health address`}
                onClick={() => copyAddress('listener-health', service.url || '')}
              >
                {copied === 'listener-health' ? (
                  <Check aria-hidden='true' />
                ) : (
                  <Copy aria-hidden='true' />
                )}
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
