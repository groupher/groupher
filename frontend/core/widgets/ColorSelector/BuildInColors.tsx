/*
 *
 * ColorSelector
 *
 */

import { m } from 'motion/react'
import { endsWith, includes, isEmpty, keys } from 'ramda'
import type { FC } from 'react'
import { COLOR, STACKED_COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'
import ArrowSVG from '~/icons/ArrowSimple'
import HookSVG from '~/icons/Hook'
import type { TColorName } from '~/spec'

import useSalon, { cn } from './salon/buildin_colors'

const STAGGER_STEP = 0.012
const STAGE_DISTANCE = 6

type TProps = {
  activeColor?: TColorName | string
  stacked?: boolean
  onChange?: (color: TColorName) => void
  onCollapse?: () => void
  excepts?: TColorName[]
}

const BuildInColors: FC<TProps> = ({
  activeColor,
  stacked = false,
  onChange = console.log,
  onCollapse = console.log,
  excepts = [],
}) => {
  const DISPLAY_COLOR = stacked ? STACKED_COLOR : COLOR
  const colorKeys = (
    isEmpty(excepts)
      ? keys(DISPLAY_COLOR)
      : keys(DISPLAY_COLOR).filter((k) => !includes(k, excepts))
  ) as TColorName[]

  const s = useSalon({ stacked })
  const { rainbow } = useTwBelt()

  const duration = 0.15

  return (
    <m.div
      layout
      initial={false}
      transition={{ layout: { duration, ease: 'easeInOut' } }}
      className={s.wrapper}
    >
      {stacked && (
        <m.button
          layout
          initial
          animate={{ scale: 0.95, opacity: 1 }}
          transition={{
            duration,
            delay: 0,
            ease: 'easeInOut',
            layout: { duration, ease: 'easeInOut' },
          }}
          className={s.backButton}
          onClick={onCollapse}
        >
          <ArrowSVG className={s.backIcon} />
        </m.button>
      )}
      {colorKeys.map((color, index) => {
        const selected = !stacked && color === activeColor

        if (endsWith('_LIGHT', color)) return null
        if (!stacked && color === COLOR.CUSTOM) return null

        return (
          <m.button
            layout
            initial
            animate={{
              x: [stacked ? (index + 1) * STAGE_DISTANCE : -index * STAGE_DISTANCE, 0],
              scale: stacked ? [0.98, 0.92] : [0.96, 1],
              opacity: [0.88, 1],
            }}
            transition={{
              duration,
              delay: index * STAGGER_STEP,
              ease: 'easeInOut',
              layout: { duration, ease: 'easeInOut' },
            }}
            key={color}
            className={s.dotWrapper}
            onClick={() => {
              if (stacked) {
                onCollapse()
                return
              }

              onChange(color)
            }}
          >
            <div className={cn(s.dot, selected && s.dotActive, rainbow(color, 'bg'))}>
              {selected && <HookSVG className={s.checkIcon} />}
            </div>
          </m.button>
        )
      })}
    </m.div>
  )
}

export default BuildInColors
