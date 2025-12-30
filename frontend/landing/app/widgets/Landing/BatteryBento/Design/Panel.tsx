import type { FC } from 'react'

import CursorSVG from '~/icons/Cursor'
import GridSVG from '~/icons/Grid'

import useSalon, { cn } from '../../salon/battery_bento/design/panel'

type TProps = {
  hovering: boolean
}

const Panel: FC<TProps> = ({ hovering }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={cn(s.line, 'top-4', hovering && 'rotate-0')} />
      <div className={cn(s.line, '-bottom-1', hovering && 'rotate-0')} />
      <div className={cn(s.column, 'rotate-3', hovering && 'rotate-0')} />

      <div
        className={cn(
          s.locateDot,
          !hovering ? 'top-1.5 left-5 -ml-0.5' : 'top-40 left-4 mt-2.5 -ml-0.5',
        )}
      />
      <div
        className={cn(
          s.locateDot,
          hovering ? 'top-3 left-4 -ml-0.5' : 'top-40 left-4 mt-1 -ml-1.5',
        )}
      />

      <div className={cn(s.mainCard, hovering && 'rotate-0 top-6 scale-95')}>
        <div
          className={cn(
            s.cursor,
            !hovering ? 'top-8 right-8 opacity-65' : 'top-5 right-10 opacity-100',
          )}
        >
          <CursorSVG className={s.cursorIcon} style={s.cursorIconStyle} />
          <div className={cn(s.cursorText)} style={s.cursorTextStyle}>
            Mr. Tony
          </div>
        </div>

        <div className={cn(s.indexText, 'top-16 -left-1 mt-1 -rotate-90 opacity-60')}>wechat:</div>

        <div className={cn(s.indexBarBottom, 'left-10 w-3 bottom-16')} />

        <div className={cn(s.indexBar, 'top-8 left-16 ml-2 h-5')} />
        <div className={cn(s.indexText, 'top-3 left-10 ml-1')}>mydear</div>

        <div className={cn(s.indexBar, 'top-10 left-32 -ml-1 mt-1 h-4')} />
        <div className={cn(s.indexText, 'top-6 left-24 ml-3')}>xym</div>

        <div
          className={cn(s.designTextGradient, hovering ? 'opacity-100' : 'opacity-0')}
          style={s.designTextGradientStyle}
        >
          design
        </div>
        <div
          className={cn(s.designText, hovering ? 'opacity-0' : 'opacity-100')}
          style={s.designTextStyle}
        >
          design
        </div>

        <div className={s.indexBarBottom} />
        <div className={cn(s.indexText, 'bottom-5 left-20 mb-0.5 bold-sm')}>2022 born</div>

        <GridSVG className={cn(s.gridIcon, 'left-3 top-3')} />
        <GridSVG className={cn(s.gridIcon, 'left-32 top-3 -ml-2')} />
      </div>
    </div>
  )
}

export default Panel
