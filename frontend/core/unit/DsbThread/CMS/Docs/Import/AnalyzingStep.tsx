import useTrans from '~/hooks/useTrans'

import ImportProcessLog from '../../ContentImport/ProcessLog'
import type { TImportProcess } from '../../ContentImport/ProcessLog/spec'
import useSalon from './salon/analyzing_step'

type TProps = {
  disconnected: boolean
  process: TImportProcess
  repoUrl: string
}

/** Renders durable repository-analysis progress for the active Preview. */
export default function AnalyzingStep({ disconnected, process, repoUrl }: TProps) {
  const s = useSalon()
  const { t } = useTrans()
  const repo = repoUrl.replace(/^https:\/\/github\.com\//, '')

  return (
    <section className={s.wrapper}>
      <h2 className={s.title}>{t('dsb.doc.bulk_import.analyzing.title')}</h2>
      <p className={s.description}>{repo}</p>
      <div className={s.process}>
        <ImportProcessLog disconnected={disconnected} process={process} />
      </div>
      <p className={s.hint}>{t('dsb.doc.bulk_import.analyzing.desc')}</p>
    </section>
  )
}
