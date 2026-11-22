import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'

import { bodyChanges, tagChanges } from './diffModel'
import useSalon from './salon'
import type { Comparison } from './types'

const DiffSummary: FC<{ data: Comparison }> = ({ data }) => {
  const s = useSalon()
  const { t } = useTrans()
  const changes = bodyChanges(data.before_content, data.after_content)
  const tags = tagChanges(data.before_content, data.after_content)
  return (
    <section className={s.panel}>
      <h3>
        {t('dsb.doc.publication.body_changes')} · {changes.length}
      </h3>
      {changes.map((change) => (
        <div key={change.id} className={s.changed}>
          <strong>
            {t(`dsb.doc.publication.${change.type}` as 'dsb.doc.publication.changed')}
          </strong>
          {change.before === change.after ? (
            <p>{t('dsb.doc.publication.block_attributes')}</p>
          ) : (
            <div className={s.columns}>
              <del>{change.before}</del>
              <ins>{change.after}</ins>
            </div>
          )}
        </div>
      ))}
      {(tags.added.length > 0 || tags.removed.length > 0) && (
        <p>
          {t('dsb.doc.publication.field_tags')}: + {tags.added.join(', ') || '—'} / −{' '}
          {tags.removed.join(', ') || '—'}
        </p>
      )}
    </section>
  )
}
export default DiffSummary
