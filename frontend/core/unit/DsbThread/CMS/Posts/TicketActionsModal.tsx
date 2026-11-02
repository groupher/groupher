'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useDeferredValue, useState } from 'react'

import { THREAD } from '~/const/thread'
import { browserGraphQLRequest } from '~/graphql/client'
import useTrans from '~/hooks/useTrans'
import { ticketQueryKeys, ticketQueries } from '~/query'
import { invalidate, invalidatePrefix, QueryInvalidation } from '~/query/invalidation'
import { executeCommand } from '~/query/mutation/optimistic/execute'
import { createTicketFromPost, linkTicketSource } from '~/schemas/pages/ticket'
import type { TArticle } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import Button from '~/ui/Buttons/Button'
import Input from '~/ui/Input'
import Modal from '~/ui/Modal'
import { toast } from '~/ui/Toaster'

type TProps = {
  post: TArticle
  show: boolean
  onClose: () => void
}

export default function TicketActionsModal({ post, show, onClose }: TProps) {
  const { slug } = useCommunity()
  const { t } = useTrans()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'create' | 'link'>('create')
  const [title, setTitle] = useState(post.title || '')
  const [digest, setDigest] = useState(post.digest || '')
  const [search, setSearch] = useState('')
  const [pending, setPending] = useState(false)
  const deferredSearch = useDeferredValue(search)
  const linkedTicketsQuery = useQuery({
    ...ticketQueries.postLinksInternal(slug, post.id ?? ''),
    enabled: show && !!post.id,
  })
  const searchQuery = useQuery({
    ...ticketQueries.searchInternal(slug, deferredSearch, 'USER'),
    enabled: show && mode === 'link' && deferredSearch.trim().length > 0,
  })
  const linkedTickets = linkedTicketsQuery.data || []

  const refreshTicketReads = async () => {
    await invalidatePrefix(queryClient, ticketQueryKeys.all)
    if (post.innerId === null || post.innerId === undefined) return

    await invalidate(queryClient, [
      QueryInvalidation.article.lists({ community: slug, thread: THREAD.POST }),
      QueryInvalidation.article.content({
        community: slug,
        thread: THREAD.POST,
        innerId: String(post.innerId),
      }),
    ])
  }

  const createTicket = async () => {
    if (!post.id || !title.trim()) return
    setPending(true)

    try {
      await executeCommand({
        request: (variables) => browserGraphQLRequest(createTicketFromPost, variables),
        variables: {
          community: slug,
          postId: post.id,
          title: title.trim(),
          digest: digest.trim() || null,
        },
      })
      await refreshTicketReads()
      toast(t('ticket.management.created'), 'success')
      onClose()
    } catch (error) {
      toast(error instanceof Error ? error.message : t('ticket.management.failed'), 'error')
    } finally {
      setPending(false)
    }
  }

  const linkTicket = async (ticket: { id: string; workflowVersion: number | null }) => {
    if (!post.id) return
    setPending(true)

    try {
      await executeCommand({
        request: (variables) => browserGraphQLRequest(linkTicketSource, variables),
        variables: {
          community: slug,
          ticketId: ticket.id,
          type: 'POST',
          sourceId: post.id,
          expectedWorkflowVersion: ticket.workflowVersion ?? 0,
        },
      })
      await refreshTicketReads()
      toast(t('ticket.management.linked'), 'success')
      onClose()
    } catch (error) {
      toast(error instanceof Error ? error.message : t('ticket.management.failed'), 'error')
    } finally {
      setPending(false)
    }
  }

  return (
    <Modal show={show} width='520px' onClose={onClose} showCloseBtn>
      <div className='space-y-5 p-6'>
        <div>
          <p className='text-digest text-xs'>#{post.innerId}</p>
          <h2 className='mt-1 text-xl font-semibold'>{t('ticket.management.title')}</h2>
          <p className='text-digest mt-1 text-sm'>{post.title}</p>
        </div>

        {linkedTickets.length > 0 && (
          <div className='border-divider rounded-lg border p-3'>
            <p className='text-sm font-medium'>{t('ticket.management.already_linked')}</p>
            <ul className='text-digest mt-2 space-y-1 text-sm'>
              {linkedTickets.map((ticket) => (
                <li key={ticket.id}>
                  #{ticket.innerId} · {ticket.title} · {ticket.status}
                  {ticket.publicationState === 'DRAFT' && ` · ${t('ticket.management.draft')}`}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className='border-divider flex gap-2 border-b pb-3'>
          <Button
            size='small'
            soft={mode === 'create'}
            ghost={mode !== 'create'}
            onClick={() => setMode('create')}
          >
            {t('ticket.management.create')}
          </Button>
          <Button
            size='small'
            soft={mode === 'link'}
            ghost={mode !== 'link'}
            onClick={() => setMode('link')}
          >
            {t('ticket.management.link')}
          </Button>
        </div>

        {mode === 'create' ? (
          <div className='space-y-3'>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} required />
            <Input
              behavior='textarea'
              rows={3}
              value={digest}
              onChange={(event) => setDigest(event.target.value)}
              placeholder={t('ticket.management.digest')}
            />
            <div className='border-divider space-y-2 rounded-lg border p-3'>
              <p className='text-sm font-medium'>{t('ticket.management.public_preview')}</p>
              <p className='text-lg font-semibold'>{title.trim() || post.title}</p>
              {digest.trim() && <p className='text-digest text-sm'>{digest.trim()}</p>}
              {post.body?.markdown ? (
                <p className='text-digest text-sm whitespace-pre-wrap'>
                  {post.body.markdown.slice(0, 600)}
                </p>
              ) : (
                <p className='text-digest text-sm'>
                  {t('ticket.management.preview_body_from_post')}
                </p>
              )}
            </div>
            <p className='text-digest text-xs'>{t('ticket.management.create_hint')}</p>
            <div className='flex justify-end'>
              <Button disabled={pending || !title.trim()} loading={pending} onClick={createTicket}>
                {t('ticket.management.create')}
              </Button>
            </div>
          </div>
        ) : (
          <div className='space-y-3'>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('ticket.management.search')}
            />
            <div className='divide-divider border-divider max-h-64 divide-y overflow-y-auto rounded-lg border'>
              {(searchQuery.data?.entries || [])
                .filter(
                  (ticket) => ticket.type === 'USER' && ticket.publicationState === 'PUBLISHED',
                )
                .map((ticket) => (
                  <div key={ticket.id} className='flex items-center gap-3 p-3'>
                    <div className='min-w-0 grow'>
                      <p className='truncate text-sm font-medium'>{ticket.title}</p>
                      <p className='text-digest text-xs'>#{ticket.innerId}</p>
                    </div>
                    <Button
                      size='small'
                      disabled={pending}
                      loading={pending}
                      onClick={() => linkTicket(ticket)}
                    >
                      {t('ticket.management.link')}
                    </Button>
                  </div>
                ))}
              {search.trim() && !searchQuery.isPending && !searchQuery.data?.entries.length && (
                <p className='text-digest p-4 text-sm'>{t('ticket.management.no_results')}</p>
              )}
            </div>
            <p className='text-digest text-xs'>{t('ticket.management.link_hint')}</p>
          </div>
        )}
      </div>
    </Modal>
  )
}
