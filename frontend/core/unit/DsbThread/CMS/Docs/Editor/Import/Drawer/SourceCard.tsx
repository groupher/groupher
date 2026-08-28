import { AnimatePresence, m } from 'motion/react'
import type { FC, ReactNode } from 'react'

import ChevronDownSVG from '~/icons/ChevronDown'

import useSalon from './salon/source_card'

type TProps = {
  badge?: string
  children?: ReactNode
  description: string
  disabled?: boolean
  expanded?: boolean
  icon: ReactNode
  title: string
  onClick?: () => void
}

const SourceCard: FC<TProps> = ({
  badge,
  children,
  description,
  disabled = false,
  expanded = false,
  icon,
  title,
  onClick,
}) => {
  const s = useSalon()

  return (
    <div className={s.sourceCard(expanded)}>
      <button
        type='button'
        className={s.sourceCardTrigger(expanded)}
        disabled={disabled}
        aria-disabled={disabled}
        aria-expanded={children ? expanded : undefined}
        onClick={onClick}
      >
        <span className={s.sourceIcon}>{icon}</span>
        <span className={s.sourceCopy}>
          <span className={s.sourceTitleRow}>
            <span className={s.sourceTitle}>{title}</span>
            {badge ? <span className={s.sourceBadge}>{badge}</span> : null}
          </span>
          <span className={s.sourceDescription}>{description}</span>
        </span>
        {children ? (
          <m.span
            className={s.sourceArrow}
            initial={false}
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
            aria-hidden='true'
          >
            <ChevronDownSVG className={s.sourceArrowIcon} />
          </m.span>
        ) : null}
      </button>
      <AnimatePresence initial={false}>
        {expanded && children ? (
          <m.div
            key='source-panel'
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{
              height: 0,
              opacity: 0,
              transition: { duration: 0.15, ease: 'easeIn' },
            }}
            transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
            className={s.sourceCardPanelMotion}
          >
            <div className={s.sourceCardPanel}>{children}</div>
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

export default SourceCard
