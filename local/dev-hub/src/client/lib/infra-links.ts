import { siAlgolia, siCloudflare, siFlydotio, siVercel } from 'simple-icons'

export type TInfraPlatformId = 'vercel' | 'cloudflare' | 'fly' | 'algolia'
export type TInfraLinkGroupId = 'major' | 'third-party'
type TDeploymentPlatformId = Exclude<TInfraPlatformId, 'algolia'>

export type TInfraIcon = {
  path: string
  color: string
  viewBox: string
}

export type TInfraLink = {
  label: string
  url: string
}

export type TInfraPlatform = {
  id: TInfraPlatformId
  name: string
  icon: TInfraIcon
  links: TInfraLink[]
}

export type TInfraLinkGroup = {
  id: TInfraLinkGroupId
  label: string
  platforms: TInfraPlatform[]
}

export type TServiceDeploymentTarget = {
  serviceId: string
  platformId: TDeploymentPlatformId
  platformName: string
  icon: TInfraIcon
  url: string
}

const SIMPLE_ICON_VIEWBOX = '0 0 24 24'

const fromSimpleIcon = (icon: { path: string; hex: string }) => ({
  path: icon.path,
  color: `#${icon.hex}`,
  viewBox: SIMPLE_ICON_VIEWBOX,
})

const INFRA_PLATFORM_META: Record<TInfraPlatformId, { name: string; icon: TInfraIcon }> = {
  vercel: {
    name: 'Vercel',
    icon: fromSimpleIcon(siVercel),
  },
  cloudflare: {
    name: 'Cloudflare',
    icon: fromSimpleIcon(siCloudflare),
  },
  fly: {
    name: 'Fly',
    icon: fromSimpleIcon(siFlydotio),
  },
  algolia: {
    name: 'Algolia',
    icon: fromSimpleIcon(siAlgolia),
  },
}

const deploymentTarget = (
  serviceId: string,
  platformId: TDeploymentPlatformId,
  url: string,
): TServiceDeploymentTarget => ({
  serviceId,
  platformId,
  platformName: INFRA_PLATFORM_META[platformId].name,
  icon: INFRA_PLATFORM_META[platformId].icon,
  url,
})

export const INFRA_LINK_GROUPS: TInfraLinkGroup[] = [
  {
    id: 'major',
    label: 'Major',
    platforms: [
      {
        id: 'vercel',
        name: INFRA_PLATFORM_META.vercel.name,
        icon: INFRA_PLATFORM_META.vercel.icon,
        links: [
          {
            label: 'Domain',
            url: 'https://vercel.com/groupher/~/domains/groupher.com',
          },
          { label: 'Storage', url: 'https://vercel.com/groupher/~/stores' },
          { label: 'Builds', url: 'https://vercel.com/groupher/~/deployments' },
        ],
      },
      {
        id: 'cloudflare',
        name: INFRA_PLATFORM_META.cloudflare.name,
        icon: INFRA_PLATFORM_META.cloudflare.icon,
        links: [
          {
            label: 'dns',
            url: 'https://dash.cloudflare.com/4e2e8db91d21e325d9b540ca7abf4d99/groupher.com/dns/records',
          },
          {
            label: 'Access controls',
            url: 'https://dash.cloudflare.com/4e2e8db91d21e325d9b540ca7abf4d99/one/access-controls/overview',
          },
          {
            label: 'Workers',
            url: 'https://dash.cloudflare.com/4e2e8db91d21e325d9b540ca7abf4d99/workers-and-pages',
          },
          {
            label: 'Queue',
            url: 'https://dash.cloudflare.com/4e2e8db91d21e325d9b540ca7abf4d99/workers/queues',
          },
          {
            label: 'Policies',
            url: 'https://dash.cloudflare.com/4e2e8db91d21e325d9b540ca7abf4d99/one/access-controls/policies',
          },
        ],
      },
      {
        id: 'fly',
        name: INFRA_PLATFORM_META.fly.name,
        icon: INFRA_PLATFORM_META.fly.icon,
        links: [
          { label: 'API', url: 'https://fly.io/apps/groupher-api' },
          { label: 'Press', url: 'https://fly.io/apps/groupher-press' },
          { label: 'Status app', url: 'https://fly.io/apps/groupher-status' },
          { label: 'Status (production)', url: 'https://status.groupher.com' },
          { label: 'Status (local)', url: 'http://127.0.0.1:8080/' },
        ],
      },
    ],
  },
  {
    id: 'third-party',
    label: '3-rd party',
    platforms: [
      {
        id: 'algolia',
        name: INFRA_PLATFORM_META.algolia.name,
        icon: INFRA_PLATFORM_META.algolia.icon,
        links: [
          {
            label: 'Dashboard',
            url: 'https://dashboard.algolia.com/apps/995NSSWA19/dashboard',
          },
        ],
      },
    ],
  },
]

export const INFRA_PLATFORMS: TInfraPlatform[] = INFRA_LINK_GROUPS[0].platforms

export const SERVICE_DEPLOYMENT_TARGETS: Partial<Record<string, TServiceDeploymentTarget>> = {
  gateway: deploymentTarget('gateway', 'vercel', 'https://vercel.com/groupher/gateway'),
  auth: deploymentTarget(
    'auth',
    'cloudflare',
    'https://dash.cloudflare.com/4e2e8db91d21e325d9b540ca7abf4d99/workers-and-pages',
  ),
  landing: deploymentTarget(
    'landing',
    'cloudflare',
    'https://dash.cloudflare.com/4e2e8db91d21e325d9b540ca7abf4d99/workers-and-pages',
  ),
  main: deploymentTarget('main', 'vercel', 'https://vercel.com/groupher/main'),
  dashboard: deploymentTarget('dashboard', 'vercel', 'https://vercel.com/groupher/dashboard'),
  apply: deploymentTarget(
    'apply',
    'cloudflare',
    'https://dash.cloudflare.com/4e2e8db91d21e325d9b540ca7abf4d99/workers-and-pages',
  ),
  'inspire-me': deploymentTarget(
    'inspire-me',
    'cloudflare',
    'https://dash.cloudflare.com/groupher/workers',
  ),
  phoenix: deploymentTarget('phoenix', 'fly', 'https://fly.io/apps/groupher-api'),
  press: deploymentTarget('press', 'fly', 'https://fly.io/apps/groupher-press'),
  'content-import': deploymentTarget(
    'content-import',
    'vercel',
    'https://vercel.com/groupher/content-import',
  ),
  'assets-hub': deploymentTarget(
    'assets-hub',
    'cloudflare',
    'https://dash.cloudflare.com/4e2e8db91d21e325d9b540ca7abf4d99/workers-and-pages',
  ),
  'document-converter': deploymentTarget(
    'document-converter',
    'vercel',
    'https://vercel.com/groupher/document-converter',
  ),
  gatus: deploymentTarget('gatus', 'fly', 'https://fly.io/apps/groupher-status'),
}
