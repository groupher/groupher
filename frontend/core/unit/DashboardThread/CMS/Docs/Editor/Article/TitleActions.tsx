import type { FC } from 'react'

import ImgUploadSVG from '~/icons/ImgUpload'

import useSalon from './salon/title_actions'

type TProps = {
  coverVisible: boolean
  disabled?: boolean
  onAddCover: () => void
}

const TitleActions: FC<TProps> = ({ coverVisible, disabled = false, onAddCover }) => {
  const s = useSalon()

  if (coverVisible) return null

  return (
    <div className={s.wrapper}>
      <button type='button' className={s.action} disabled={disabled} onClick={onAddCover}>
        <ImgUploadSVG className={s.icon} />
        <span>Add cover</span>
      </button>
    </div>
  )
}

export default TitleActions
