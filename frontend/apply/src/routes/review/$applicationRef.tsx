import { GATE_ACTION } from '@groupher/contracts/gate'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, notFound, useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import useGate from '~/hooks/useGate'
import usePagiPosition from '~/hooks/usePagiPosition'
import { viewerQueryKeys } from '~/query'
import useAccount from '~/stores/account/hooks'
import Pagi from '~/ui/Pagi'

import { mutateReviewApplication } from '../../lib/application'
import { loadReviewApplication } from '../../server/application'

export const Route = createFileRoute('/review/$applicationRef')({
  loader: async ({ context, params }) => {
    if (!context.reviewAllowed) return null
    const application = await loadReviewApplication({ data: { ref: params.applicationRef } })
    if (!application) throw notFound()
    return application
  },
  component: ReviewDetail,
})

function ReviewDetail() {
  const initialApplication = Route.useLoaderData()
  const { accountScope } = useAccount()
  const [seedOwner] = useState(accountScope)
  const position = usePagiPosition(`${accountScope}:${initialApplication?.publicRef}`)
  const events = useQuery({
    queryKey: [
      ...viewerQueryKeys.all,
      accountScope,
      'application-events',
      initialApplication?.publicRef,
      position.input,
    ],
    queryFn: async () =>
      (
        await loadReviewApplication({
          data: { ref: initialApplication!.publicRef, pagi: position.input },
        })
      )?.events ?? null,
    enabled: !!accountScope && !!initialApplication,
    initialData:
      accountScope === seedOwner && position.request.api === 'offset' && position.request.page === 1
        ? initialApplication?.events
        : undefined,
  })
  const eventPage = events.data
  const eventError = events.error ? String(events.error) : null
  const application = initialApplication
  const gate = useGate()
  const router = useRouter()
  const [note, setNote] = useState('')
  const [reasonCode, setReasonCode] = useState('not_a_fit')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!application) return null

  const run = async (action: Parameters<typeof mutateReviewApplication>[0]) => {
    setWorking(true)
    setError(null)
    try {
      await mutateReviewApplication(action, application.publicRef, application.version, {
        note,
        reasonCode,
      })
      await events.refetch()
      await router.invalidate()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Review action failed.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <section className='apply-card'>
      <span className='apply-status'>{application.status.replaceAll('_', ' ')}</span>
      <h2>{application.title}</h2>
      <p className='apply-copy'>
        Applicant: {application.applicant.publicRef} · /{application.slug}
      </p>
      <p>{application.desc}</p>
      {application.logo?.url ? (
        <img src={application.logo.url} alt='' width={80} height={80} />
      ) : null}
      {application.lastJobError ? (
        <p className='apply-error'>
          {application.lastJobError.reasonCode}: {application.lastJobError.message}
        </p>
      ) : null}
      <div className='apply-field'>
        <label htmlFor='review-note'>Review note</label>
        <textarea
          id='review-note'
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      {application.status === 'REVIEWING' ? (
        <div className='apply-field'>
          <label htmlFor='reason-code'>Rejection reason</label>
          <input
            id='reason-code'
            value={reasonCode}
            onChange={(event) => setReasonCode(event.target.value)}
          />
        </div>
      ) : null}
      {error ? <p className='apply-error'>{error}</p> : null}
      <div className='apply-actions'>
        {application.status === 'SUBMITTED' &&
        gate.can(GATE_ACTION.COMMUNITY_APPLICATION_REVIEW) ? (
          <button
            className='apply-button apply-primary'
            disabled={working}
            type='button'
            onClick={() => void run('start')}
          >
            Start review
          </button>
        ) : null}
        {application.status === 'REVIEWING' ? (
          <>
            {gate.can(GATE_ACTION.COMMUNITY_APPLICATION_REJECT) ? (
              <button
                className='apply-button apply-danger'
                disabled={working}
                type='button'
                onClick={() => void run('reject')}
              >
                Reject
              </button>
            ) : null}
            {gate.can(GATE_ACTION.COMMUNITY_APPLICATION_APPROVE) ? (
              <button
                className='apply-button apply-primary'
                disabled={working}
                type='button'
                onClick={() => void run('approve')}
              >
                Approve
              </button>
            ) : null}
          </>
        ) : null}
        {application.status === 'CREATION_FAILED' &&
        gate.can(GATE_ACTION.COMMUNITY_APPLICATION_RETRY_CREATION) ? (
          <button
            className='apply-button apply-primary'
            disabled={working}
            type='button'
            onClick={() => void run('retry_creation')}
          >
            Retry creation
          </button>
        ) : null}
        {application.status === 'SETUP_FAILED' &&
        gate.can(GATE_ACTION.COMMUNITY_APPLICATION_RETRY_SETUP) ? (
          <button
            className='apply-button apply-primary'
            disabled={working}
            type='button'
            onClick={() => void run('retry_setup')}
          >
            Retry setup
          </button>
        ) : null}
      </div>
      <h3>Timeline</h3>
      <ol>
        {(eventPage?.entries ?? []).map((node, index) => (
          <li key={`${node.occurredAt}:${index}`} className='apply-copy'>
            {new Date(node.occurredAt).toLocaleString()} · {node.actorType.toLowerCase()} ·{' '}
            {node.fromStatus || 'new'} → {node.toStatus}
          </li>
        ))}
      </ol>
      {eventError && (
        <p role='alert'>
          {eventError}{' '}
          <button type='button' onClick={() => void events.refetch()}>
            Retry
          </button>
        </p>
      )}
      <Pagi
        labels={{ previousPage: 'Previous page', nextPage: 'Next page', pageNumber: 'Page number' }}
        pageInfo={eventPage?.pageInfo}
        onChange={position.setPage}
      />
    </section>
  )
}
