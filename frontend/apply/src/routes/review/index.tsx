import { Link, createFileRoute } from '@tanstack/react-router'

import { loadReviewQueue } from '../../server/application'

export const Route = createFileRoute('/review/')({
  loader: () => loadReviewQueue(),
  component: ReviewQueue,
})

function ReviewQueue() {
  const applications = Route.useLoaderData()
  return (
    <ul className='apply-list'>
      {applications.map((application) => (
        <li key={application.publicRef}>
          <Link to={`/review/${application.publicRef}` as never}>
            <strong>{application.title}</strong>
            <div className='apply-copy'>
              /{application.slug} · {application.status.replaceAll('_', ' ')}
            </div>
          </Link>
        </li>
      ))}
      {applications.length === 0 ? <li className='apply-card'>The queue is empty.</li> : null}
    </ul>
  )
}
