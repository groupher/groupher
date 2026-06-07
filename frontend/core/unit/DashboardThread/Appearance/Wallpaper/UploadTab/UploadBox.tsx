import { type FC, memo, useMemo } from 'react'

import SVG from '~/const/svg'
import useTrans from '~/hooks/useTrans'
import MoreSVG from '~/icons/menu/More'
import UploadSVG from '~/icons/Upload'
import MenuButton from '~/widgets/Buttons/MenuButton'

import useSalon from './salon/upload_box'

const UploadBox: FC = () => {
  const s = useSalon()
  const { t } = useTrans()
  const menuOptions = useMemo(
    () => [
      {
        key: 'url',
        icon: SVG.COPY,
        title: t('dsb.appearance.wallpaper.editor.image_url'),
      },
    ],
    [t],
  )

  return (
    <div className={s.wrapper}>
      <div className={s.menu}>
        <MenuButton placement='bottom-end' options={menuOptions}>
          <MoreSVG className={s.moreIcon} />
        </MenuButton>
      </div>
      <UploadSVG className={s.uploadIcon} />
      <div className={s.title}>{t('dsb.appearance.wallpaper.editor.upload_image')}</div>
    </div>
  )
}

export default memo(UploadBox)
