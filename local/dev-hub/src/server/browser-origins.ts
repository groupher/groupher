type TBrowserService = {
  group: string
  id: string
  port?: number
  portlessUrl?: string
}

export const buildBrowserOriginsByService = (
  services: readonly TBrowserService[],
): Map<string, Set<string>> => {
  return new Map(
    services
      .filter((service) => service.group === 'frontend')
      .map((service) => {
        const origins = new Set<string>()

        if (service.port) {
          origins.add(`http://localhost:${service.port}`)
          origins.add(`http://127.0.0.1:${service.port}`)
        }

        if (service.portlessUrl) {
          origins.add(new URL(service.portlessUrl).origin)
        }

        return [service.id, origins] as const
      })
      .filter(([, origins]) => origins.size > 0),
  )
}

export const collectBrowserOrigins = (
  originsByService: ReadonlyMap<string, ReadonlySet<string>>,
): Set<string> => {
  return new Set(Array.from(originsByService.values()).flatMap((origins) => Array.from(origins)))
}

export const isBrowserMetricOriginAllowed = ({
  originsByService,
  reportUrl,
  requestOrigin,
  serviceId,
}: {
  originsByService: ReadonlyMap<string, ReadonlySet<string>>
  reportUrl: string
  requestOrigin: string
  serviceId: string
}): boolean => {
  try {
    return (
      originsByService.get(serviceId)?.has(requestOrigin) === true &&
      new URL(reportUrl).origin === requestOrigin
    )
  } catch {
    return false
  }
}
