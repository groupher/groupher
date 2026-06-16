import type { FC } from 'react'

import DownloadSimpleSVG from '~/icons/DownloadSimple'

import { DOC_ACTION } from './constant'
import useSalon from './salon/import_content'

const ImportContent: FC = () => {
  const s = useSalon()

  return (
    <button
      type='button'
      className={s.button}
      aria-label={DOC_ACTION.IMPORT}
      title={DOC_ACTION.IMPORT}
    >
      <DownloadSimpleSVG className={s.icon} />
    </button>
  )
}

export default ImportContent
