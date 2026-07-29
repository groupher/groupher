import type { TPublicService } from '@shared/contracts'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { useState } from 'react'

import { openExternalUrl } from '@/lib/open-external-url'

import { ServiceActionButton } from './ServiceActionButton'

type TProps = {
  service: TPublicService
  openUrl?: string
}

type TCopyTarget = string

export function ServiceAddress({ service, openUrl }: TProps) {
  const [copied, setCopied] = useState<TCopyTarget | null>(null)

  if (!service.portlessName || !service.portlessUrl || !service.url) return null

  const copyAddress = (target: TCopyTarget, value: string) => {
    if (!navigator.clipboard) return

    void navigator.clipboard.writeText(value).then(() => {
      setCopied(target)
      window.setTimeout(() => setCopied((current) => (current === target ? null : current)), 1200)
    })
  }

  const addressRow = (label: string, value: string | null, target: TCopyTarget) =>
    value ? (
      <span className='service-address-detail-row'>
        <span className='service-address-label'>{label}</span>
        <span className='service-address-value'>{value}</span>
        <button
          type='button'
          className='service-address-copy'
          aria-label={`Copy ${service.name} ${label} address`}
          onClick={() => copyAddress(target, value)}
        >
          {copied === target ? <Check aria-hidden='true' /> : <Copy aria-hidden='true' />}
        </button>
      </span>
    ) : null

  return (
    <span className='service-address'>
      <ServiceActionButton
        type='button'
        className='service-address-name'
        aria-label={`Show ${service.name} address details`}
        tooltipAlign='end'
        tooltipClassName='service-address-tooltip'
        tooltip={
          <span className='service-address-details'>
            {addressRow('Portless app', service.portlessAppUrl, 'portless-app')}
            {addressRow('Listener app', service.appUrl, 'listener-app')}
            {addressRow('Portless health', service.portlessUrl, 'portless-health')}
            {addressRow('Listener health', service.url, 'listener-health')}
            {service.endpoints.map((endpoint) => (
              <span className='service-address-endpoint' key={endpoint.id}>
                <span className='service-address-endpoint-title'>{endpoint.label}</span>
                {addressRow('Portless app', endpoint.portlessAppUrl, `${endpoint.id}-portless-app`)}
                {addressRow('Listener app', endpoint.appUrl, `${endpoint.id}-listener-app`)}
                {addressRow(
                  'Portless health',
                  endpoint.portlessUrl,
                  `${endpoint.id}-portless-health`,
                )}
                {addressRow('Listener health', endpoint.url, `${endpoint.id}-listener-health`)}
              </span>
            ))}
          </span>
        }
      >
        <span>{service.portlessName}</span>
      </ServiceActionButton>
      {openUrl ? (
        <a
          className='service-address-open'
          href={openUrl}
          target='_blank'
          rel='noreferrer'
          aria-label={`Open ${service.name} local address`}
          onClick={(event) => {
            event.preventDefault()
            openExternalUrl(event.currentTarget.href)
          }}
        >
          <ExternalLink aria-hidden='true' />
        </a>
      ) : null}
    </span>
  )
}
