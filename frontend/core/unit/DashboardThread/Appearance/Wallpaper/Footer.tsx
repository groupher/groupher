import { WALLPAPER_TYPE } from '~/const/wallpaper'
import useTrans from '~/hooks/useTrans'
import ForbidSVG from '~/icons/ForbidImg'
import Button from '~/widgets/Buttons/Button'
import YesOrNoButtons from '~/widgets/Buttons/YesOrNoButtons'

import useSalon from './salon/footer'
import useLogic from './useLogic'

export default function Footer() {
  const s = useSalon()
  const { t } = useTrans()

  const { getWallpaper, loading, isTouched, removeWallpaper, onSave, rollbackWallpaper } =
    useLogic()
  const { type } = getWallpaper()

  return (
    <div className={s.wrapper}>
      <div className={s.divider} />
      <div className={s.inner}>
        {type !== WALLPAPER_TYPE.NONE ? (
          <Button size='small' ghost onClick={() => removeWallpaper()}>
            <ForbidSVG className={s.blankIcon} /> {t('dsb.appearance.wallpaper.editor.blank')}
          </Button>
        ) : (
          <div />
        )}
        <div className='grow' />

        {isTouched ? (
          <YesOrNoButtons
            cancelText={t('dsb.appearance.wallpaper.editor.restore')}
            saveText={t('dsb.appearance.wallpaper.editor.confirm')}
            space={4}
            onCancel={() => {
              rollbackWallpaper()
            }}
            onConfirm={() => onSave()}
          />
        ) : (
          <Button size='small' space={10} loading={loading} onClick={() => onSave()}>
            {t('dsb.appearance.wallpaper.editor.confirm')}
          </Button>
        )}
      </div>
    </div>
  )
}
