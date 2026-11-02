'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'

import { THREAD } from '~/const/thread'
import { DSB_ROUTE } from '~/constant/route'
import { browserGraphQLRequest } from '~/graphql/client'
import useTrans from '~/hooks/useTrans'
import { Link as PlatformLink } from '~/platform'
import { ticketQueries } from '~/query'
import { invalidate, invalidatePrefix, QueryInvalidation } from '~/query/invalidation'
import { executeCommand } from '~/query/mutation/optimistic/execute'
import {
  addTicketCaseMember,
  addTicketCaseWorker,
  addTicketUpdate,
  createTicketCase,
  createWorkerTicket,
  ensureTicketDraft,
  moveTicketToDraft,
  publishTicket,
  removeTicketCaseMember,
  saveTicketDraft,
  setTicketAssignees,
  setTicketFacets,
  setTicketTags,
  transitionTicket,
  unlinkTicketSource,
  updateTicket,
} from '~/schemas/pages/ticket'
import type { TTicket, TTicketStatus, TTicketUpdate } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import Button from '~/ui/Buttons/Button'
import Input from '~/ui/Input'
import { toast } from '~/ui/Toaster'
import TicketTimeline from '~/unit/DsbThread/Kanban/TicketTimeline'

import TicketPublicationReview from './TicketPublicationReview'

const NEXT_STATUS: Record<TTicket['type'], Partial<Record<TTicketStatus, TTicketStatus>>> = {
  USER: { TODO: 'WIP', WIP: 'DONE', DONE: 'WIP' },
  WORKER: { TODO: 'WIP', WIP: 'DONE', DONE: 'WIP' },
  CASE: { OPEN: 'RESOLVED', RESOLVED: 'OPEN' },
}

const toDateInput = (date: string | null): string => (date ? date.slice(0, 10) : '')
const toDateTime = (date: string): string | null =>
  date ? new Date(`${date}T00:00:00.000Z`).toISOString() : null

export default function TicketWorkbench({ ticket }: { ticket: TTicket }) {
  const { slug } = useCommunity()
  const { t } = useTrans()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState(ticket.title)
  const [digest, setDigest] = useState(ticket.digest || '')
  const [priority, setPriority] = useState(String(ticket.priority))
  const [plannedStartAt, setPlannedStartAt] = useState(toDateInput(ticket.plannedStartAt))
  const [plannedEndAt, setPlannedEndAt] = useState(toDateInput(ticket.plannedEndAt))
  const [workerTitle, setWorkerTitle] = useState('')
  const [caseTitle, setCaseTitle] = useState('')
  const [selectedCaseId, setSelectedCaseId] = useState(ticket.cases[0]?.id || '')
  const [visibilityReason, setVisibilityReason] = useState('')
  const [publishPreviewOpen, setPublishPreviewOpen] = useState(false)
  const [previewTicket, setPreviewTicket] = useState<TTicket | null>(null)
  const [query, setQuery] = useState('')
  const [updateBody, setUpdateBody] = useState('')
  const [updateVisibility, setUpdateVisibility] = useState<'INTERNAL' | 'PUBLIC'>('INTERNAL')
  const [correctionTargetId, setCorrectionTargetId] = useState<string | null>(null)
  const [assigneeIds, setAssigneeIds] = useState(ticket.assignees.map((assignee) => assignee.id))
  const [tagIds, setTagIds] = useState(ticket.tags.map((tag) => String(tag.id)))
  const [versions, setVersions] = useState(
    ticket.facets
      .filter((facet) => facet.key === 'version')
      .map((facet) => facet.value)
      .join(', '),
  )
  const [operatingSystems, setOperatingSystems] = useState(
    ticket.facets
      .filter((facet) => facet.key === 'os')
      .map((facet) => facet.value)
      .join(', '),
  )
  const [modules, setModules] = useState(
    ticket.facets
      .filter((facet) => facet.key === 'module')
      .map((facet) => facet.value)
      .join(', '),
  )
  const [pending, setPending] = useState(false)
  const workflowVersion = ticket.workflowVersion ?? 0
  const deferredQuery = useDeferredValue(query)
  const assigneeCandidates = useQuery(ticketQueries.assigneeCandidates(slug))
  const tagGroups = useQuery(ticketQueries.tagGroups(slug))
  const communityTags = (tagGroups.data || [])
    .flatMap((group) => group?.tags || [])
    .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag))
  const relationType = ticket.type === 'CASE' ? 'USER' : 'WORKER'
  const relationQuery = useQuery({
    ...ticketQueries.searchInternal(slug, deferredQuery, relationType),
    enabled: deferredQuery.trim().length > 0 && (ticket.type === 'CASE' || ticket.type === 'USER'),
  })

  useEffect(() => {
    setTitle(ticket.title)
    setDigest(ticket.digest || '')
  }, [ticket.title, ticket.digest])

  useEffect(() => {
    setPriority(String(ticket.priority))
    setPlannedStartAt(toDateInput(ticket.plannedStartAt))
    setPlannedEndAt(toDateInput(ticket.plannedEndAt))
    setAssigneeIds(ticket.assignees.map((assignee) => assignee.id))
    setTagIds(ticket.tags.map((tag) => String(tag.id)))
    setVersions(
      ticket.facets
        .filter((facet) => facet.key === 'version')
        .map((facet) => facet.value)
        .join(', '),
    )
    setOperatingSystems(
      ticket.facets
        .filter((facet) => facet.key === 'os')
        .map((facet) => facet.value)
        .join(', '),
    )
    setModules(
      ticket.facets
        .filter((facet) => facet.key === 'module')
        .map((facet) => facet.value)
        .join(', '),
    )
  }, [
    ticket.priority,
    ticket.plannedStartAt,
    ticket.plannedEndAt,
    ticket.assignees,
    ticket.tags,
    ticket.facets,
  ])
  useEffect(() => {
    if (!ticket.canPublishPublicUpdates) {
      setUpdateVisibility('INTERNAL')
      setCorrectionTargetId(null)
    }
  }, [ticket.canPublishPublicUpdates])

  const refreshTicket = async () => {
    await invalidatePrefix(queryClient, ['ticket'])
    await invalidate(queryClient, [
      QueryInvalidation.article.lists({ community: slug, thread: THREAD.POST }),
      ...ticket.sources.flatMap((source) =>
        source.innerId === null
          ? []
          : [
              QueryInvalidation.article.content({
                community: slug,
                thread: THREAD.POST,
                innerId: String(source.innerId),
              }),
            ],
      ),
    ])
  }

  const run = async (action: () => Promise<unknown>, success: string) => {
    setPending(true)
    try {
      await action()
      await refreshTicket()
      toast(success, 'success')
      return true
    } catch (error) {
      await refreshTicket()
      toast(error instanceof Error ? error.message : t('ticket.management.failed'), 'error')
      return false
    } finally {
      setPending(false)
    }
  }

  const saveContent = async (ensureWorkspace = false) => {
    const contentChanged =
      title.trim() !== ticket.title || (digest.trim() || '') !== (ticket.digest || '')
    let draftVersion = ticket.draftVersion
    const lifecycleVersion = ticket.lifecycleVersion

    if (
      (contentChanged || ensureWorkspace) &&
      draftVersion === null &&
      ticket.publicationState === 'PUBLISHED'
    ) {
      if (lifecycleVersion === null) throw new Error(t('ticket.management.failed'))
      const result = await executeCommand({
        request: (variables) => browserGraphQLRequest(ensureTicketDraft, variables),
        variables: {
          community: slug,
          id: ticket.id,
          expectedLifecycleVersion: lifecycleVersion,
        },
      })
      draftVersion = result.ensureTicketDraft?.draftVersion ?? null
    }

    if (contentChanged) {
      if (draftVersion === null || lifecycleVersion === null) {
        throw new Error(t('ticket.management.failed'))
      }

      await executeCommand({
        request: (variables) => browserGraphQLRequest(saveTicketDraft, variables),
        variables: {
          community: slug,
          id: ticket.id,
          content: {
            title: title.trim(),
            digest: digest.trim() || '',
          },
          expectedDraftVersion: draftVersion,
          expectedLifecycleVersion: lifecycleVersion,
        },
      })
    }
  }

  const saveTicket = () =>
    run(async () => {
      await saveContent()
      await executeCommand({
        request: (variables) => browserGraphQLRequest(updateTicket, variables),
        variables: {
          community: slug,
          id: ticket.id,
          priority: Number(priority),
          plannedStartAt: toDateTime(plannedStartAt),
          plannedEndAt: toDateTime(plannedEndAt),
          expectedWorkflowVersion: workflowVersion,
        },
      })
    }, t('ticket.workbench.saved'))

  const reviewPublication = () =>
    run(async () => {
      await saveContent(true)
      await invalidatePrefix(queryClient, ['ticket', 'internal-detail', slug, ticket.id])
      const current = await queryClient.fetchQuery(ticketQueries.internalDetail(slug, ticket.id))
      if (!current) throw new Error(t('ticket.management.failed'))
      setPreviewTicket(current as unknown as TTicket)
      setPublishPreviewOpen(true)
    }, t('ticket.workbench.saved'))

  const saveSchedule = (startDate: string, endDate: string) => {
    if (startDate && endDate && startDate > endDate) {
      toast(t('ticket.workbench.invalid_schedule'), 'error')
      return
    }

    return run(
      () =>
        executeCommand({
          request: (variables) => browserGraphQLRequest(updateTicket, variables),
          variables: {
            community: slug,
            id: ticket.id,
            plannedStartAt: toDateTime(startDate),
            plannedEndAt: toDateTime(endDate),
            expectedWorkflowVersion: workflowVersion,
          },
        }),
      t('ticket.workbench.saved'),
    )
  }

  const nextStatus = NEXT_STATUS[ticket.type][ticket.status]
  const usersOrWorkers = useMemo(
    () =>
      (relationQuery.data?.entries || []).filter((entry) => {
        if (ticket.type === 'CASE') {
          return entry.type === 'USER' && !ticket.members.some((member) => member.id === entry.id)
        }
        return (
          entry.type === 'WORKER' &&
          !ticket.workers.some((worker) => worker.id === entry.id) &&
          !ticket.sharedWorkers.some((worker) => worker.id === entry.id)
        )
      }),
    [relationQuery.data, ticket.type, ticket.members, ticket.workers, ticket.sharedWorkers],
  )

  const addWorker = (workerTicketTitle: string) =>
    run(
      () =>
        executeCommand({
          request: (variables) => browserGraphQLRequest(createWorkerTicket, variables),
          variables: {
            community: slug,
            parentId: ticket.id,
            expectedWorkflowVersion: workflowVersion,
            title: workerTicketTitle.trim(),
            digest: null,
          },
        }),
      t('ticket.workbench.worker_created'),
    )

  const makeCase = () =>
    run(async () => {
      const result = await executeCommand({
        request: (variables) => browserGraphQLRequest(createTicketCase, variables),
        variables: {
          community: slug,
          title: caseTitle.trim(),
          digest: null,
          body: null,
          memberTicketId: ticket.id,
        },
      })
      const created = result.createTicketCase
      if (!created) throw new Error(t('ticket.management.failed'))
    }, t('ticket.workbench.case_created')).then((succeeded) => {
      if (succeeded) setCaseTitle('')
    })

  const addRelation = (id: string) => {
    if (ticket.type === 'CASE') {
      return run(
        () =>
          executeCommand({
            request: (variables) => browserGraphQLRequest(addTicketCaseMember, variables),
            variables: {
              community: slug,
              caseId: ticket.id,
              ticketId: id,
              expectedWorkflowVersion: workflowVersion,
            },
          }),
        t('ticket.workbench.member_added'),
      )
    }

    const selectedCase = ticket.cases.find((caseItem) => caseItem.id === selectedCaseId)
    if (!selectedCase) {
      toast(t('ticket.workbench.select_case_first'), 'error')
      return
    }

    return run(
      () =>
        executeCommand({
          request: (variables) => browserGraphQLRequest(addTicketCaseWorker, variables),
          variables: {
            community: slug,
            caseId: selectedCase.id,
            workerId: id,
            expectedWorkflowVersion: selectedCase.workflowVersion ?? 0,
          },
        }),
      t('ticket.workbench.worker_shared'),
    )
  }

  const addUpdateEntry = () => {
    const publicUpdate =
      (correctionTargetId !== null || updateVisibility === 'PUBLIC') &&
      ticket.type === 'USER' &&
      ticket.publicationState === 'PUBLISHED' &&
      ticket.canPublishPublicUpdates
    let expectedLifecycleVersion: number | undefined
    if (publicUpdate) {
      if (ticket.lifecycleVersion === null) {
        toast(t('ticket.management.failed'), 'error')
        return
      }
      expectedLifecycleVersion = ticket.lifecycleVersion
    }

    return run(
      () =>
        executeCommand({
          request: (variables) => browserGraphQLRequest(addTicketUpdate, variables),
          variables: {
            community: slug,
            id: ticket.id,
            body: updateBody.trim(),
            visibility: publicUpdate ? 'PUBLIC' : 'INTERNAL',
            ...(correctionTargetId ? { supersedesId: correctionTargetId } : {}),
            ...(expectedLifecycleVersion === undefined ? {} : { expectedLifecycleVersion }),
            expectedWorkflowVersion: workflowVersion,
          },
        }),
      t('ticket.workbench.update_added'),
    ).then((succeeded) => {
      if (succeeded) {
        setUpdateBody('')
        setCorrectionTargetId(null)
      }
    })
  }

  const transition = () => {
    if (!nextStatus) return
    return run(
      () =>
        executeCommand({
          request: (variables) => browserGraphQLRequest(transitionTicket, variables),
          variables: {
            community: slug,
            id: ticket.id,
            status: nextStatus,
            expectedWorkflowVersion: workflowVersion,
          },
        }),
      t('ticket.workbench.status_changed'),
    )
  }

  const removeMember = (memberId: string) =>
    run(
      () =>
        executeCommand({
          request: (variables) => browserGraphQLRequest(removeTicketCaseMember, variables),
          variables: {
            community: slug,
            caseId: ticket.id,
            ticketId: memberId,
            expectedWorkflowVersion: workflowVersion,
          },
        }),
      t('ticket.workbench.member_removed'),
    )

  const saveAssignees = () =>
    run(
      () =>
        executeCommand({
          request: (variables) => browserGraphQLRequest(setTicketAssignees, variables),
          variables: {
            community: slug,
            ticketId: ticket.id,
            assigneeIds: assigneeIds.map(Number),
            expectedWorkflowVersion: workflowVersion,
          },
        }),
      t('ticket.workbench.assignee_saved'),
    )

  const saveTags = () =>
    run(
      () =>
        executeCommand({
          request: (variables) => browserGraphQLRequest(setTicketTags, variables),
          variables: {
            community: slug,
            ticketId: ticket.id,
            tagIds: tagIds.map(Number),
            expectedWorkflowVersion: workflowVersion,
          },
        }),
      t('ticket.workbench.tags_saved'),
    )

  const saveFacets = () => {
    const split = (value: string) =>
      Array.from(
        new Set(
          value
            .split(',')
            .map((item) => item.trim().toLowerCase())
            .filter(Boolean),
        ),
      )
    const facets = [
      ...split(versions).map((value) => ({ key: 'version', value })),
      ...split(operatingSystems).map((value) => ({ key: 'os', value })),
      ...split(modules).map((value) => ({ key: 'module', value })),
    ]

    return run(
      () =>
        executeCommand({
          request: (variables) => browserGraphQLRequest(setTicketFacets, variables),
          variables: {
            community: slug,
            ticketId: ticket.id,
            facets,
            expectedWorkflowVersion: workflowVersion,
          },
        }),
      t('ticket.workbench.facets_saved'),
    )
  }

  const unlinkPost = (sourceId: string) =>
    run(
      () =>
        executeCommand({
          request: (variables) => browserGraphQLRequest(unlinkTicketSource, variables),
          variables: {
            community: slug,
            ticketId: ticket.id,
            sourceId,
            expectedWorkflowVersion: workflowVersion,
          },
        }),
      t('ticket.workbench.post_unlinked'),
    )

  const submitPublish = async () => {
    if (
      !previewTicket ||
      !previewTicket.publicationPreview ||
      !visibilityReason.trim() ||
      previewTicket?.draftVersion === null ||
      previewTicket?.lifecycleVersion === null
    ) {
      return
    }

    const changed = await run(
      () =>
        executeCommand({
          request: (variables) => browserGraphQLRequest(publishTicket, variables),
          variables: {
            community: slug,
            id: ticket.id,
            reason: visibilityReason.trim(),
            expectedDraftVersion: previewTicket?.draftVersion,
            expectedLifecycleVersion: previewTicket?.lifecycleVersion,
            expectedWorkflowVersion: previewTicket.workflowVersion ?? 0,
            expectedPreview: previewTicket.publicationPreview,
          },
        }),
      t('ticket.workbench.visibility_changed'),
    )

    if (changed) {
      setVisibilityReason('')
      setPublishPreviewOpen(false)
    }
  }

  const changeVisibility = () => {
    if (!visibilityReason.trim()) return

    if (ticket.publicationState === 'DRAFT') {
      return reviewPublication()
    }

    return run(
      () =>
        executeCommand({
          request: (variables) => browserGraphQLRequest(moveTicketToDraft, variables),
          variables: {
            community: slug,
            id: ticket.id,
            reason: visibilityReason.trim(),
            expectedLifecycleVersion: ticket.lifecycleVersion ?? 0,
          },
        }),
      t('ticket.workbench.visibility_changed'),
    ).then((changed) => {
      if (changed) setVisibilityReason('')
    })
  }

  const updates: readonly TTicketUpdate[] = ticket.updates
  const supersededUpdateIds = new Set(
    updates.flatMap((update) => (update.supersedesId ? [update.supersedesId] : [])),
  )
  const correctionTarget = updates.find((update) => update.id === correctionTargetId)

  return (
    <main className='mx-auto w-full max-w-5xl space-y-8 px-5 py-8'>
      <header className='border-divider flex flex-wrap items-start gap-4 border-b pb-5'>
        <div className='min-w-0 grow'>
          <p className='text-digest font-mono text-sm'>
            {ticket.type} #{ticket.innerId ?? ticket.id.slice(0, 8)} · {ticket.status} · v
            {workflowVersion}
          </p>
          <h1 className='mt-2 text-3xl font-semibold'>{ticket.title}</h1>
          {ticket.digest && <p className='text-digest mt-2'>{ticket.digest}</p>}
        </div>
        {nextStatus && (
          <Button disabled={pending} loading={pending} onClick={transition}>
            {t('ticket.workbench.move_to', { status: nextStatus })}
          </Button>
        )}
        {ticket.type === 'USER' && (
          <div className='flex max-w-lg items-center gap-2'>
            {ticket.publicationState === 'PUBLISHED' && (
              <Button disabled={pending || !visibilityReason.trim()} onClick={reviewPublication}>
                {t('ticket.workbench.publish_changes')}
              </Button>
            )}
            <Input
              value={visibilityReason}
              onChange={(event) => setVisibilityReason(event.target.value)}
              placeholder={t('ticket.workbench.visibility_reason')}
            />
            <Button
              ghost
              disabled={pending || !visibilityReason.trim()}
              loading={pending}
              onClick={changeVisibility}
            >
              {ticket.publicationState === 'PUBLISHED'
                ? t('ticket.workbench.hold')
                : t('ticket.workbench.publish')}
            </Button>
          </div>
        )}
      </header>

      <section className='grid gap-4 md:grid-cols-2'>
        <div className='border-divider space-y-3 rounded-xl border p-4'>
          <h2 className='font-semibold'>{t('ticket.workbench.edit')}</h2>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          <Input
            behavior='textarea'
            rows={3}
            value={digest}
            onChange={(event) => setDigest(event.target.value)}
          />
          <label className='block text-sm'>
            {t('ticket.workbench.priority')}
            <Input
              type='number'
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
            />
          </label>
          <div className='grid grid-cols-2 gap-3'>
            <label className='text-sm'>
              {t('ticket.workbench.planned_start')}
              <input
                className='border-divider mt-1 w-full rounded-lg border bg-transparent p-2'
                type='date'
                value={plannedStartAt}
                onChange={(event) => setPlannedStartAt(event.target.value)}
              />
            </label>
            <label className='text-sm'>
              {t('ticket.workbench.planned_end')}
              <input
                className='border-divider mt-1 w-full rounded-lg border bg-transparent p-2'
                type='date'
                value={plannedEndAt}
                onChange={(event) => setPlannedEndAt(event.target.value)}
              />
            </label>
          </div>
          <Button disabled={pending || !title.trim()} loading={pending} onClick={saveTicket}>
            {t('ticket.workbench.save')}
          </Button>
        </div>

        <div className='border-divider space-y-3 rounded-xl border p-4'>
          <h2 className='font-semibold'>{t('ticket.workbench.progress')}</h2>
          {ticket.type === 'USER' && (
            <div className='border-divider space-y-2 border-b pb-3'>
              <p className='text-digest text-sm'>{t('ticket.workbench.workers')}</p>
              {ticket.workers.map((worker) => (
                <PlatformLink
                  key={worker.id}
                  route={{
                    app: 'dsb',
                    community: slug,
                    path: `${DSB_ROUTE.KANBAN}/ticket/${worker.id}`,
                  }}
                  navigation='router'
                  className='text-accent block text-sm hover:underline'
                >
                  {worker.status} · {worker.title}
                </PlatformLink>
              ))}
              <div className='flex gap-2'>
                <Input
                  value={workerTitle}
                  onChange={(event) => setWorkerTitle(event.target.value)}
                  placeholder={t('ticket.workbench.worker_title')}
                />
                <Button
                  disabled={pending || !workerTitle.trim()}
                  loading={pending}
                  onClick={() =>
                    void addWorker(workerTitle).then((succeeded) => {
                      if (succeeded) setWorkerTitle('')
                    })
                  }
                >
                  {t('ticket.workbench.add_worker')}
                </Button>
              </div>
            </div>
          )}

          {ticket.type === 'CASE' && (
            <div className='border-divider space-y-3 border-b pb-3'>
              <div>
                <p className='text-digest text-sm'>{t('ticket.workbench.members')}</p>
                {ticket.members.map((member) => (
                  <div key={member.id} className='flex items-center justify-between gap-3 py-1'>
                    <span className='text-sm'>{member.title}</span>
                    <Button
                      size='small'
                      ghost
                      disabled={pending}
                      onClick={() => removeMember(member.id)}
                    >
                      {t('ticket.workbench.remove')}
                    </Button>
                  </div>
                ))}
              </div>
              <div>
                <p className='text-digest mb-2 text-sm'>{t('ticket.workbench.shared_workers')}</p>
                {ticket.sharedWorkers.map((worker) => (
                  <PlatformLink
                    key={worker.id}
                    route={{
                      app: 'dsb',
                      community: slug,
                      path: `${DSB_ROUTE.KANBAN}/ticket/${worker.id}`,
                    }}
                    navigation='router'
                    className='text-accent block text-sm hover:underline'
                  >
                    {worker.title}
                  </PlatformLink>
                ))}
              </div>
            </div>
          )}

          {(ticket.type === 'CASE' || (ticket.type === 'USER' && ticket.cases.length > 0)) && (
            <div className='space-y-2'>
              {ticket.type === 'USER' && (
                <label className='block text-sm'>
                  {t('ticket.workbench.share_worker_case')}
                  <select
                    className='border-divider mt-1 w-full rounded-lg border bg-transparent p-2'
                    value={selectedCaseId}
                    onChange={(event) => setSelectedCaseId(event.target.value)}
                  >
                    {ticket.cases.map((caseItem) => (
                      <option key={caseItem.id} value={caseItem.id}>
                        {caseItem.title}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t(
                  ticket.type === 'CASE'
                    ? 'ticket.workbench.search_members'
                    : 'ticket.workbench.search_workers',
                )}
              />
              {usersOrWorkers.slice(0, 5).map((entry) => (
                <div key={entry.id} className='flex items-center justify-between gap-3'>
                  <span className='truncate text-sm'>{entry.title}</span>
                  <Button size='small' disabled={pending} onClick={() => addRelation(entry.id)}>
                    {t(
                      ticket.type === 'CASE'
                        ? 'ticket.workbench.add_member'
                        : 'ticket.workbench.share_worker',
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {ticket.type === 'USER' && ticket.cases.length > 0 && (
            <div className='border-divider space-y-2 border-t pt-3'>
              <p className='text-digest text-sm'>{t('ticket.workbench.cases')}</p>
              {ticket.cases.map((caseItem) => (
                <PlatformLink
                  key={caseItem.id}
                  route={{
                    app: 'dsb',
                    community: slug,
                    path: `${DSB_ROUTE.KANBAN}/ticket/${caseItem.id}`,
                  }}
                  navigation='router'
                  className='text-accent block text-sm hover:underline'
                >
                  {caseItem.status} · {caseItem.title}
                </PlatformLink>
              ))}
            </div>
          )}

          {ticket.type === 'USER' && (
            <div className='border-divider space-y-2 border-t pt-3'>
              <p className='text-digest text-sm'>{t('ticket.workbench.posts')}</p>
              {ticket.sources.map((source) => (
                <div key={source.id} className='flex items-center justify-between gap-3'>
                  <div className='min-w-0'>
                    <span className='truncate text-sm'>
                      #{source.innerId} {source.title}
                    </span>
                    {source.isPublic === false && (
                      <p className='text-digest mt-1 text-xs' role='status'>
                        {source.reviewBlockTypes?.length
                          ? t('ticket.workbench.review_blocked_post', {
                              reasons: source.reviewBlockTypes.join(', '),
                            })
                          : t('ticket.workbench.post_not_public')}
                      </p>
                    )}
                  </div>
                  <Button
                    size='small'
                    ghost
                    disabled={pending}
                    onClick={() => unlinkPost(source.id)}
                  >
                    {t('ticket.workbench.unlink')}
                  </Button>
                </div>
              ))}
              <p className='text-digest text-xs'>
                {t('ticket.workbench.link_posts_from_dashboard')}
              </p>
            </div>
          )}

          {ticket.type === 'USER' && (
            <div className='border-divider space-y-2 border-t pt-3'>
              <Input
                value={caseTitle}
                onChange={(event) => setCaseTitle(event.target.value)}
                placeholder={t('ticket.workbench.case_title')}
              />
              <Button disabled={pending || !caseTitle.trim()} loading={pending} onClick={makeCase}>
                {t('ticket.workbench.create_case')}
              </Button>
            </div>
          )}

          <div className='border-divider space-y-3 border-t pt-3'>
            <div className='space-y-2'>
              <p className='text-digest text-sm'>{t('ticket.workbench.assignees')}</p>
              {(assigneeCandidates.data || []).length === 0 ? (
                <p className='text-digest text-xs'>
                  {t('ticket.workbench.assignee_candidates_empty')}
                </p>
              ) : (
                <select
                  className='border-divider min-h-20 w-full rounded-lg border bg-transparent p-2 text-sm'
                  multiple
                  value={assigneeIds}
                  onChange={(event) =>
                    setAssigneeIds(
                      Array.from(event.currentTarget.selectedOptions, (option) => option.value),
                    )
                  }
                >
                  {(assigneeCandidates.data || []).map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.nickname || user.login}
                    </option>
                  ))}
                </select>
              )}
              <Button disabled={pending} loading={pending} onClick={saveAssignees}>
                {t('ticket.workbench.assignees')}
              </Button>
            </div>

            <div className='space-y-2'>
              <p className='text-digest text-sm'>{t('ticket.workbench.tags')}</p>
              <select
                className='border-divider min-h-20 w-full rounded-lg border bg-transparent p-2 text-sm'
                multiple
                value={tagIds}
                onChange={(event) =>
                  setTagIds(
                    Array.from(event.currentTarget.selectedOptions, (option) => option.value),
                  )
                }
              >
                {communityTags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.title}
                  </option>
                ))}
              </select>
              <Button disabled={pending} loading={pending} onClick={saveTags}>
                {t('ticket.workbench.tags_saved')}
              </Button>
            </div>

            <div className='space-y-2'>
              <p className='text-digest text-sm'>{t('ticket.workbench.facets')}</p>
              <label className='block text-sm'>
                {t('ticket.workbench.version')}
                <Input value={versions} onChange={(event) => setVersions(event.target.value)} />
              </label>
              <label className='block text-sm'>
                {t('ticket.workbench.os')}
                <Input
                  value={operatingSystems}
                  onChange={(event) => setOperatingSystems(event.target.value)}
                />
              </label>
              <label className='block text-sm'>
                {t('ticket.workbench.module')}
                <Input value={modules} onChange={(event) => setModules(event.target.value)} />
              </label>
              <Button disabled={pending} loading={pending} onClick={saveFacets}>
                {t('ticket.workbench.facets_saved')}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <TicketTimeline
        startDate={plannedStartAt}
        endDate={plannedEndAt}
        status={ticket.status}
        disabled={pending}
        onChange={(startDate, endDate) => {
          setPlannedStartAt(startDate)
          setPlannedEndAt(endDate)
        }}
        onCommit={saveSchedule}
      />

      <section className='border-divider space-y-4 rounded-xl border p-4'>
        <h2 className='font-semibold'>{t('ticket.workbench.updates')}</h2>
        <div className='space-y-3'>
          {updates.map((update) => (
            <article key={update.id} className='border-divider border-l-2 pl-3'>
              <p className='text-digest text-xs'>
                {update.visibility} · {update.publishedAt || ''}
                {supersededUpdateIds.has(update.id) && ` · ${t('ticket.workbench.superseded')}`}
              </p>
              <p className='mt-1 text-sm whitespace-pre-wrap'>{update.body}</p>
              {update.supersedesId && (
                <p className='text-digest mt-1 text-xs'>
                  {t('ticket.workbench.correction_for', {
                    date:
                      updates.find((original) => original.id === update.supersedesId)
                        ?.publishedAt || '',
                  })}
                </p>
              )}
              {ticket.type === 'USER' &&
                ticket.publicationState === 'PUBLISHED' &&
                ticket.canPublishPublicUpdates &&
                update.visibility === 'PUBLIC' &&
                !supersededUpdateIds.has(update.id) && (
                  <Button
                    size='small'
                    ghost
                    disabled={pending}
                    onClick={() => {
                      setCorrectionTargetId(update.id)
                      setUpdateVisibility('PUBLIC')
                    }}
                  >
                    {t('ticket.workbench.correct_update')}
                  </Button>
                )}
            </article>
          ))}
          {updates.length === 0 && (
            <p className='text-digest text-sm'>{t('ticket.workbench.no_updates')}</p>
          )}
        </div>
        {correctionTarget && (
          <div className='border-divider flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3'>
            <p className='text-sm'>
              {t('ticket.workbench.correction_for', {
                date: correctionTarget.publishedAt || '',
              })}
            </p>
            <Button
              size='small'
              ghost
              disabled={pending}
              onClick={() => {
                setCorrectionTargetId(null)
                setUpdateVisibility('INTERNAL')
              }}
            >
              {t('ticket.workbench.cancel_correction')}
            </Button>
          </div>
        )}
        <Input
          behavior='textarea'
          rows={3}
          value={updateBody}
          onChange={(event) => setUpdateBody(event.target.value)}
          placeholder={
            correctionTargetId
              ? t('ticket.workbench.correction_placeholder')
              : t('ticket.workbench.update_placeholder')
          }
        />
        <div className='flex flex-wrap items-center justify-between gap-3'>
          {ticket.type === 'USER' ? (
            <label className='flex items-center gap-2 text-sm'>
              {t('ticket.workbench.update_visibility')}
              <select
                className='border-divider rounded-lg border bg-transparent p-2'
                value={ticket.canPublishPublicUpdates ? updateVisibility : 'INTERNAL'}
                disabled={Boolean(correctionTargetId)}
                onChange={(event) =>
                  setUpdateVisibility(event.target.value as 'INTERNAL' | 'PUBLIC')
                }
              >
                <option value='INTERNAL'>{t('ticket.workbench.internal')}</option>
                <option value='PUBLIC' disabled={!ticket.canPublishPublicUpdates}>
                  {t('ticket.workbench.public')}
                </option>
              </select>
            </label>
          ) : (
            <span className='text-digest text-sm'>{t('ticket.workbench.internal')}</span>
          )}
          <Button
            disabled={pending || !updateBody.trim()}
            loading={pending}
            onClick={addUpdateEntry}
          >
            {correctionTargetId
              ? t('ticket.workbench.submit_correction')
              : t('ticket.workbench.add_update')}
          </Button>
        </div>
      </section>

      <section className='space-y-3'>
        <h2 className='font-semibold'>{t('ticket.workbench.history')}</h2>
        {(ticket.activity?.entries || []).map((event) => (
          <div key={event.id} className='text-digest flex flex-wrap gap-x-3 text-sm'>
            <time>{event.occurredAt}</time>
            <span>{event.action}</span>
            {event.payload !== null && event.payload !== undefined ? (
              <span>{JSON.stringify(event.payload)}</span>
            ) : null}
          </div>
        ))}
      </section>

      <TicketPublicationReview
        ticket={previewTicket}
        show={publishPreviewOpen}
        reason={visibilityReason}
        pending={pending}
        onClose={() => setPublishPreviewOpen(false)}
        onConfirm={() => void submitPublish()}
      />
    </main>
  )
}
