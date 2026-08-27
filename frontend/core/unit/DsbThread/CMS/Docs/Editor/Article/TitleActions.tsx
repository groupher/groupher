import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import CopyPlusSVG from '~/icons/dsb/CopyPlus'
import ImgUploadSVG from '~/icons/ImgUpload'

import { openDocImport, prepareDocImport } from '../Import/events'
import { openDocCover } from './Cover/events'
import useSalon from './salon/title_actions'

type TProps = {
  coverVisible: boolean
  disabled?: boolean
  docId: string
}

const TitleActions: FC<TProps> = ({ coverVisible, disabled = false, docId }) => {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      {!coverVisible ? (
        <button
          type='button'
          className={s.coverAction}
          disabled={disabled}
          onClick={() => openDocCover(docId)}
        >
          <ImgUploadSVG className={s.icon} />
          <span className={s.label}>{t('dsb.cms.docs.editor.add_cover')}</span>
        </button>
      ) : null}
      <button
        type='button'
        className={s.importAction}
        disabled={disabled}
        onPointerDown={disabled ? undefined : () => prepareDocImport(docId)}
        onClick={() => openDocImport(docId)}
      >
        <CopyPlusSVG className={s.icon} />
        <span className={s.label}>{t('dsb.doc.action.import_content')}</span>
      </button>
    </div>
  )
}

export default TitleActions
