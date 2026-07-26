import '@xyflow/react/dist/style.css'
import type {
  TPublicService,
  TServiceMetricsSnapshot,
  TServiceRelation,
  TServiceStartMode,
} from '@shared/contracts'
import { Background, BackgroundVariant, MarkerType, ReactFlow } from '@xyflow/react'
import { type CSSProperties, useCallback, useEffect, useMemo, useState } from 'react'

import { layoutServiceFlow } from '@/lib/flow-layout'
import { FLOW_NODE_WIDTH, FLOW_USERS_TO_GATEWAY_OFFSET } from '@/lib/flow-metrics'

import type { TFlowEdge, TFlowLayout, TFlowNode } from './flow-spec'
import { FlowCanvasSizer } from './FlowCanvasSizer'
import { FlowInitialViewport } from './FlowInitialViewport'
import { FlowLaneNote } from './FlowLaneNote'
import { FlowNavigator } from './FlowNavigator'
import { FLOW_EDGE_COLOR, FlowRelationEdge } from './FlowRelationEdge'
import { FlowServiceNode } from './FlowServiceNode'
import { FlowUsersNode } from './FlowUsersNode'
import { TerminalPanel } from './TerminalPanel'

type TProps = {
  services: TPublicService[]
  relations: TServiceRelation[]
  metricsByService: Record<string, TServiceMetricsSnapshot>
  expandedIds: Set<string>
  pendingIds: Set<string>
  onToggleService: (service: TPublicService) => void
  onStartService: (service: TPublicService, mode: TServiceStartMode | 'default') => void
  onRestartService: (service: TPublicService) => void
  onToggleTerminal: (id: string) => void
  onOpenMetrics: (id: string) => void
  onOpenConfig: (id: string) => void
  onOpenDependencies: (id: string) => void
}

const NODE_TYPES = {
  service: FlowServiceNode,
  'lane-note': FlowLaneNote,
  users: FlowUsersNode,
}
const EDGE_TYPES = {
  relation: FlowRelationEdge,
}
const EDGE_LANE_GAP = 34
const USERS_GATEWAY_RELATION_ID = 'users-gateway'
const FLOW_LAYOUT_CACHE = new Map<string, TFlowLayout>()
const FLOW_LAYOUT_REQUEST_CACHE = new Map<string, Promise<TFlowLayout>>()

const isCompactService = (service: TPublicService): boolean =>
  service.status === 'stopped' || service.status === 'unavailable'

const isLiveService = (service: TPublicService | undefined): boolean =>
  Boolean(service && ['running', 'external'].includes(service.status))
const STARTED_DEPENDENCY_STATUSES = new Set<TPublicService['status']>(['running', 'external'])

const getFlowLayoutKey = (
  services: Pick<TPublicService, 'id' | 'status'>[],
  relations: TServiceRelation[],
): string =>
  JSON.stringify([
    services.map(({ id, status }) => [id, status]),
    relations.map(({ id, source, target }) => [id, source, target]),
  ])

const getFlowLayout = (
  key: string,
  services: Pick<TPublicService, 'id' | 'status'>[],
  relations: TServiceRelation[],
): Promise<TFlowLayout> => {
  const pendingLayout = FLOW_LAYOUT_REQUEST_CACHE.get(key)
  if (pendingLayout) return pendingLayout

  const request = layoutServiceFlow(services, relations).then(
    (layout) => {
      FLOW_LAYOUT_CACHE.set(key, layout)
      FLOW_LAYOUT_REQUEST_CACHE.delete(key)
      return layout
    },
    (error: unknown) => {
      FLOW_LAYOUT_REQUEST_CACHE.delete(key)
      throw error
    },
  )
  FLOW_LAYOUT_REQUEST_CACHE.set(key, request)
  return request
}

export function FlowView({
  services,
  relations,
  metricsByService,
  expandedIds,
  pendingIds,
  onToggleService,
  onStartService,
  onRestartService,
  onToggleTerminal,
  onOpenMetrics,
  onOpenConfig,
  onOpenDependencies,
}: TProps) {
  const layoutServices = useMemo(
    () => services.map(({ id, status }) => ({ id, status })),
    [services],
  )
  const layoutKey = useMemo(
    () => getFlowLayoutKey(layoutServices, relations),
    [layoutServices, relations],
  )
  const [layout, setLayout] = useState<TFlowLayout | null>(
    () => FLOW_LAYOUT_CACHE.get(layoutKey) || null,
  )
  const [canvasContentHeight, setCanvasContentHeight] = useState(0)
  const [viewportReady, setViewportReady] = useState(false)

  useEffect(() => {
    const cachedLayout = FLOW_LAYOUT_CACHE.get(layoutKey)
    if (cachedLayout) {
      setLayout(cachedLayout)
      return
    }

    let cancelled = false

    void getFlowLayout(layoutKey, layoutServices, relations).then((nextLayout) => {
      if (!cancelled) setLayout(nextLayout)
    })

    return () => {
      cancelled = true
    }
  }, [layoutKey, layoutServices, relations])

  const serviceById = useMemo(
    () => new Map(services.map((service) => [service.id, service])),
    [services],
  )
  const relationIdsByService = useMemo(() => {
    const incoming = new Map<string, string[]>()
    const outgoing = new Map<string, string[]>()

    for (const relation of relations) {
      incoming.set(relation.target, [...(incoming.get(relation.target) || []), relation.id])
      outgoing.set(relation.source, [...(outgoing.get(relation.source) || []), relation.id])
    }

    if (layout) {
      const relationById = new Map(relations.map((relation) => [relation.id, relation]))
      const sortByConnectedX = (
        relationIds: string[],
        getConnectedServiceId: (relation: TServiceRelation) => string,
      ) => {
        relationIds.sort((leftId, rightId) => {
          const leftRelation = relationById.get(leftId)
          const rightRelation = relationById.get(rightId)
          if (!leftRelation || !rightRelation) return leftId.localeCompare(rightId)

          const leftX = layout.positions[getConnectedServiceId(leftRelation)]?.x || 0
          const rightX = layout.positions[getConnectedServiceId(rightRelation)]?.x || 0
          return leftX - rightX || leftId.localeCompare(rightId)
        })
      }

      for (const relationIds of incoming.values()) {
        sortByConnectedX(relationIds, (relation) => relation.source)
      }
      for (const relationIds of outgoing.values()) {
        sortByConnectedX(relationIds, (relation) => relation.target)
      }
    }

    return { incoming, outgoing }
  }, [layout, relations])
  const laneOffsetByRelation = useMemo(() => {
    const offsets = new Map<string, number>()
    if (!layout) return offsets

    const relationById = new Map(relations.map((relation) => [relation.id, relation]))
    const assignLanes = (
      anchorServiceId: string,
      relationIds: string[],
      getConnectedServiceId: (relation: TServiceRelation) => string,
    ) => {
      if (relationIds.length < 2) return

      const anchorPosition = layout.positions[anchorServiceId]
      if (!anchorPosition) return

      const left: Array<{ id: string; x: number }> = []
      const center: Array<{ id: string; x: number }> = []
      const right: Array<{ id: string; x: number }> = []
      for (const relationId of relationIds) {
        const relation = relationById.get(relationId)
        if (!relation) continue

        const connectedPosition = layout.positions[getConnectedServiceId(relation)]
        if (!connectedPosition) continue

        const item = { id: relationId, x: connectedPosition.x }
        const delta = connectedPosition.x - anchorPosition.x
        if (Math.abs(delta) < 1) center.push(item)
        else if (delta < 0) left.push(item)
        else right.push(item)
      }

      left.sort((a, b) => b.x - a.x || a.id.localeCompare(b.id))
      right.sort((a, b) => a.x - b.x || a.id.localeCompare(b.id))
      center.sort((a, b) => a.id.localeCompare(b.id))

      for (const side of [left, right, center]) {
        side.forEach(({ id }, index) => {
          if (!offsets.has(id)) offsets.set(id, index * EDGE_LANE_GAP)
        })
      }
    }

    for (const [sourceId, relationIds] of relationIdsByService.outgoing) {
      assignLanes(sourceId, relationIds, (relation) => relation.target)
    }
    for (const [targetId, relationIds] of relationIdsByService.incoming) {
      assignLanes(targetId, relationIds, (relation) => relation.source)
    }

    return offsets
  }, [layout, relationIdsByService, relations])
  const coreNodes = useMemo(
    () =>
      Array.from(new Set(relations.flatMap((relation) => [relation.source, relation.target]))).map(
        (id) => ({ id }),
      ),
    [relations],
  )
  const requestPathIds = useMemo(
    () =>
      services.some((service) => service.id === 'gateway')
        ? [USERS_GATEWAY_RELATION_ID, ...coreNodes.map((node) => node.id)]
        : coreNodes.map((node) => node.id),
    [coreNodes, services],
  )
  const handleCanvasHeightChange = useCallback((height: number) => {
    setCanvasContentHeight(height)
  }, [])
  const handleViewportReady = useCallback(() => setViewportReady(true), [])
  const standaloneIds = useMemo(
    () =>
      services
        .filter(
          (service) =>
            !relationIdsByService.incoming.has(service.id) &&
            !relationIdsByService.outgoing.has(service.id),
        )
        .map((service) => service.id),
    [relationIdsByService, services],
  )

  const nodes = useMemo<TFlowNode[]>(() => {
    if (!layout) return []

    const serviceNodes: TFlowNode[] = []

    if (layout.positions.gateway) {
      serviceNodes.push({
        id: USERS_GATEWAY_RELATION_ID,
        type: 'users',
        position: {
          x: layout.positions.gateway.x,
          y: Math.max(0, layout.positions.gateway.y - FLOW_USERS_TO_GATEWAY_OFFSET),
        },
        style: { width: FLOW_NODE_WIDTH, pointerEvents: 'all' },
        draggable: false,
        selectable: false,
        focusable: false,
        ariaLabel: 'Users',
        data: {
          outgoingRelationId: USERS_GATEWAY_RELATION_ID,
        },
      })
    }

    const flowServiceNodes: TFlowNode[] = services.map((service) => {
      const requiredDependencies = service.startPolicy.requiredDependencies
      const hasRequiredDependencyIssue = requiredDependencies.some((dependencyId) => {
        const dependency = serviceById.get(dependencyId)
        return !dependency || !STARTED_DEPENDENCY_STATUSES.has(dependency.status)
      })
      const hasOptionalDependencyIssue =
        !hasRequiredDependencyIssue &&
        service.startPolicy.optionalDependencies.some((dependencyId) => {
          const dependency = serviceById.get(dependencyId)
          return !dependency || !STARTED_DEPENDENCY_STATUSES.has(dependency.status)
        })

      return {
        id: service.id,
        type: 'service',
        position: layout.positions[service.id] || { x: 0, y: 0 },
        style: { width: FLOW_NODE_WIDTH, pointerEvents: 'all' },
        draggable: false,
        selectable: false,
        focusable: false,
        ariaLabel: `${service.name} service`,
        data: {
          service,
          metrics: metricsByService[service.id],
          expanded: !isCompactService(service) && expandedIds.has(service.id),
          compact: false,
          pending: pendingIds.has(service.id),
          hasRequiredDependencyIssue,
          hasStartedRequiredDependencies:
            requiredDependencies.length > 0 && !hasRequiredDependencyIssue,
          hasOptionalDependencyIssue,
          incomingRelationIds:
            service.id === 'gateway'
              ? [
                  USERS_GATEWAY_RELATION_ID,
                  ...(relationIdsByService.incoming.get(service.id) || []),
                ]
              : relationIdsByService.incoming.get(service.id) || [],
          outgoingRelationIds: relationIdsByService.outgoing.get(service.id) || [],
          onToggleService,
          onStartService,
          onRestartService,
          onToggleTerminal,
          onOpenMetrics,
          onOpenConfig,
          onOpenDependencies,
        },
      }
    })

    serviceNodes.push(...flowServiceNodes)

    if (layout.laneNotePosition) {
      serviceNodes.push({
        id: 'standalone-services-note',
        type: 'lane-note',
        position: layout.laneNotePosition,
        draggable: false,
        selectable: false,
        focusable: false,
        data: {
          title: 'Standalone / planned',
          detail: 'Not currently on the request path',
        },
      })
    }

    return serviceNodes
  }, [
    expandedIds,
    layout,
    metricsByService,
    onOpenConfig,
    onOpenDependencies,
    onOpenMetrics,
    onRestartService,
    onStartService,
    onToggleService,
    onToggleTerminal,
    pendingIds,
    relationIdsByService,
    serviceById,
    services,
  ])

  const edges = useMemo<TFlowEdge[]>(() => {
    const relationEdges = relations.flatMap((relation): TFlowEdge[] => {
      const source = serviceById.get(relation.source)
      const target = serviceById.get(relation.target)
      if (!source || !target) return []

      const live = isLiveService(source) && isLiveService(target)
      const color = live ? FLOW_EDGE_COLOR.active : FLOW_EDGE_COLOR.inactive

      return [
        {
          id: relation.id,
          source: relation.source,
          target: relation.target,
          sourceHandle: relation.id,
          targetHandle: relation.id,
          type: 'relation',
          label: relation.label,
          data: {
            live,
            laneOffset: laneOffsetByRelation.get(relation.id) || 0,
            relationId: relation.id,
            sourceId: relation.source,
            targetId: relation.target,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 16,
            height: 16,
            color,
          },
        },
      ]
    })

    const gateway = serviceById.get('gateway')
    if (!gateway) return relationEdges

    const live = isLiveService(gateway)
    const color = live ? FLOW_EDGE_COLOR.active : FLOW_EDGE_COLOR.inactive

    return [
      {
        id: USERS_GATEWAY_RELATION_ID,
        source: USERS_GATEWAY_RELATION_ID,
        target: 'gateway',
        sourceHandle: USERS_GATEWAY_RELATION_ID,
        targetHandle: USERS_GATEWAY_RELATION_ID,
        type: 'relation',
        label: 'users',
        data: {
          live,
          laneOffset: 0,
          relationId: USERS_GATEWAY_RELATION_ID,
          sourceId: USERS_GATEWAY_RELATION_ID,
          targetId: 'gateway',
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 16,
          height: 16,
          color,
        },
      },
      ...relationEdges,
    ]
  }, [laneOffsetByRelation, relations, serviceById])

  const expandedServices = services.filter(
    (service) => !isCompactService(service) && expandedIds.has(service.id),
  )

  if (!layout) {
    return <div className='flow-loading'>Arranging the service flow…</div>
  }

  return (
    <section className='flow-view' aria-label='Service request flow'>
      <div
        className={`flow-canvas${viewportReady ? ' is-ready' : ''}`}
        style={{ '--flow-content-height': `${canvasContentHeight}px` } as CSSProperties}
        aria-busy={!viewportReady}
      >
        <ReactFlow<TFlowNode, TFlowEdge>
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag
          panOnScroll={false}
          preventScrolling={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          minZoom={0.22}
          maxZoom={1.35}
          proOptions={{ hideAttribution: true }}
        >
          <FlowCanvasSizer
            requestPathIds={requestPathIds}
            onHeightChange={handleCanvasHeightChange}
          />
          <FlowInitialViewport requestPathIds={requestPathIds} onReady={handleViewportReady} />
          <FlowNavigator requestPathIds={requestPathIds} standaloneIds={standaloneIds} />
          <Background
            variant={BackgroundVariant.Dots}
            gap={22}
            size={1}
            color='rgba(92, 92, 88, 0.2)'
          />
        </ReactFlow>
      </div>

      {expandedServices.length > 0 ? (
        <div className='flow-terminal-stack'>
          {expandedServices.map((service) => (
            <TerminalPanel key={service.id} service={service} onClose={onToggleTerminal} />
          ))}
        </div>
      ) : null}
    </section>
  )
}
