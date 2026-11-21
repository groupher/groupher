import { useEffect, useState, type FC } from 'react'

import useTrans from '~/hooks/useTrans'

import ArticleDiffPane from './ArticleDiffPane'
import useSalon from './salon'
import type { ArticleDiff, ArticleEventDetail, ArticleEventPage } from './types'

type Props = {
  data: ArticleEventPage | ArticleEventDetail | ArticleDiff
  onSelect: (id: string) => void
  onNext: (cursor: number, actorId?: string) => void
  onContributorNext: (eventId: string, cursor: number) => void
  onFilterActor: (actorId?: string) => void
  onCompare: (beforeSnapshotId: string, afterSnapshotId: string) => void
  comparing?: boolean
}

const latestVersions = <T extends { after_snapshot_id: string | null }>(items: T[]): T[] => {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (!item.after_snapshot_id || seen.has(item.after_snapshot_id)) return false
    seen.add(item.after_snapshot_id)
    return true
  })
}

const ArticleHistoryPane: FC<Props> = ({
  data,
  onSelect,
  onNext,
  onContributorNext,
  onFilterActor,
  onCompare,
  comparing = false,
}) => {
  const s = useSalon()
  const { t } = useTrans()
  const [beforeId, setBeforeId] = useState('')
  const [afterId, setAfterId] = useState('')
  const [actorId, setActorId] = useState('')

  useEffect(() => {
    if (!('items' in data)) return
    const versions = latestVersions(data.items)
    setBeforeId(versions.at(-1)?.after_snapshot_id ?? '')
    setAfterId(versions[0]?.after_snapshot_id ?? '')
  }, [data])

  if ('body' in data && 'fields' in data)
    return <ArticleDiffPane diff={data as unknown as ArticleDiff} />
  if ('diff' in data) {
    const actor = 'nickname' in data.actor ? data.actor.nickname || data.actor.login : 'System'
    return (
      <div className='column gap-3'>
        <ArticleDiffPane
          diff={data.diff}
          title={t(`dsb.doc.publication.event.${data.type}`)}
          occurredAt={data.occurred_at}
          actor={actor}
        />
        {data.type === 'publish' && (
          <section aria-label={t('dsb.doc.publication.contributors')} className='column gap-2'>
            <strong>{t('dsb.doc.publication.contributors')}</strong>
            {data.contributors.unknown && (
              <p className={s.text}>{t('dsb.doc.publication.contributors_unknown')}</p>
            )}
            <ul className='column gap-1'>
              {data.contributors.items.map((contributor) => (
                <li key={contributor.actor_id ?? contributor.event_ids[0]} className={s.text}>
                  {'nickname' in contributor.actor
                    ? contributor.actor.nickname || contributor.actor.login
                    : 'System'}
                </li>
              ))}
            </ul>
            {data.contributors.next_cursor !== null && (
              <button
                type='button'
                className={s.button}
                onClick={() => onContributorNext(data.id, data.contributors.next_cursor!)}
              >
                {t('dsb.doc.publication.more')}
              </button>
            )}
          </section>
        )}
      </div>
    )
  }

  const versions = latestVersions(data.items)

  return (
    <>
      <label className={s.row}>
        <span>{t('dsb.doc.publication.filter_actor')}</span>
        <select
          value={actorId}
          onChange={(event) => {
            const value = event.target.value
            setActorId(value)
            onFilterActor(value || undefined)
          }}
        >
          <option value=''>{t('dsb.doc.publication.all_actors')}</option>
          {Array.from(
            new Map(
              data.items
                .filter((item) => typeof item.actor_id === 'number')
                .map((item) => [String(item.actor_id), item.actor]),
            ),
          ).map(([id, actor]) => (
            <option key={id} value={id}>
              {'nickname' in actor ? actor.nickname || actor.login : 'System'}
            </option>
          ))}
        </select>
      </label>
      <div className={s.row}>
        <label>
          {t('dsb.doc.publication.compare_before')}{' '}
          <select value={beforeId} onChange={(event) => setBeforeId(event.target.value)}>
            {versions.map((event) => (
              <option key={event.after_snapshot_id} value={event.after_snapshot_id!}>
                #{event.sequence} · {t(`dsb.doc.publication.event.${event.type}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('dsb.doc.publication.compare_after')}{' '}
          <select value={afterId} onChange={(event) => setAfterId(event.target.value)}>
            {versions.map((event) => (
              <option key={event.after_snapshot_id} value={event.after_snapshot_id!}>
                #{event.sequence} · {t(`dsb.doc.publication.event.${event.type}`)}
              </option>
            ))}
          </select>
        </label>
        <button
          className={s.button}
          type='button'
          disabled={!beforeId || !afterId || beforeId === afterId || comparing}
          onClick={() => onCompare(beforeId, afterId)}
        >
          {t('dsb.doc.publication.compare_versions')}
        </button>
      </div>
      <ul className={s.tree}>
        {data.items.map((event) => (
          <li key={event.id}>
            <button className={s.button} type='button' onClick={() => onSelect(event.id)}>
              <span>{t(`dsb.doc.publication.event.${event.type}`)}</span>
              <span className={s.text}>
                {'nickname' in event.actor ? event.actor.nickname || event.actor.login : 'System'}
                {' · '}
                {new Date(event.occurred_at).toLocaleString()}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {data.next_cursor !== null && (
        <button
          type='button'
          className={s.button}
          onClick={() => onNext(data.next_cursor!, actorId || undefined)}
        >
          {t('dsb.doc.publication.more')}
        </button>
      )}
    </>
  )
}

export default ArticleHistoryPane
