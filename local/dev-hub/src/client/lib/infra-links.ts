import { siCloudflare, siFlydotio, siVercel } from 'simple-icons'

export type TInfraLink = {
  label: string
  url: string
}

export type TInfraPlatform = {
  id: 'vercel' | 'cloudflare' | 'fly'
  name: string
  icon: {
    path: string
    color: string
    viewBox: string
  }
  links: TInfraLink[]
}

const SIMPLE_ICON_VIEWBOX = '0 0 24 24'

const fromSimpleIcon = (icon: { path: string; hex: string }) => ({
  path: icon.path,
  color: `#${icon.hex}`,
  viewBox: SIMPLE_ICON_VIEWBOX,
})

export const INFRA_PLATFORMS: TInfraPlatform[] = [
  {
    id: 'vercel',
    name: 'Vercel',
    icon: fromSimpleIcon(siVercel),
    links: [
      { label: 'landing', url: 'https://vercel.com/groupher/landing' },
      { label: 'main', url: 'https://vercel.com/groupher/main' },
      { label: 'dsb', url: 'https://vercel.com/groupher/dashboard' },
    ],
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    icon: fromSimpleIcon(siCloudflare),
    links: [
      { label: 'R2', url: 'https://dash.cloudflare.com/groupher/r2' },
      { label: 'Workers', url: 'https://dash.cloudflare.com/groupher/workers' },
    ],
  },
  {
    id: 'fly',
    name: 'Fly',
    icon: fromSimpleIcon(siFlydotio),
    links: [{ label: 'phx', url: 'https://fly.io/apps/groupher-phx' }],
  },
]
