import type { TPublicService, TServiceRelation } from '@shared/contracts'
import type { ElkNode } from 'elkjs/lib/elk-api'
import ELK from 'elkjs/lib/elk-api.js'
import ElkWorker from 'elkjs/lib/elk-worker.min.js?worker'

import type { TFlowLayout } from '@/components/flow-spec'
import { shouldUseCoreServiceLayout } from '@/lib/core-flow-topology'
import {
  FLOW_COMPACT_NODE_HEIGHT,
  FLOW_EXPANDED_NODE_HEIGHT,
  FLOW_NODE_WIDTH,
  FLOW_STANDALONE_GAP,
  FLOW_STANDALONE_OFFSET,
  FLOW_STANDALONE_TOP,
} from '@/lib/flow-metrics'

const elk = new ELK({
  workerFactory: () => new ElkWorker(),
})
const USER_NODE_TOP = 0
const CORE_TOP_ROW_Y = 118
const CORE_TOP_TO_APP_GAP = 136
const CORE_APP_TO_BACKEND_GAP = 96
const CORE_COLUMN_X = {
  left: 24,
  center: 564,
  right: 1104,
  farRight: 1644,
} as const
const CORE_DETACHED_SERVICE_IDS = new Set(['inspire-me'])

const getNodeHeight = (service: Pick<TPublicService, 'status'>): number =>
  service.status === 'stopped' || service.status === 'unavailable'
    ? FLOW_COMPACT_NODE_HEIGHT
    : FLOW_EXPANDED_NODE_HEIGHT

const getCoreServicePositions = (
  services: Pick<TPublicService, 'id' | 'status'>[],
): Partial<Record<string, { x: number; y: number }>> => {
  const heightById = new Map(services.map((service) => [service.id, getNodeHeight(service)]))
  const topRowHeight = Math.max(heightById.get('gateway') || 0, heightById.get('auth') || 0)
  const appRowHeight = Math.max(
    heightById.get('landing') || 0,
    heightById.get('main') || 0,
    heightById.get('dashboard') || 0,
  )
  const appRowY = CORE_TOP_ROW_Y + topRowHeight + CORE_TOP_TO_APP_GAP
  const backendRowY = appRowY + appRowHeight + CORE_APP_TO_BACKEND_GAP

  return {
    users: { x: CORE_COLUMN_X.center, y: USER_NODE_TOP },
    gateway: { x: CORE_COLUMN_X.center, y: CORE_TOP_ROW_Y },
    auth: { x: CORE_COLUMN_X.right, y: CORE_TOP_ROW_Y },
    landing: { x: CORE_COLUMN_X.left, y: appRowY },
    main: { x: CORE_COLUMN_X.center, y: appRowY },
    dashboard: { x: CORE_COLUMN_X.right, y: appRowY },
    'assets-hub': { x: CORE_COLUMN_X.left, y: backendRowY },
    phoenix: { x: CORE_COLUMN_X.center, y: backendRowY },
    'content-import': { x: CORE_COLUMN_X.right, y: backendRowY },
    'document-converter': { x: CORE_COLUMN_X.farRight, y: backendRowY },
  }
}

export async function layoutServiceFlow(
  services: Pick<TPublicService, 'id' | 'status'>[],
  relations: TServiceRelation[],
): Promise<TFlowLayout> {
  const serviceIds = new Set(services.map((service) => service.id))
  const graphRelations = relations.filter(
    (relation) => serviceIds.has(relation.source) && serviceIds.has(relation.target),
  )
  const connectedIds = new Set(
    graphRelations.flatMap((relation) => [relation.source, relation.target]),
  )
  const connectedServices = services.filter((service) => connectedIds.has(service.id))
  const standaloneServices = services.filter(
    (service) => !connectedIds.has(service.id) && !CORE_DETACHED_SERVICE_IDS.has(service.id),
  )

  const graphDefinition: ElkNode = {
    id: 'service-flow',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.padding': '[top=48,left=48,bottom=48,right=48]',
      'elk.spacing.nodeNode': '54',
      'elk.layered.spacing.nodeNodeBetweenLayers': '112',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    },
    children: connectedServices.map((service) => ({
      id: service.id,
      width: FLOW_NODE_WIDTH,
      height: getNodeHeight(service),
    })),
    edges: graphRelations.map((relation) => ({
      id: relation.id,
      sources: [relation.source],
      targets: [relation.target],
    })),
  }
  const graph = await elk.layout(graphDefinition)

  const positions: TFlowLayout['positions'] = {}
  for (const child of graph.children || []) {
    positions[child.id] = { x: child.x || 0, y: child.y || 0 }
  }

  const mainPosition = positions.main
  const dashboardPosition = positions.dashboard
  if (mainPosition && dashboardPosition && mainPosition.x > dashboardPosition.x) {
    positions.main = { ...mainPosition, x: dashboardPosition.x }
    positions.dashboard = { ...dashboardPosition, x: mainPosition.x }
  }

  const targetIds = new Set(graphRelations.map((relation) => relation.target))
  const targetIdsBySource = new Map<string, Set<string>>()
  for (const relation of graphRelations) {
    const targets = targetIdsBySource.get(relation.source) || new Set<string>()
    targets.add(relation.target)
    targetIdsBySource.set(relation.source, targets)
  }

  for (const [sourceId, directTargetIds] of targetIdsBySource) {
    if (targetIds.has(sourceId) || directTargetIds.size < 2 || !positions[sourceId]) continue

    const targetPositions = [...directTargetIds]
      .map((targetId) => positions[targetId])
      .filter((position) => position !== undefined)
    if (targetPositions.length !== directTargetIds.size) continue

    const left = Math.min(...targetPositions.map((position) => position.x))
    const right = Math.max(...targetPositions.map((position) => position.x + FLOW_NODE_WIDTH))
    positions[sourceId] = {
      ...positions[sourceId],
      x: left + (right - left - FLOW_NODE_WIDTH) / 2,
    }
  }

  if (shouldUseCoreServiceLayout(connectedServices, graphRelations)) {
    const corePositions = getCoreServicePositions(connectedServices)
    for (const service of connectedServices) {
      const position = corePositions[service.id]
      if (position) positions[service.id] = position
    }

    if (serviceIds.has('inspire-me')) {
      positions['inspire-me'] = { x: CORE_COLUMN_X.farRight, y: CORE_TOP_ROW_Y }
    }
  }

  if (standaloneServices.length === 0) {
    return { positions, laneNotePosition: null }
  }

  const graphWidth = graph.width || FLOW_NODE_WIDTH
  let standaloneY = FLOW_STANDALONE_TOP
  for (const service of standaloneServices) {
    positions[service.id] = { x: graphWidth + FLOW_STANDALONE_OFFSET, y: standaloneY }
    standaloneY += getNodeHeight(service) + FLOW_STANDALONE_GAP
  }

  return {
    positions,
    laneNotePosition: { x: graphWidth + FLOW_STANDALONE_OFFSET, y: 0 },
  }
}
