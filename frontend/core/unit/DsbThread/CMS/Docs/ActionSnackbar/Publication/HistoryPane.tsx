import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'

import ContentView from './ContentView'
import Navigation from './Navigation'
import useSalon from './salon'
import type { ReleasePage, SnapshotPage } from './types'
import type { Detail } from './usePublication'

type Props = {
  data: ReleasePage | SnapshotPage | Detail
  onRelease: (id: number, article?: string) => void
  onSnapshot: (id: string) => void
  onNext: (before?: number, cursor?: Record<string, unknown>) => void
}
const HistoryPane: FC<Props> = ({ data, onRelease, onSnapshot, onNext }) => {
  const s = useSalon()
  const { t } = useTrans()
  if ('nodes' in data)
    return (
      <>
        <Navigation nodes={data.nodes} onSelect={(id) => onRelease(data.id, id)} />
        <ContentView content={data.page} />
      </>
    )
  return (
    <>
      <ul className={s.tree}>
        {data.items.map((item) => (
          <li key={item.id}>
            <button
              className={s.button}
              type='button'
              onClick={() =>
                typeof item.id === 'number' ? onRelease(item.id) : onSnapshot(item.id)
              }
            >
              {'title' in item ? item.title : t('dsb.doc.publication.release')} ·{' '}
              {'published_at' in item ? item.published_at : item.captured_at}
            </button>
          </li>
        ))}
      </ul>
      {'page' in data && <ContentView content={data.page} />}
      {(('next_id' in data && data.next_id) || ('next_cursor' in data && data.next_cursor)) && (
        <button
          type='button'
          className={s.button}
          onClick={() =>
            onNext(
              'next_id' in data ? (data.next_id ?? undefined) : undefined,
              'next_cursor' in data ? (data.next_cursor ?? undefined) : undefined,
            )
          }
        >
          {t('dsb.doc.publication.more')}
        </button>
      )}
    </>
  )
}
export default HistoryPane
