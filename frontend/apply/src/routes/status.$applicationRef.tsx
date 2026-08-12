import { Link, createFileRoute, notFound, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { mutateReviewApplication } from '../lib/application'
import { loadOwnedApplication } from '../server/application'

const statusCopy: Record<string, string> = {
  SUBMITTED: 'Your application is waiting for review.',
  REVIEWING: 'Your application is being reviewed.',
  APPROVED: 'Approved. Community creation will begin shortly.',
  SETTING_UP: 'Your community is being initialized.',
  CREATED: 'Your community is ready.',
  REJECTED: 'The application was not approved.',
  CANCELLED: 'This application was cancelled.',
  EXPIRED: 'This application expired before review.',
  CREATION_FAILED: 'Community creation needs staff attention.',
  SETUP_FAILED: 'Community initialization needs staff attention.',
}

export const Route = createFileRoute('/status/$applicationRef')({
  loader: async ({ params }) => {
    const application = await loadOwnedApplication({ data: { ref: params.applicationRef } })
    if (!application) throw notFound()
    return application
  },
  component: ApplicationStatusPage,
})

function ApplicationStatusPage() {
  const application = Route.useLoaderData()
  const router = useRouter()
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isBlocking = ['SUBMITTED', 'REVIEWING', 'APPROVED', 'SETTING_UP'].includes(
    application.status,
  )
  const canCancel = ['SUBMITTED', 'REVIEWING'].includes(application.status)
  const canonicalOrigin = import.meta.env.PROD
    ? 'https://groupher.com'
    : 'https://groupher.localhost'

  useEffect(() => {
    if (!isBlocking) return
    const timer = window.setInterval(() => void router.invalidate(), 5_000)
    return () => window.clearInterval(timer)
  }, [isBlocking, router])

  return (
    <section className='apply-card'>
      <span className='apply-status'>{application.status.replaceAll('_', ' ')}</span>
      <h1 className='apply-title' style={{ marginTop: 18 }}>
        {application.title}
      </h1>
      <p className='apply-copy'>{statusCopy[application.status]}</p>
      <dl>
        <dt>Address</dt>
        <dd>/{application.slug}</dd>
        <dt>Submitted</dt>
        <dd>{new Date(application.submittedAt).toLocaleString()}</dd>
      </dl>
      {application.logo?.url ? (
        <img src={application.logo.url} alt='' width={72} height={72} />
      ) : null}
      {application.decisionReasonCode ? (
        <p className='apply-error'>Reason: {application.decisionReasonCode}</p>
      ) : null}
      {error ? <p className='apply-error'>{error}</p> : null}
      <div className='apply-actions'>
        <div>
          {canCancel ? (
            <button
              className='apply-button apply-danger'
              type='button'
              disabled={working}
              onClick={async () => {
                setWorking(true)
                setError(null)
                try {
                  await mutateReviewApplication(
                    'cancel',
                    application.publicRef,
                    application.version,
                  )
                  await router.invalidate()
                } catch (actionError) {
                  setError(actionError instanceof Error ? actionError.message : 'Cancel failed.')
                } finally {
                  setWorking(false)
                }
              }}
            >
              Cancel application
            </button>
          ) : null}
        </div>
        {application.status === 'CREATED' && application.community ? (
          <div>
            <a
              className='apply-button apply-secondary'
              href={`${canonicalOrigin}/${application.community.slug}`}
            >
              Open community
            </a>{' '}
            <a
              className='apply-button apply-primary'
              href={`${canonicalOrigin}/${application.community.slug}/dash`}
            >
              Open Dash
            </a>
          </div>
        ) : !isBlocking ? (
          <Link className='apply-button apply-primary' to='/'>
            Create another community
          </Link>
        ) : null}
      </div>
    </section>
  )
}
