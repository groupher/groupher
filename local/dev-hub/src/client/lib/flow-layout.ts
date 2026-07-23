import type { TPublicService, TServiceRelation } from '@shared/contracts'
import type { ElkNode } from 'elkjs/lib/elk-api'
import ELK from 'elkjs/lib/elk-api.js'
import ElkWorker from 'elkjs/lib/elk-worker.min.js?worker'

import type { TFlowLayout } from '@/components/flow-spec'

const elk = new ELK({
  workerFactory: () => new ElkWorker(),
})
const NODE_WIDTH = 384
const COMPACT_NODE_HEIGHT = 94
const EXPANDED_NODE_HEIGHT = 351
const STANDALONE_GAP = 34
const STANDALONE_OFFSET = 112
const STANDALONE_TOP = 58

const getNodeHeight = (service: Pick<TPublicService, 'status'>): number =>
  service.status === 'stopped' || service.status === 'unavailable'
    ? COMPACT_NODE_HEIGHT
    : EXPANDED_NODE_HEIGHT

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
  const standaloneServices = services.filter((service) => !connectedIds.has(service.id))

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
      width: NODE_WIDTH,
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
    const right = Math.max(...targetPositions.map((position) => position.x + NODE_WIDTH))
    positions[sourceId] = {
      ...positions[sourceId],
      x: left + (right - left - NODE_WIDTH) / 2,
    }
  }

  if (standaloneServices.length === 0) {
    return { positions, laneNotePosition: null }
  }

  const graphWidth = graph.width || NODE_WIDTH
  let standaloneY = STANDALONE_TOP
  for (const service of standaloneServices) {
    positions[service.id] = { x: graphWidth + STANDALONE_OFFSET, y: standaloneY }
    standaloneY += getNodeHeight(service) + STANDALONE_GAP
  }

  return {
    positions,
    laneNotePosition: { x: graphWidth + STANDALONE_OFFSET, y: 0 },
  }
}
