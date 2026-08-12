import { createFileRoute, notFound, useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import { mutateReviewApplication } from '../../lib/application'
import { loadReviewApplication } from '../../server/application'

export const Route = createFileRoute('/review/$applicationRef')({
  loader: async ({ params }) => {
    const application = await loadReviewApplication({ data: { ref: params.applicationRef } })
    if (!application) throw notFound()
    return application
  },
  component: ReviewDetail,
})

function ReviewDetail() {
  const application = Route.useLoaderData()
  const router = useRouter()
  const [note, setNote] = useState('')
  const [reasonCode, setReasonCode] = useState('not_a_fit')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (action: Parameters<typeof mutateReviewApplication>[0]) => {
    setWorking(true)
    setError(null)
    try {
      await mutateReviewApplication(action, application.publicRef, application.version, {
        note,
        reasonCode,
      })
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
        {application.status === 'SUBMITTED' ? (
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
            <button
              className='apply-button apply-danger'
              disabled={working}
              type='button'
              onClick={() => void run('reject')}
            >
              Reject
            </button>
            <button
              className='apply-button apply-primary'
              disabled={working}
              type='button'
              onClick={() => void run('approve')}
            >
              Approve
            </button>
          </>
        ) : null}
        {application.status === 'CREATION_FAILED' ? (
          <button
            className='apply-button apply-primary'
            disabled={working}
            type='button'
            onClick={() => void run('retry_creation')}
          >
            Retry creation
          </button>
        ) : null}
        {application.status === 'SETUP_FAILED' ? (
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
        {application.events.edges.map(({ cursor, node }) => (
          <li key={cursor} className='apply-copy'>
            {new Date(node.occurredAt).toLocaleString()} · {node.actorType.toLowerCase()} ·{' '}
            {node.fromStatus || 'new'} → {node.toStatus}
          </li>
        ))}
      </ol>
    </section>
  )
}
