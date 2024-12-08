import { type FC, memo } from 'react'

import SVG from '~/const/svg'

import UploadSVG from '~/icons/Upload'
import MoreSVG from '~/icons/menu/More'
import MenuButton from '~/widgets/Buttons/MenuButton'

import useSalon from '../styles/upload_pic/upload_box'

const menuOptions = [
  {
    key: 'url',
    icon: SVG.COPY,
    title: '图片地址',
  },
]

const UploadBox: FC = () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.menu}>
        <MenuButton placement="bottom-end" options={menuOptions}>
          <MoreSVG className={s.moreIcon} />
        </MenuButton>
      </div>
      <UploadSVG className={s.uploadIcon} />
      <div className={s.title}>上传 / 引入图片</div>
    </div>
  )
}

export default memo(UploadBox)
