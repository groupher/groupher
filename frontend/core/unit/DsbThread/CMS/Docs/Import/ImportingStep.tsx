import useTrans from '~/hooks/useTrans'

import ImportProcessLog from '../../ContentImport/ProcessLog'
import type { TImportProcess } from '../../ContentImport/ProcessLog/spec'
import useSalon from './salon/importing_step'

type TProps = {
  disconnected: boolean
  process: TImportProcess
}

/** Renders BodyBag preparation and atomic-apply progress for the active Job. */
export default function ImportingStep({ disconnected, process }: TProps) {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <section className={s.wrapper}>
      <h2 className={s.title}>{t('dsb.doc.bulk_import.importing.title')}</h2>
      <p className={s.description}>{t('dsb.doc.bulk_import.importing.desc')}</p>
      <div className={s.process}>
        <ImportProcessLog disconnected={disconnected} process={process} />
      </div>
    </section>
  )
}
