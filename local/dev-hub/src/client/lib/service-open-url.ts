import type { TPublicService, TServiceMetricsSnapshot } from '@shared/contracts'

export function getServiceOpenUrl(
  service: TPublicService,
  metrics?: TServiceMetricsSnapshot,
): string | undefined {
  const browserUrl = metrics?.browser?.url
  if (browserUrl) return browserUrl

  return service.portlessAppUrl || service.appUrl || service.portlessUrl || service.url || undefined
}
