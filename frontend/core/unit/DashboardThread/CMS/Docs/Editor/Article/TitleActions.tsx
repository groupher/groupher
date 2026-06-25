import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import ImgUploadSVG from '~/icons/ImgUpload'

import useSalon from './salon/title_actions'

type TProps = {
  coverVisible: boolean
  disabled?: boolean
  onAddCover: () => void
}

const TitleActions: FC<TProps> = ({ coverVisible, disabled = false, onAddCover }) => {
  const s = useSalon()
  const { t } = useTrans()

  if (coverVisible) return null

  return (
    <div className={s.wrapper}>
      <button type='button' className={s.action} disabled={disabled} onClick={onAddCover}>
        <ImgUploadSVG className={s.icon} />
        <span>{t('dsb.cms.docs.editor.add_cover')}</span>
      </button>
    </div>
  )
}

export default TitleActions
