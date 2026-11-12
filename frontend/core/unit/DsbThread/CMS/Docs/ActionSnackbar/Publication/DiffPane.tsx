import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'

import ContentView from './ContentView'
import DiffSummary from './DiffSummary'
import Navigation from './Navigation'
import useSalon from './salon'
import type { Comparison } from './types'

const DiffPane: FC<{ data: Comparison; onSelect: (id: string) => void }> = ({ data, onSelect }) => {
  const s = useSalon()
  const { t } = useTrans()
  const changed = [
    ...new Set([
      ...Object.keys(data.before_content ?? {}),
      ...Object.keys(data.after_content ?? {}),
    ]),
  ].filter(
    (key) =>
      !['id', 'article_id', 'body', 'tags'].includes(key) &&
      JSON.stringify(data.before_content?.[key]) !== JSON.stringify(data.after_content?.[key]),
  )
  return (
    <>
      <p>
        {t(
          data.baseline.type === 'approval'
            ? 'dsb.doc.publication.approved_baseline'
            : 'dsb.doc.publication.public_baseline',
        )}
      </p>
      <div className={s.row}>
        {data.members.map((member) => (
          <button
            className={s.button}
            type='button'
            key={member.article_id}
            onClick={() => onSelect(member.article_id)}
          >
            {member.after_title ?? member.before_title}{' '}
            {!member.before_id ? '+' : !member.after_id ? '−' : ''}
          </button>
        ))}
      </div>
      <div className={s.columns}>
        <section>
          <h3>{t('dsb.doc.publication.before')}</h3>
          <Navigation nodes={data.before_nodes} onSelect={onSelect} />
          <ContentView content={data.before_content} />
        </section>
        <section>
          <h3>{t('dsb.doc.publication.after')}</h3>
          <Navigation nodes={data.after_nodes} onSelect={onSelect} />
          <ContentView content={data.after_content} />
        </section>
      </div>
      <DiffSummary data={data} />
      {changed.map((key) => (
        <div key={key} className={s.changed}>
          <strong>
            {t(`dsb.doc.publication.field_${key}` as 'dsb.doc.publication.field_title')}
          </strong>
          <div className={s.columns}>
            <pre>
              {typeof data.before_content?.[key] === 'object'
                ? t('dsb.doc.publication.structured_content')
                : String(data.before_content?.[key] ?? '—')}
            </pre>
            <pre>
              {typeof data.after_content?.[key] === 'object'
                ? t('dsb.doc.publication.structured_content')
                : String(data.after_content?.[key] ?? '—')}
            </pre>
          </div>
        </div>
      ))}
    </>
  )
}
export default DiffPane
