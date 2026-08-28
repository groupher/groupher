import useTrans from '~/hooks/useTrans'
import Button from '~/ui/Buttons/Button'

import ImportIssues from './ImportIssues'
import useSalon from './salon/completed_step'
import type { TContentImportJob } from './spec'

/** Renders the terminal Job summary and navigation to the first imported Doc. */
export default function CompletedStep({
  community,
  job,
  reset,
}: {
  community: string
  job: TContentImportJob
  reset: () => Promise<boolean>
}) {
  const s = useSalon()
  const { t } = useTrans()
  const editorUrl = `/${community}/doc/editor${job.firstImportedDocRef ? `?docId=${encodeURIComponent(job.firstImportedDocRef)}` : ''}`
  const issues = [...job.failedItems, ...job.skipped]
  const partial = issues.length > 0
  const total = job.progress.bodies?.total ?? job.counts.pages + issues.length

  return (
    <section className={s.wrapper}>
      <span className={s.successMark} aria-hidden>
        ✓
      </span>
      <h2 className={s.title}>
        {t(
          partial
            ? 'dsb.doc.bulk_import.completed.partial_title'
            : 'dsb.doc.bulk_import.completed.title',
        )}
      </h2>
      {partial ? (
        <p className={s.description}>
          {t('dsb.doc.bulk_import.completed.partial_prefix')} {job.counts.pages} / {total}{' '}
          {t('dsb.doc.bulk_import.completed.partial_suffix')}
        </p>
      ) : (
        <p className={s.description}>{t('dsb.doc.bulk_import.completed.desc')}</p>
      )}
      <ImportIssues issues={issues} />
      <div className={s.actions}>
        <Button ghost onClick={reset}>
          {t('dsb.doc.bulk_import.completed.another')}
        </Button>
        <Button onClick={() => window.location.assign(editorUrl)}>
          {t('dsb.doc.bulk_import.completed.open')}
        </Button>
      </div>
    </section>
  )
}
