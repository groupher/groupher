import type { TPublicService } from '@shared/contracts'

const STARTED_DEPENDENCY_STATUSES = new Set<TPublicService['status']>(['running', 'external'])

export type TServiceDependencyState = {
  hasRequiredDependencyIssue: boolean
  hasStartedRequiredDependencies: boolean
  hasOptionalDependencyIssue: boolean
}

export type TServiceViewModel = {
  dependencyStateByServiceId: Map<string, TServiceDependencyState>
  serviceById: Map<string, TPublicService>
}

const dependencyMissing = (
  dependencyId: string,
  serviceById: Map<string, TPublicService>,
): boolean => {
  const dependency = serviceById.get(dependencyId)
  return !dependency || !STARTED_DEPENDENCY_STATUSES.has(dependency.status)
}

export const buildServiceDependencyState = (
  service: TPublicService,
  serviceById: Map<string, TPublicService>,
): TServiceDependencyState => {
  const requiredDependencies = service.startPolicy.requiredDependencies
  const hasRequiredDependencyIssue = requiredDependencies.some((dependencyId) =>
    dependencyMissing(dependencyId, serviceById),
  )
  const hasOptionalDependencyIssue =
    !hasRequiredDependencyIssue &&
    service.startPolicy.optionalDependencies.some((dependencyId) =>
      dependencyMissing(dependencyId, serviceById),
    )

  return {
    hasRequiredDependencyIssue,
    hasStartedRequiredDependencies: requiredDependencies.length > 0 && !hasRequiredDependencyIssue,
    hasOptionalDependencyIssue,
  }
}

export const buildServiceViewModel = (services: readonly TPublicService[]): TServiceViewModel => {
  const serviceById = new Map(services.map((service) => [service.id, service]))
  const dependencyStateByServiceId = new Map(
    services.map((service) => [service.id, buildServiceDependencyState(service, serviceById)]),
  )

  return { dependencyStateByServiceId, serviceById }
}
