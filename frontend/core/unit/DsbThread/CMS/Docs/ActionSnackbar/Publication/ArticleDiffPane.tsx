import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'

import useSalon from './salon'
import type { ArticleDiff } from './types'

type Props = { diff: ArticleDiff | null; title?: string; occurredAt?: string; actor?: string }

const renderValue = (value: unknown): string =>
  typeof value === 'string' ? value : (JSON.stringify(value, null, 2) ?? '')

const ArticleDiffPane: FC<Props> = ({ diff, title, occurredAt, actor }) => {
  const s = useSalon()
  const { t } = useTrans()

  if (!diff) return <p className={s.text}>{t('dsb.doc.publication.no_diff')}</p>

  const fields = Object.entries(diff.fields ?? {})
  const bodyDiff = diff.body as Partial<ArticleDiff['body']> | undefined
  const body = [
    ...(bodyDiff?.added ?? []),
    ...(bodyDiff?.removed ?? []),
    ...(bodyDiff?.changed ?? []),
  ]
  const moved = bodyDiff?.moved ?? []
  const tags = diff.tags as Partial<ArticleDiff['tags']> | undefined
  const cover = diff.cover as Partial<ArticleDiff['cover']> | undefined
  const assetRefs = diff.assetRefs as Partial<ArticleDiff['assetRefs']> | undefined

  return (
    <div className='column gap-4'>
      {(title || occurredAt || actor) && (
        <header className={s.panel}>
          {title && <strong>{title}</strong>}
          {(occurredAt || actor) && (
            <span className={s.text}>
              {occurredAt ? new Date(occurredAt).toLocaleString() : ''}
              {occurredAt && actor ? ' · ' : ''}
              {actor}
            </span>
          )}
        </header>
      )}
      {fields.map(([name, change]) => (
        <section className={s.changed} key={name}>
          <h3 className={s.title}>{name}</h3>
          <div className={s.columns}>
            <pre className='text-sm break-words whitespace-pre-wrap'>
              {renderValue(change.before)}
            </pre>
            <pre className='text-sm break-words whitespace-pre-wrap'>
              {renderValue(change.after)}
            </pre>
          </div>
        </section>
      ))}
      {body.map((change, index) => (
        <section className={s.changed} key={`${change.id}-${index}`}>
          <h3 className={s.title}>{change.id}</h3>
          <div className={s.columns}>
            <pre className='text-sm break-words whitespace-pre-wrap'>
              {'before' in change ? renderValue(change.before) : ''}
            </pre>
            <pre className='text-sm break-words whitespace-pre-wrap'>
              {'after' in change ? renderValue(change.after) : ''}
            </pre>
          </div>
        </section>
      ))}
      {moved.map((change) => (
        <p className={s.text} key={`moved-${change.id}`}>
          {change.id}: {change.from.join('.')} → {change.to.join('.')}
        </p>
      ))}
      {((tags?.added?.length ?? 0) > 0 || (tags?.removed?.length ?? 0) > 0) && (
        <section className={s.changed}>
          <h3 className={s.title}>{t('dsb.doc.publication.field_tags')}</h3>
          <p>
            {t('dsb.doc.publication.added')}: {(tags?.added ?? []).join(', ')}
          </p>
          <p>
            {t('dsb.doc.publication.removed')}: {(tags?.removed ?? []).join(', ')}
          </p>
        </section>
      )}
      {cover?.before !== cover?.after && (
        <section className={s.changed}>
          <h3 className={s.title}>{t('dsb.doc.publication.field_cover_edit')}</h3>
          <div className={s.columns}>
            <pre className='text-sm break-words whitespace-pre-wrap'>
              {renderValue(cover?.before)}
            </pre>
            <pre className='text-sm break-words whitespace-pre-wrap'>
              {renderValue(cover?.after)}
            </pre>
          </div>
        </section>
      )}
      {((assetRefs?.added?.length ?? 0) > 0 ||
        (assetRefs?.removed?.length ?? 0) > 0 ||
        (assetRefs?.changed?.length ?? 0) > 0) && (
        <section className={s.changed}>
          <h3 className={s.title}>{t('dsb.doc.publication.field_asset_refs')}</h3>
          <pre className='text-sm break-words whitespace-pre-wrap'>{renderValue(assetRefs)}</pre>
        </section>
      )}
      {(bodyDiff?.duplicate_ids?.length ?? 0) > 0 && (
        <p role='alert' className={s.text}>
          {t('dsb.doc.publication.duplicate_ids')}: {bodyDiff?.duplicate_ids?.join(', ')}
        </p>
      )}
      {(bodyDiff?.degraded_ids?.length ?? 0) > 0 && (
        <p className={s.text}>{t('dsb.doc.publication.positional_match')}</p>
      )}
    </div>
  )
}

export default ArticleDiffPane
