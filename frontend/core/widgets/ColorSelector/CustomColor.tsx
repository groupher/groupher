/*
 *
 * ColorSelector
 *
 */

import { m } from 'motion/react'

import useTrans from '~/hooks/useTrans'
import HookSVG from '~/icons/Hook'

import useSalon from './salon/custom_color'

type TProps = {
  color: string
  selected?: boolean
  expanded?: boolean
  stacked?: boolean
  onClick?: () => void
}

const CustomColor = ({
  color,
  selected = false,
  expanded = false,
  stacked = false,
  onClick = () => undefined,
}: TProps) => {
  const s = useSalon({ stacked })
  const { t } = useTrans()

  return (
    <m.div
      layout
      transition={{ layout: { duration: 0.15, ease: 'easeInOut' } }}
      className={s.wrapper}
    >
      <m.button
        layout
        type='button'
        aria-label={t('dsb.layout.primary_color.custom')}
        initial={false}
        animate={{ scale: expanded ? 0.98 : 1 }}
        transition={{ duration: 0.15, ease: 'easeInOut', delay: 0.06 }}
        className={s.inner}
        onClick={onClick}
      >
        <div className={s.dot}>
          <div className={s.dotRing} />
          <div className={s.dotInner} style={{ backgroundColor: color }}>
            {selected && <HookSVG className={s.checkIcon} />}
          </div>
        </div>
      </m.button>

      {expanded && (
        <m.div
          layout
          initial={false}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.15, ease: 'easeInOut', delay: 0.075 }}
          className={s.title}
        >
          {t('dsb.layout.primary_color.custom')}
        </m.div>
      )}
    </m.div>
  )
}

export default CustomColor
