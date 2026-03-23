import { useState } from 'react'

import Button from '~/widgets/Buttons/Button'
import Input from '~/widgets/Input'

import useLogic from '../useLogic'
import useSalon from '../salon/build_in/custom_gradient_editor'

export default function CustomGradientEditor() {
  const s = useSalon()

  const { getWallpaper, confirmCustomColor } = useLogic()
  const { customColor } = getWallpaper()

  const [colorVal, setColorVal] = useState(customColor)
  const changed = colorVal !== customColor

  return (
    <div className={s.wrapper}>
      <div className={s.label}>自定义</div>
      <Input
        placeholder="颜色值以, 分隔, 如 #EBDDD1,#CEB2D3,#F16061"
        className={s.input}
        value={colorVal}
        onChange={(e) => setColorVal(e.target.value)}
      />
      <div className={s.footer}>
        <div className={s.note}>支持多组 HEX 颜色值，</div>

        <div className="grow" />
        {changed && (
          <>
            <Button ghost size="small" noBorder right={8} onClick={() => setColorVal(customColor)}>
              取消
            </Button>

            <Button
              disabled={!changed}
              size="small"
              space={10}
              onClick={() => confirmCustomColor(colorVal)}
            >
              确定
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
