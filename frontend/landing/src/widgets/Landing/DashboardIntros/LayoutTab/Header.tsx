import type { FC } from 'react'

import { COLOR } from '~/const/colors'
import type { TColorName } from '~/spec'

import useSalon, { cn } from '../../salon/dashboard_intros/layout_tab/header'

type TProps = {
  primaryColor: TColorName
  onPrimaryChange: (color: TColorName) => void
}

const SHOWCASE_COLORS: readonly TColorName[] = [COLOR.PURPLE, COLOR.BLUE, COLOR.GREEN, COLOR.ORANGE]

const Header: FC<TProps> = ({ primaryColor, onPrimaryChange }) => {
  const s = useSalon({ color: primaryColor })
  const cyclePrimaryColor = () => {
    const currentIndex = SHOWCASE_COLORS.indexOf(primaryColor)
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % SHOWCASE_COLORS.length
    onPrimaryChange(SHOWCASE_COLORS[nextIndex])
  }

  return (
    <div className={s.wrapper}>
      <button
        type='button'
        className={s.colorBox}
        aria-label='切换示例主色'
        onClick={cyclePrimaryColor}
      >
        <div className={s.colorBall} />
      </button>

      <h3 className={s.title}>你的社区</h3>
      <div className='grow' />
      <div className={cn(s.bar, 'right-2 top-2')} />
    </div>
  )
}

export default Header
