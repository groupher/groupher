import type { FC } from 'react'

import type { TColorName } from '~/spec'
import ColorSelector from '~/widgets/ColorSelector'

import useSalon, { cn } from '../../salon/dashboard_intros/layout_tab/header'

type TProps = {
  primaryColor: TColorName
  onPrimaryChange: (color: TColorName) => void
}

const Header: FC<TProps> = ({ primaryColor, onPrimaryChange }) => {
  const s = useSalon({ color: primaryColor })

  return (
    <div className={s.wrapper}>
      <ColorSelector
        activeColor={primaryColor}
        onChange={(color) => onPrimaryChange(color)}
        placement='bottom-start'
        offset={[0, 0]}
      >
        <div className={s.colorBox}>
          <div className={s.colorBall} />
        </div>
      </ColorSelector>

      <h3 className={s.title}>你的社区</h3>
      <div className='grow' />
      <div className={cn(s.bar, 'right-2 top-2')} />
    </div>
  )
}

export default Header
