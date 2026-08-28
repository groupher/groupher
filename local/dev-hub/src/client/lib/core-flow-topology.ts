import type { TPublicService, TServiceRelation } from '@shared/contracts'

export type TFlowHandleSide = 'top' | 'right' | 'bottom' | 'left'
export type TCoreRelationRoute = 'auto' | 'safe-lane'

export type TRelationHandleSpec = {
  side: TFlowHandleSide
  style?: {
    left?: string
    right?: string
    top?: string
  }
}

export type TCoreRelationSpec = {
  source?: TRelationHandleSpec
  target?: TRelationHandleSpec
  route?: TCoreRelationRoute
  labelOffset?: {
    x?: number
    y?: number
  }
}

export const CORE_SERVICE_IDS = [
  'dev-gateway',
  'auth',
  'landing',
  'community',
  'dash',
  'assets-hub',
  'press',
  'content-import',
  'phoenix',
  'document-converter',
] as const

export const CORE_RELATION_SPECS = {
  'users-gateway': {
    source: { side: 'bottom', style: { left: '50%' } },
    target: { side: 'top', style: { left: '50%' } },
  },
  'gateway-auth': {
    source: { side: 'right', style: { top: '50%' } },
    target: { side: 'left', style: { top: '50%' } },
  },
  'gateway-dash': {
    source: { side: 'bottom', style: { left: '50%' } },
    target: { side: 'top', style: { left: '50%' } },
  },
  'gateway-press': {
    route: 'safe-lane',
  },
  'gateway-landing': {
    route: 'safe-lane',
  },
  'community-phoenix': {
    source: { side: 'bottom', style: { left: '50%' } },
    target: { side: 'top', style: { left: '50%' } },
  },
  'press-phoenix': {
    source: { side: 'right', style: { top: '50%' } },
    target: { side: 'left', style: { top: '28%' } },
    route: 'safe-lane',
  },
  'dash-phoenix': {
    source: { side: 'bottom', style: { left: '50%' } },
    target: { side: 'top', style: { left: '72%' } },
    route: 'safe-lane',
  },
  'dash-content-import': {
    source: { side: 'bottom', style: { left: '50%' } },
    target: { side: 'top', style: { left: '50%' } },
  },
  'dash-assets-hub': {
    source: { side: 'bottom', style: { left: '28%' } },
    target: { side: 'top', style: { left: '50%' } },
    route: 'safe-lane',
    labelOffset: { x: -112 },
  },
  'assets-hub-phoenix': {
    source: { side: 'right', style: { top: '42%' } },
    target: { side: 'left', style: { top: '42%' } },
  },
  'phoenix-assets-hub': {
    source: { side: 'left', style: { top: '58%' } },
    target: { side: 'right', style: { top: '58%' } },
  },
  'content-import-phoenix': {
    source: { side: 'left', style: { top: '50%' } },
    target: { side: 'right', style: { top: '50%' } },
  },
  'content-import-document-converter': {
    source: { side: 'right', style: { top: '50%' } },
    target: { side: 'left', style: { top: '50%' } },
  },
  'dash-document-converter': {
    source: { side: 'bottom', style: { left: '72%' } },
    target: { side: 'top', style: { left: '50%' } },
    route: 'safe-lane',
  },
} as const satisfies Record<string, TCoreRelationSpec>

export const CORE_REQUIRED_RELATION_IDS = [
  'gateway-auth',
  'gateway-landing',
  'gateway-dash',
  'gateway-press',
  'community-phoenix',
  'press-phoenix',
  'dash-phoenix',
  'dash-assets-hub',
  'assets-hub-phoenix',
  'phoenix-assets-hub',
  'dash-content-import',
  'content-import-phoenix',
  'content-import-document-converter',
  'dash-document-converter',
] as const

export const getCoreRelationSpec = (relationId: string): TCoreRelationSpec | undefined =>
  CORE_RELATION_SPECS[relationId as keyof typeof CORE_RELATION_SPECS]

export const shouldUseCoreServiceLayout = (
  services: Pick<TPublicService, 'id'>[],
  relations: Pick<TServiceRelation, 'id'>[],
): boolean => {
  const ids = new Set(services.map((service) => service.id))
  if (CORE_SERVICE_IDS.some((id) => !ids.has(id))) return false

  const relationIds = new Set(relations.map((relation) => relation.id))
  return CORE_REQUIRED_RELATION_IDS.every((id) => relationIds.has(id))
}
