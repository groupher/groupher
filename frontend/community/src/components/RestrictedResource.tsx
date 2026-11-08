import useTrans from '~/hooks/useTrans'

import type { RestrictedResourceNode } from '../query/restrictedResource'

type Props = { node: RestrictedResourceNode }

/** Shows a resource's public title and availability without rendering its body. */
export default function RestrictedResource({ node }: Props) {
  const { t } = useTrans()
  const status =
    node.status === 'DELETED'
      ? t('mentions_graph.node.deleted')
      : t('mentions_graph.node.unavailable')

  return (
    <article className='mx-auto w-full max-w-3xl px-5 py-10'>
      <h1 className='text-3xl font-semibold'>{node.title || status}</h1>
      <p className='text-digest mt-4' role='status'>
        {status}
      </p>
    </article>
  )
}
