import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import CopyPlusSVG from '~/icons/dsb/CopyPlus'

import { openDocImport, prepareDocImport } from '../Editor/Import/events'
import useDocsEditor from '../Editor/store/hooks'
import { DOC_ACTION_LABEL_KEY } from './constant'
import useSalon from './salon/import_content'

const ImportContent: FC = () => {
  const s = useSalon()
  const { t } = useTrans()
  const { publishView } = useDocsEditor()
  const docId = publishView.activeDocId
  const disabled = !docId
  const label = t(DOC_ACTION_LABEL_KEY.IMPORT)

  return (
    <button
      type='button'
      className={s.button}
      disabled={disabled}
      aria-label={label}
      title={label}
      onPointerDown={disabled ? undefined : () => prepareDocImport(docId)}
      onClick={() => docId && openDocImport(docId)}
    >
      <CopyPlusSVG className={s.icon(false)} />
    </button>
  )
}

export default ImportContent
