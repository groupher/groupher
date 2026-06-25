import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import DownloadSimpleSVG from '~/icons/DownloadSimple'

import { DOC_ACTION_LABEL_KEY } from './constant'
import useSalon from './salon/import_content'

const ImportContent: FC = () => {
  const s = useSalon()
  const { t } = useTrans()
  const label = t(DOC_ACTION_LABEL_KEY.IMPORT)

  return (
    <button type='button' className={s.button} aria-label={label} title={label}>
      <DownloadSimpleSVG className={s.icon} />
    </button>
  )
}

export default ImportContent
