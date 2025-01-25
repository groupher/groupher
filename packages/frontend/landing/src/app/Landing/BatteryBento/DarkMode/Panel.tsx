import type { FC } from 'react'

import THEME from '~/const/theme'
import useTheme from '~/hooks/useTheme'

import ArticleCard from './ArticleCard'

import SunSVG from '~/icons/Sun'
import SunSolidSVG from '~/icons/SunSolid'
import MoonSolidSVG from '~/icons/MoonSolid'

import useSalon, { cn } from '../../salon/battery_bento/dark_mode/panel'

type TProps = {
  hovering: boolean
}

const Panel: FC<TProps> = ({ hovering }) => {
  const s = useSalon()
  const { theme } = useTheme()

  if (theme === THEME.LIGHT) {
    return (
      <div className={s.wrapper}>
        <ArticleCard
          hovering={hovering}
          className={cn('rounded-r-none', hovering ? '-mt-4' : '-mt-2')}
        />
        <div className={s.divideColumn} />
        <div className={cn(s.switchBox, hovering && 'rotate-180')}>
          <div className={cn(s.themeBox, !hovering && s.boxSolid)}>
            {!hovering ? (
              <SunSolidSVG className={cn(s.icon, s.iconSolid)} />
            ) : (
              <SunSVG className={cn(s.icon, 'size-5')} />
            )}
          </div>

          <div className={cn(s.themeBox, hovering && s.boxSolid)}>
            {!hovering ? (
              <MoonSolidSVG className={s.icon} />
            ) : (
              <MoonSolidSVG className={cn(s.icon, s.iconSolid, 'size-3.5 rotate-180')} />
            )}
          </div>
        </div>
        <ArticleCard
          hovering={!hovering}
          className={cn('rounded-l-none brightness-110', hovering ? 'mt-3' : 'mt-1')}
        />
      </div>
    )
  }

  return (
    <div className={s.wrapper}>
      <ArticleCard
        hovering={!hovering}
        className={cn('rounded-r-none', hovering ? '-mt-4' : '-mt-2')}
      />
      <div className={s.divideColumn} />
      <div className={cn(s.switchBox, hovering && 'rotate-180')}>
        <div className={cn(s.themeBox, !hovering && s.boxSolid)}>
          {hovering ? (
            <MoonSolidSVG className={cn(s.icon, 'rotate-180')} />
          ) : (
            <MoonSolidSVG className={cn(s.icon, s.iconSolid, 'size-3.5')} />
          )}
        </div>

        <div className={cn(s.themeBox, hovering && s.boxSolid)}>
          {hovering ? (
            <SunSolidSVG className={cn(s.icon, s.iconSolid)} />
          ) : (
            <SunSVG className={cn(s.icon, 'size-5')} />
          )}
        </div>
      </div>
      <ArticleCard
        hovering={hovering}
        className={cn('rounded-l-none', hovering ? 'mt-3' : 'mt-1')}
      />
    </div>
  )
}

export default Panel
