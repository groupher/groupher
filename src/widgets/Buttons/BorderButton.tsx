import type { ReactNode } from 'react'

import useTheme from '~/hooks/useTheme'
import ArrowSVG from '~/icons/ArrowSimple'

import Button from './Button'

import useSalon, { cn } from './salon/border_button'
import useWallpaper from '~/hooks/useWallpaper'

type TProps = {
  children: ReactNode
  space?: number
  className?: string
}

export default ({ children, space = 2, className }: TProps) => {
  const s = useSalon()
  const { isLightTheme } = useTheme()

  const { background } = useWallpaper()

  return (
    <div className={s.wrapper}>
      <ArrowSVG className={s.arrow} />
      {isLightTheme ? (
        <div className={s.background}>
          <div className={s.realBg} style={{ background }} />
          <Button space={space} className={cn(s.button, className)} noBorder>
            {children}
          </Button>
        </div>
      ) : (
        <div className={s.darkButton} style={s.backgroundStyle}>
          <Button space={space} className={cn(s.button, className)} noBorder>
            {children}
          </Button>
        </div>
      )}
    </div>
  )
}
