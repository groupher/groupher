import '@xyflow/react/style.css'
import type {
  TPublicService,
  TServiceMetricsSnapshot,
  TServiceRelation,
  TServiceStartMode,
} from '@shared/contracts'
import { Background, BackgroundVariant, MarkerType, ReactFlow } from '@xyflow/react'
import { type CSSProperties, useCallback, useEffect, useMemo, useState } from 'react'

import { useFlowRelations } from '@/hooks/useFlowRelations'
import { layoutServiceFlow } from '@/lib/flow-layout'
import { FLOW_NODE_WIDTH, FLOW_USERS_TO_GATEWAY_OFFSET } from '@/lib/flow-metrics'
import { isServiceDisconnected } from '@/lib/service-connection-state'
import { buildServiceViewModel } from '@/lib/service-view-model'

import type { TFlowEdge, TFlowLayout, TFlowNode } from './flow-spec'
import { FlowCanvasSizer } from './FlowCanvasSizer'
import { FlowInitialViewport } from './FlowInitialViewport'
import { FlowLaneNote } from './FlowLaneNote'
import { FlowNavigator } from './FlowNavigator'
import { FlowRelationEdge } from './FlowRelationEdge'
import { FLOW_EDGE_COLOR } from './FlowRelationEdge.constants'
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
  onOpenExternal: (id: string) => void
}

const NODE_TYPES = {
  service: FlowServiceNode,
  'lane-note': FlowLaneNote,
  users: FlowUsersNode,
}
const EDGE_TYPES = {
  relation: FlowRelationEdge,
}
const USERS_GATEWAY_RELATION_ID = 'users-gateway'
const FLOW_LAYOUT_CACHE = new Map<string, TFlowLayout>()
const FLOW_LAYOUT_REQUEST_CACHE = new Map<string, Promise<TFlowLayout>>()

const isCompactService = (service: TPublicService): boolean =>
  service.status === 'stopped' || service.status === 'unavailable'

const isLiveService = (service: TPublicService | undefined): boolean =>
  Boolean(
    service && !isServiceDisconnected(service) && ['running', 'external'].includes(service.status),
  )

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
  onOpenExternal,
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

  const serviceViewModel = useMemo(() => buildServiceViewModel(services), [services])
  const { dependencyStateByServiceId, serviceById } = serviceViewModel
  const { relationIdsByService, laneOffsetByRelation } = useFlowRelations(layout, relations)
  const coreNodes = useMemo(
    () =>
      Array.from(new Set(relations.flatMap((relation) => [relation.source, relation.target]))).map(
        (id) => ({ id }),
      ),
    [relations],
  )
  const requestPathIds = useMemo(
    () =>
      services.some((service) => service.id === 'dev-gateway')
        ? [USERS_GATEWAY_RELATION_ID, ...coreNodes.map((node) => node.id)]
        : coreNodes.map((node) => node.id),
    [coreNodes, services],
  )
  const handleCanvasHeightChange = useCallback((height: number) => {
    setCanvasContentHeight(height)
  }, [])
  const handleViewportReady = useCallback(() => setViewportReady(true), [])
  const nodes = useMemo<TFlowNode[]>(() => {
    if (!layout) return []

    const serviceNodes: TFlowNode[] = []

    if (layout.positions['dev-gateway']) {
      serviceNodes.push({
        id: USERS_GATEWAY_RELATION_ID,
        type: 'users',
        position: {
          x: layout.positions['dev-gateway'].x,
          y: Math.max(0, layout.positions['dev-gateway'].y - FLOW_USERS_TO_GATEWAY_OFFSET),
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
      const dependencyState = dependencyStateByServiceId.get(service.id)

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
          hasRequiredDependencyIssue: dependencyState?.hasRequiredDependencyIssue || false,
          hasStartedRequiredDependencies: dependencyState?.hasStartedRequiredDependencies || false,
          hasOptionalDependencyIssue: dependencyState?.hasOptionalDependencyIssue || false,
          incomingRelationIds:
            service.id === 'dev-gateway'
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
          onOpenExternal,
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
    dependencyStateByServiceId,
    metricsByService,
    onOpenConfig,
    onOpenDependencies,
    onOpenMetrics,
    onOpenExternal,
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

    const gateway = serviceById.get('dev-gateway')
    if (!gateway) return relationEdges

    const live = isLiveService(gateway)
    const color = live ? FLOW_EDGE_COLOR.active : FLOW_EDGE_COLOR.inactive

    return [
      {
        id: USERS_GATEWAY_RELATION_ID,
        source: USERS_GATEWAY_RELATION_ID,
        target: 'dev-gateway',
        sourceHandle: USERS_GATEWAY_RELATION_ID,
        targetHandle: USERS_GATEWAY_RELATION_ID,
        type: 'relation',
        label: 'users',
        data: {
          live,
          laneOffset: 0,
          relationId: USERS_GATEWAY_RELATION_ID,
          sourceId: USERS_GATEWAY_RELATION_ID,
          targetId: 'dev-gateway',
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
          forceColorMode='light'
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
          <FlowNavigator requestPathIds={requestPathIds} />
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
