import useTrans from '~/hooks/useTrans'
import type { ArtimentReadStatus } from '~/lib/graphql/generated/graphql'

type Props = {
  comment: {
    innerId: string
    status: ArtimentReadStatus
    title: string | null
    html: string | null
  }
}

/** Renders only the selected Comment beneath a restricted parent resource. */
export default function RestrictedMentionComment({ comment }: Props) {
  const { t } = useTrans()
  const status =
    comment.status === 'DELETED'
      ? t('mentions_graph.node.deleted')
      : t('mentions_graph.node.unavailable')

  return (
    <section id={`comment-${comment.innerId}`} className='mx-auto w-full max-w-3xl px-5 py-6'>
      <h2 className='text-xl font-semibold'>#{comment.innerId}</h2>
      {comment.html ? (
        <div
          className='mt-4'
          // oxlint-disable-next-line react/no-danger -- Comment HTML is sanitized by the backend BodyBag renderer.
          dangerouslySetInnerHTML={{ __html: comment.html }}
        />
      ) : (
        <p className='text-digest mt-4' role='status'>
          {status}
        </p>
      )}
    </section>
  )
}
