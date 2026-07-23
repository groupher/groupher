import useTrans from '~/hooks/useTrans'

import useSalon from './salon/recent_batch'
import type { TImportProcessItem } from './spec'

/** Renders the latest bounded item outcomes without becoming an audit log. */
export default function RecentBatch({ items }: { items: TImportProcessItem[] }) {
  const s = useSalon()
  const { t } = useTrans()

  if (items.length === 0) return null

  return (
    <section className={s.wrapper} aria-live='off'>
      <h3 className={s.title}>{t('dsb.content_import.process.recent')}</h3>
      <ul className={s.list}>
        {items.map((item) => (
          <li className={s.item} key={item.ref}>
            <span
              className={
                item.state === 'completed'
                  ? s.completedMark
                  : item.state === 'failed'
                    ? s.failedMark
                    : s.skippedMark
              }
              aria-hidden
            >
              {item.state === 'completed' ? '✓' : item.state === 'failed' ? '!' : '–'}
            </span>
            <span className={s.label} title={item.label}>
              {item.label}
            </span>
            {item.state === 'completed' ? null : (
              <span className={s.state}>
                {t(
                  item.state === 'failed'
                    ? 'dsb.content_import.process.failed'
                    : 'dsb.content_import.process.skipped',
                )}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
