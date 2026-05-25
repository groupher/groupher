import { useState } from 'react'

import useTrans from '~/hooks/useTrans'
import Button from '~/widgets/Buttons/Button'
import Input from '~/widgets/Input'

import useSalon from '../salon/build_in/custom_gradient_editor'
import useLogic from '../useLogic'

export default function CustomGradientEditor() {
  const s = useSalon()
  const { t } = useTrans()

  const { getWallpaper, confirmCustomColor } = useLogic()
  const { customColor } = getWallpaper()

  const [colorVal, setColorVal] = useState(customColor)
  const changed = colorVal !== customColor

  return (
    <div className={s.wrapper}>
      <div className={s.label}>{t('dsb.appearance.wallpaper.editor.custom')}</div>
      <Input
        placeholder={t('dsb.appearance.wallpaper.editor.custom_placeholder')}
        className={s.input}
        value={colorVal}
        onChange={(e) => setColorVal(e.target.value)}
      />
      <div className={s.footer}>
        <div className={s.note}>{t('dsb.appearance.wallpaper.editor.custom_note')}</div>

        <div className='grow' />
        {changed && (
          <>
            <Button ghost size='small' noBorder right={8} onClick={() => setColorVal(customColor)}>
              {t('dsb.appearance.wallpaper.editor.cancel')}
            </Button>

            <Button
              disabled={!changed}
              size='small'
              space={10}
              onClick={() => confirmCustomColor(colorVal)}
            >
              {t('dsb.appearance.wallpaper.editor.confirm')}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
